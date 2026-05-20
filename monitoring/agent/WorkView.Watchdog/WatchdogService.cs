using System;
using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Timers;

namespace WorkView.Watchdog
{
    /// <summary>
    /// Hlídací služba (LocalSystem, auto-start). Zajišťuje, že agent monitoringu
    /// běží v aktivní uživatelské session – po ukončení (i ruční) ho znovu spustí.
    /// Sama nic nesbírá. Standardní uživatel ji bez admin práv nezastaví.
    /// </summary>
    public sealed class WatchdogService : ServiceBase
    {
        private const string AgentExeName = "MA win 32.exe";
        private const string AgentProcName = "MA win 32"; // bez .exe (Process.ProcessName)
        private Timer _timer;

        public WatchdogService()
        {
            ServiceName = "MAWin32";
            CanHandleSessionChangeEvent = true;
            CanStop = true;
            CanShutdown = true;
        }

        protected override void OnStart(string[] args)
        {
            Log("Služba spuštěna.");
            _timer = new Timer(20000) { AutoReset = true };
            _timer.Elapsed += (s, e) => SafeEnsure();
            _timer.Start();
            SafeEnsure();
        }

        protected override void OnStop()
        {
            if (_timer != null) { _timer.Stop(); _timer.Dispose(); _timer = null; }
            Log("Služba zastavena.");
        }

        protected override void OnSessionChange(SessionChangeDescription change)
        {
            // Po přihlášení/odemčení/připojení konzole nahodit agenta pro danou session.
            switch (change.Reason)
            {
                case SessionChangeReason.SessionLogon:
                case SessionChangeReason.SessionUnlock:
                case SessionChangeReason.ConsoleConnect:
                case SessionChangeReason.RemoteConnect:
                    SafeEnsure();
                    break;
            }
        }

        private void SafeEnsure()
        {
            try { EnsureAgentRunning(); }
            catch (Exception ex) { Log("Chyba: " + ex.Message); }
        }

        private void EnsureAgentRunning()
        {
            uint sid = SessionLauncher.ActiveSessionId();
            if (sid == SessionLauncher.INVALID_SESSION) return; // nikdo přihlášen

            if (IsAgentRunningInSession(sid)) return;

            string dir = AppDomain.CurrentDomain.BaseDirectory;
            string exe = Path.Combine(dir, AgentExeName);
            if (!File.Exists(exe)) { Log("Nenalezen agent: " + exe); return; }

            string error;
            bool ok = SessionLauncher.LaunchInSession(sid, exe, dir, out error);
            Log(ok ? "Agent spuštěn v session " + sid : "Spuštění selhalo: " + error);
        }

        private static bool IsAgentRunningInSession(uint sid)
        {
            foreach (Process p in Process.GetProcessesByName(AgentProcName))
            {
                try { if ((uint)p.SessionId == sid) return true; }
                catch { /* ignoruj nepřístupné procesy */ }
                finally { p.Dispose(); }
            }
            return false;
        }

        private static void Log(string message)
        {
            try
            {
                string d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkView");
                Directory.CreateDirectory(d);
                File.AppendAllText(Path.Combine(d, "watchdog.log"), DateTime.UtcNow.ToString("o") + "\t" + message + "\n");
            }
            catch { }
        }
    }
}
