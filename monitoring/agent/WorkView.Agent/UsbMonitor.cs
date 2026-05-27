using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Management;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace WorkView.Agent
{
    /// <summary>
    /// Sleduje USB / removable disky a zachycuje události na souborech.
    ///
    /// Detekce zařízení: WMI dotaz na DriveType=2 (Removable). Pro každý
    /// připojený disk se zaregistruje FileSystemWatcher.
    ///
    /// Limitace:
    /// - Sleduje jen souborový systém PŘÍSTUPNÝ z Windows (USB klíčenky,
    ///   externí HDD). Není to plnohodnotné DLP – nezachytí třeba kopírování
    ///   přes ADB do telefonu nebo přes uplynulé sítě.
    /// - "READ" operace nelze Windows FileSystemWatcherem detekovat zdarma;
    ///   sledujeme CREATE / WRITE / DELETE / RENAME.
    /// </summary>
    internal sealed class UsbMonitor : IDisposable
    {
        private readonly AgentConfig _cfg;
        private readonly Func<HttpClient> _httpFactory;
        private readonly ConcurrentQueue<UsbEventRecord> _queue = new ConcurrentQueue<UsbEventRecord>();
        private readonly Dictionary<string, FileSystemWatcher> _watchers = new Dictionary<string, FileSystemWatcher>(StringComparer.OrdinalIgnoreCase);
        private ManagementEventWatcher _driveWatcher;
        private System.Timers.Timer _flushTimer;
        private const int MAX_QUEUED = 10000;

        public UsbMonitor(AgentConfig cfg, Func<HttpClient> httpFactory)
        {
            _cfg = cfg;
            _httpFactory = httpFactory;
        }

        public void Start()
        {
            if (!_cfg.TrackUsb) { AgentLog.Write("UsbMonitor: TrackUsb=false, neaktivuji."); return; }
            try
            {
                // 1) Najdi všechny aktuálně připojené removable disky a začni je sledovat.
                foreach (DriveInfo d in DriveInfo.GetDrives())
                {
                    if (d.DriveType == DriveType.Removable && d.IsReady)
                    {
                        AttachWatcher(d.Name, d.VolumeLabel);
                    }
                }

                // 2) WMI watcher pro připojení/odpojení USB v budoucnu.
                _driveWatcher = new ManagementEventWatcher(
                    new WqlEventQuery("SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2 OR EventType = 3"));
                _driveWatcher.EventArrived += OnDriveChange;
                _driveWatcher.Start();
                AgentLog.Write("UsbMonitor: spuštěn, sleduji " + _watchers.Count + " removable disků");

                _flushTimer = new System.Timers.Timer(5 * 60 * 1000);
                _flushTimer.Elapsed += async (s, e) => await FlushAsync();
                _flushTimer.AutoReset = true;
                _flushTimer.Start();
            }
            catch (Exception ex) { AgentLog.Write("UsbMonitor START FAILED: " + ex.Message); }
        }

        public void Dispose()
        {
            try { _driveWatcher?.Stop(); _driveWatcher?.Dispose(); } catch { }
            foreach (var w in _watchers.Values)
            {
                try { w.EnableRaisingEvents = false; w.Dispose(); } catch { }
            }
            _watchers.Clear();
            try { _flushTimer?.Dispose(); } catch { }
        }

        private void OnDriveChange(object sender, EventArrivedEventArgs e)
        {
            // EventType 2 = Arrived, 3 = Removed
            try
            {
                ushort type = (ushort)e.NewEvent["EventType"];
                string drive = (string)e.NewEvent["DriveName"]; // např. "E:"
                if (drive == null) return;
                if (type == 2)
                {
                    DriveInfo di = new DriveInfo(drive);
                    if (di.DriveType == DriveType.Removable && di.IsReady)
                    {
                        AttachWatcher(di.Name, di.VolumeLabel);
                        AgentLog.Write("UsbMonitor: připojen disk " + drive);
                    }
                }
                else if (type == 3)
                {
                    DetachWatcher(drive + "\\");
                    AgentLog.Write("UsbMonitor: odpojen disk " + drive);
                }
            }
            catch (Exception ex) { AgentLog.Write("UsbMonitor drive change FAILED: " + ex.Message); }
        }

        private void AttachWatcher(string root, string label)
        {
            if (_watchers.ContainsKey(root)) return;
            try
            {
                FileSystemWatcher w = new FileSystemWatcher(root)
                {
                    IncludeSubdirectories = true,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
                };
                w.Created += (s, e) => EnqueueFsEvent("CREATE", e.FullPath, root, label);
                w.Changed += (s, e) => EnqueueFsEvent("WRITE", e.FullPath, root, label);
                w.Deleted += (s, e) => EnqueueFsEvent("DELETE", e.FullPath, root, label);
                w.Renamed += (s, e) => EnqueueFsEvent("RENAME", e.FullPath, root, label);
                w.EnableRaisingEvents = true;
                _watchers[root] = w;
            }
            catch (Exception ex) { AgentLog.Write("UsbMonitor attach FAILED " + root + ": " + ex.Message); }
        }

        private void DetachWatcher(string root)
        {
            if (!_watchers.TryGetValue(root, out FileSystemWatcher w)) return;
            try { w.EnableRaisingEvents = false; w.Dispose(); } catch { }
            _watchers.Remove(root);
        }

        private void EnqueueFsEvent(string action, string path, string driveRoot, string label)
        {
            if (_queue.Count >= MAX_QUEUED) return;
            try
            {
                string fileName = Path.GetFileName(path);
                string ext = (Path.GetExtension(path) ?? string.Empty).TrimStart('.').ToLowerInvariant();
                long size = 0;
                try { if (File.Exists(path)) size = new FileInfo(path).Length; } catch { /* DELETE = soubor už není */ }

                _queue.Enqueue(new UsbEventRecord
                {
                    EventAtUtc = DateTime.UtcNow,
                    Action = action,
                    DriveLetter = driveRoot.TrimEnd('\\'),
                    DriveLabel = label,
                    FileName = _cfg.CaptureUsbFilename ? fileName : null,
                    FileExt = string.IsNullOrEmpty(ext) ? null : ext,
                    SizeBytes = size > 0 ? (long?)size : null,
                });
            }
            catch (Exception ex) { AgentLog.Write("UsbMonitor enqueue FAILED: " + ex.Message); }
        }

        public async Task FlushAsync()
        {
            if (_queue.Count == 0) return;
            List<UsbEventRecord> batch = new List<UsbEventRecord>(Math.Min(_queue.Count, 1000));
            for (int i = 0; i < 1000; i++)
            {
                if (!_queue.TryDequeue(out UsbEventRecord r)) break;
                batch.Add(r);
            }
            if (batch.Count == 0) return;

            try
            {
                StringBuilder sb = new StringBuilder();
                sb.Append('{');
                sb.Append("\"machineId\":").Append(Json.Str(MachineIdentity.MachineId())).Append(',');
                sb.Append("\"sid\":").Append(Json.Str(MachineIdentity.UserSid())).Append(',');
                sb.Append("\"events\":[");
                for (int i = 0; i < batch.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    sb.Append(batch[i].ToJson());
                }
                sb.Append("]}");

                using (HttpClient client = _httpFactory())
                using (StringContent content = new StringContent(sb.ToString(), Encoding.UTF8, "application/json"))
                using (HttpResponseMessage resp = await client.PostAsync(_cfg.BackendUrl + "/api/v1/ingest/usb", content))
                {
                    if (resp.IsSuccessStatusCode)
                    {
                        AgentLog.Write("UsbMonitor flush: " + batch.Count + " událostí");
                    }
                    else
                    {
                        AgentLog.Write("UsbMonitor flush FAILED HTTP " + (int)resp.StatusCode + ", vracím do fronty");
                        foreach (var r in batch) _queue.Enqueue(r);
                    }
                }
            }
            catch (Exception ex)
            {
                AgentLog.Write("UsbMonitor flush EXCEPTION: " + ex.Message);
                foreach (var r in batch) _queue.Enqueue(r);
            }
        }

        internal sealed class UsbEventRecord
        {
            public DateTime EventAtUtc;
            public string Action;
            public string DriveLetter;
            public string DriveLabel;
            public string FileName;
            public string FileExt;
            public long? SizeBytes;

            public string ToJson()
            {
                StringBuilder sb = new StringBuilder();
                sb.Append('{');
                sb.Append("\"eventAt\":").Append(Json.Str(EventAtUtc.ToString("o")));
                sb.Append(",\"action\":").Append(Json.Str(Action));
                if (DriveLetter != null) sb.Append(",\"driveLetter\":").Append(Json.Str(DriveLetter));
                if (!string.IsNullOrEmpty(DriveLabel)) sb.Append(",\"driveLabel\":").Append(Json.Str(DriveLabel));
                if (FileName != null) sb.Append(",\"fileName\":").Append(Json.Str(FileName));
                if (FileExt != null) sb.Append(",\"fileExt\":").Append(Json.Str(FileExt));
                if (SizeBytes.HasValue) sb.Append(",\"sizeBytes\":\"").Append(SizeBytes.Value).Append('"'); // BigInt jako string
                sb.Append('}');
                return sb.ToString();
            }
        }
    }
}
