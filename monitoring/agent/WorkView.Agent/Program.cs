using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace WorkView.Agent
{
    /// <summary>
    /// Vstupní bod agenta. Běží tiše na pozadí v interaktivní session uživatele
    /// (bez okna a bez ikony v liště). Potřebuje message loop kvůli nízkoúrovňovým
    /// hookům a notifikacím o uzamčení session.
    ///
    /// Transparentnost dle §316 ZP je zajištěna PÍSEMNÝM poučením zaměstnanců
    /// (viz docs/monitoring/pravni), nikoli běhovou ikonou.
    /// </summary>
    internal static class Program
    {
        private static volatile bool _sessionLocked;
        private static LocalBuffer _buffer;
        private static Sender _sender;
        private static AgentConfig _cfg;
        private static bool _sending;

        [STAThread]
        private static void Main()
        {
            // Jedna instance na uživatelskou session.
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "WorkViewAgent_" + Environment.UserName, out createdNew))
            {
                if (!createdNew) return;

                AgentConfig cfg;
                try
                {
                    cfg = AgentConfig.Load();
                }
                catch (Exception ex)
                {
                    // Bez konfigurace nemá smysl běžet. Tiše zaloguj a skonči (žádný pop-up).
                    LogError("Chybí/špatná konfigurace: " + ex.Message);
                    return;
                }

                // Nízká priorita – agent nikdy nesoupeří o CPU s prací uživatele.
                try { System.Diagnostics.Process.GetCurrentProcess().PriorityClass = System.Diagnostics.ProcessPriorityClass.BelowNormal; }
                catch { /* nepodstatné, pokračuj */ }

                _cfg = cfg;
                _buffer = new LocalBuffer();
                _sender = new Sender(cfg);

                using (InputCounters input = new InputCounters())
                using (ActivityTracker tracker = new ActivityTracker(input, _buffer, cfg.IntervalSeconds, () => _sessionLocked, cfg.CaptureWindowTitle, cfg.IdleThresholdSeconds))
                {
                    input.Install();
                    tracker.Start();

                    SystemEvents.SessionSwitch += OnSessionSwitch;

                    // Odesílání dávek v konfigurovatelném intervalu (výchozí 15 minut).
                    // Mezitím se data hromadí v lokálním bufferu (přežijí restart i výpadek sítě).
                    System.Windows.Forms.Timer sendTimer = new System.Windows.Forms.Timer { Interval = cfg.SendIntervalSeconds * 1000 };
                    sendTimer.Tick += async (s, e) => await TrySendAsync();
                    sendTimer.Start();

                    Application.ApplicationExit += (s, e) =>
                    {
                        SystemEvents.SessionSwitch -= OnSessionSwitch;
                        sendTimer.Stop();
                    };

                    Application.Run();
                }
            }
        }

        private static void LogError(string message)
        {
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkView");
                Directory.CreateDirectory(dir);
                File.AppendAllText(Path.Combine(dir, "agent.log"), $"{DateTime.UtcNow:o}\t{message}\n");
            }
            catch { /* nesmí shodit agenta */ }
        }

        private static void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            if (e.Reason == SessionSwitchReason.SessionLock || e.Reason == SessionSwitchReason.SessionLogoff)
                _sessionLocked = true;
            else if (e.Reason == SessionSwitchReason.SessionUnlock || e.Reason == SessionSwitchReason.SessionLogon)
                _sessionLocked = false;
        }

        private static async System.Threading.Tasks.Task TrySendAsync()
        {
            if (_sending) return;
            // Když je zapnuté „jen z firemní sítě" a nejsme v ní, nech data v bufferu.
            if (_cfg.CompanyNetworkOnly && !NetworkGuard.OnCompanyNetwork(_cfg.CompanyProbeHost)) return;
            _sending = true;
            try
            {
                // Pošli po dávkách max 500 záznamů, dokud je co posílat.
                while (true)
                {
                    List<string> batch = _buffer.Peek(500);
                    if (batch.Count == 0) break;
                    bool ok = await _sender.SendBatchAsync(batch);
                    if (!ok) break; // necháme v bufferu na další pokus
                    _buffer.Commit(batch.Count);
                    if (batch.Count < 500) break;
                }
            }
            finally
            {
                _sending = false;
            }
        }
    }
}
