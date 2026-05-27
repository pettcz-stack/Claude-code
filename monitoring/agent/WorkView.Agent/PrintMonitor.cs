using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace WorkView.Agent
{
    /// <summary>
    /// Sleduje tiskové úlohy přes Windows Event Log
    /// (Microsoft-Windows-PrintService/Operational, event ID 307 = "Document printed").
    ///
    /// Pro fungování musí být na PC zapnutý operational log print service:
    ///   wevtutil sl Microsoft-Windows-PrintService/Operational /e:true
    /// Toto agent provede sám při startu (vyžaduje SYSTEM práva, watchdog je má).
    ///
    /// Sebrané úlohy bufferuje a periodicky (5 minut) odesílá na backend
    /// POST /api/v1/ingest/print. Backend musí mít v Settings printTrackingEnabled.
    /// </summary>
    internal sealed class PrintMonitor : IDisposable
    {
        private readonly AgentConfig _cfg;
        private readonly Func<HttpClient> _httpFactory;
        private EventLogWatcher _watcher;
        private readonly ConcurrentQueue<PrintJobRecord> _queue = new ConcurrentQueue<PrintJobRecord>();
        private System.Timers.Timer _flushTimer;
        // Tvrdý strop, aby se buffer nezhltil při výpadku serveru (max ~24 h sběru).
        private const int MAX_QUEUED = 5000;

        public PrintMonitor(AgentConfig cfg, Func<HttpClient> httpFactory)
        {
            _cfg = cfg;
            _httpFactory = httpFactory;
        }

        public void Start()
        {
            if (!_cfg.TrackPrint) { AgentLog.Write("PrintMonitor: TrackPrint=false, neaktivuji."); return; }
            try
            {
                EnableOperationalLog();
                EventLogQuery q = new EventLogQuery(
                    "Microsoft-Windows-PrintService/Operational",
                    PathType.LogName,
                    "*[System[(EventID=307)]]");
                _watcher = new EventLogWatcher(q);
                _watcher.EventRecordWritten += OnPrintEvent;
                _watcher.Enabled = true;
                AgentLog.Write("PrintMonitor: spuštěn (event 307)");

                _flushTimer = new System.Timers.Timer(5 * 60 * 1000); // 5 minut
                _flushTimer.Elapsed += async (s, e) => await FlushAsync();
                _flushTimer.AutoReset = true;
                _flushTimer.Start();
            }
            catch (Exception ex)
            {
                AgentLog.Write("PrintMonitor START FAILED: " + ex.Message);
            }
        }

        public void Dispose()
        {
            try { if (_watcher != null) { _watcher.Enabled = false; _watcher.Dispose(); } } catch { }
            try { _flushTimer?.Dispose(); } catch { }
        }

        private static void EnableOperationalLog()
        {
            try
            {
                using (EventLogConfiguration cfg = new EventLogConfiguration("Microsoft-Windows-PrintService/Operational"))
                {
                    if (!cfg.IsEnabled)
                    {
                        cfg.IsEnabled = true;
                        cfg.SaveChanges();
                        AgentLog.Write("PrintMonitor: aktivován Operational log");
                    }
                }
            }
            catch (Exception ex)
            {
                AgentLog.Write("PrintMonitor: nelze zapnout Operational log (běž jako SYSTEM): " + ex.Message);
            }
        }

        private void OnPrintEvent(object sender, EventRecordWrittenEventArgs e)
        {
            if (e == null || e.EventRecord == null) return;
            try
            {
                EventRecord rec = e.EventRecord;
                // Properties pořadí pro event 307 (Windows 10/11):
                //   [0] JobID, [1] DocumentName, [2] ClientMachineName, [3] UserName,
                //   [4] PrinterName, [5] PortName, [6] BytesPrinted, [7] PagesPrinted
                var props = rec.Properties;
                if (props == null || props.Count < 8) return;
                int pages = ParseInt(props[7].Value, 1);
                long bytes = ParseLong(props[6].Value, 0);
                string docName = SafeStr(props[1].Value);
                string printer = SafeStr(props[4].Value);
                if (_queue.Count >= MAX_QUEUED) return; // ochrana proti přetečení
                _queue.Enqueue(new PrintJobRecord
                {
                    JobAtUtc = rec.TimeCreated ?? DateTime.UtcNow,
                    PrinterName = printer,
                    DocumentName = _cfg.CapturePrintDocName ? docName : null,
                    Pages = pages,
                    Copies = 1, // event 307 už pages × copies obsahuje; copies nemáme separátně
                    PaperSize = null, // Windows event tohle nezná, vyplníme z print queue jindy
                    Color = null,
                    Duplex = null,
                    SizeBytes = bytes > 0 ? (int?)Math.Min(bytes, int.MaxValue) : null,
                });
            }
            catch (Exception ex) { AgentLog.Write("PrintMonitor event parse FAILED: " + ex.Message); }
        }

        private static int ParseInt(object v, int def) { try { return v == null ? def : Convert.ToInt32(v); } catch { return def; } }
        private static long ParseLong(object v, long def) { try { return v == null ? def : Convert.ToInt64(v); } catch { return def; } }
        private static string SafeStr(object v) { try { return v?.ToString(); } catch { return null; } }

        public async Task FlushAsync()
        {
            int n = _queue.Count;
            if (n == 0) return;
            // Vytáhneme až 500 (server limit).
            List<PrintJobRecord> batch = new List<PrintJobRecord>(Math.Min(n, 500));
            for (int i = 0; i < 500; i++)
            {
                if (!_queue.TryDequeue(out PrintJobRecord r)) break;
                batch.Add(r);
            }
            if (batch.Count == 0) return;

            try
            {
                StringBuilder sb = new StringBuilder();
                sb.Append('{');
                sb.Append("\"machineId\":").Append(Json.Str(MachineIdentity.MachineId())).Append(',');
                sb.Append("\"sid\":").Append(Json.Str(MachineIdentity.UserSid())).Append(',');
                sb.Append("\"jobs\":[");
                for (int i = 0; i < batch.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    sb.Append(batch[i].ToJson());
                }
                sb.Append("]}");

                using (HttpClient client = _httpFactory())
                using (StringContent content = new StringContent(sb.ToString(), Encoding.UTF8, "application/json"))
                using (HttpResponseMessage resp = await client.PostAsync(_cfg.BackendUrl + "/api/v1/ingest/print", content))
                {
                    if (resp.IsSuccessStatusCode)
                    {
                        AgentLog.Write("PrintMonitor flush: " + batch.Count + " úloh");
                    }
                    else
                    {
                        AgentLog.Write("PrintMonitor flush FAILED HTTP " + (int)resp.StatusCode + ", vracím do fronty");
                        // Při selhání vrať data zpět, ať se zkusí příště.
                        foreach (var r in batch) _queue.Enqueue(r);
                    }
                }
            }
            catch (Exception ex)
            {
                AgentLog.Write("PrintMonitor flush EXCEPTION: " + ex.Message);
                foreach (var r in batch) _queue.Enqueue(r);
            }
        }

        internal sealed class PrintJobRecord
        {
            public DateTime JobAtUtc;
            public string PrinterName;
            public string DocumentName;
            public int Pages;
            public int Copies;
            public string PaperSize;
            public bool? Color;
            public bool? Duplex;
            public int? SizeBytes;

            public string ToJson()
            {
                StringBuilder sb = new StringBuilder();
                sb.Append('{');
                sb.Append("\"jobAt\":").Append(Json.Str(JobAtUtc.ToString("o")));
                if (PrinterName != null) sb.Append(",\"printerName\":").Append(Json.Str(PrinterName));
                if (DocumentName != null) sb.Append(",\"documentName\":").Append(Json.Str(DocumentName));
                sb.Append(",\"pages\":").Append(Pages);
                sb.Append(",\"copies\":").Append(Copies);
                if (PaperSize != null) sb.Append(",\"paperSize\":").Append(Json.Str(PaperSize));
                if (Color.HasValue) sb.Append(",\"color\":").Append(Color.Value ? "true" : "false");
                if (Duplex.HasValue) sb.Append(",\"duplex\":").Append(Duplex.Value ? "true" : "false");
                if (SizeBytes.HasValue) sb.Append(",\"sizeBytes\":").Append(SizeBytes.Value);
                sb.Append('}');
                return sb.ToString();
            }
        }
    }
}
