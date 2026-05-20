using System;
using Microsoft.Win32;

namespace WorkView.Agent
{
    /// <summary>
    /// Konfigurace agenta. Primárně z registru HKLM\SOFTWARE\WorkView
    /// (plněno MSI / GPO transformem). Pro vývoj fallback na proměnné prostředí.
    /// </summary>
    internal sealed class AgentConfig
    {
        public string BackendUrl { get; private set; }
        public string IngestToken { get; private set; }
        public int IntervalSeconds { get; private set; }
        // Sbírat titulek aktivního okna (pro klasifikaci práce/zábava).
        // Titulek je osobní údaj – nasazení musí krýt informace pro zaměstnance + DPIA.
        public bool CaptureWindowTitle { get; private set; }
        // Práh nečinnosti v sekundách (výchozí 300 = 5 minut bez vstupu/přepnutí okna).
        public int IdleThresholdSeconds { get; private set; }

        public static AgentConfig Load()
        {
            string backend = ReadRegistry("BackendUrl") ?? Environment.GetEnvironmentVariable("WORKVIEW_BACKEND_URL");
            string token = ReadRegistry("IngestToken") ?? Environment.GetEnvironmentVariable("WORKVIEW_INGEST_TOKEN");
            string intervalRaw = ReadRegistry("IntervalSeconds") ?? Environment.GetEnvironmentVariable("WORKVIEW_INTERVAL_SECONDS");

            int interval;
            if (!int.TryParse(intervalRaw, out interval) || interval <= 0) interval = 60;

            string captureRaw = ReadRegistry("CaptureWindowTitle") ?? Environment.GetEnvironmentVariable("WORKVIEW_CAPTURE_TITLE");
            bool captureTitle = captureRaw == "1" || string.Equals(captureRaw, "true", StringComparison.OrdinalIgnoreCase);

            string idleRaw = ReadRegistry("IdleThresholdSeconds") ?? Environment.GetEnvironmentVariable("WORKVIEW_IDLE_SECONDS");
            int idleSeconds;
            if (!int.TryParse(idleRaw, out idleSeconds) || idleSeconds <= 0) idleSeconds = 300;

            if (string.IsNullOrWhiteSpace(backend))
                throw new InvalidOperationException("Chybí BackendUrl (HKLM\\SOFTWARE\\WorkView nebo WORKVIEW_BACKEND_URL).");
            if (string.IsNullOrWhiteSpace(token))
                throw new InvalidOperationException("Chybí IngestToken.");

            return new AgentConfig
            {
                BackendUrl = backend.TrimEnd('/'),
                IngestToken = token,
                IntervalSeconds = interval,
                CaptureWindowTitle = captureTitle,
                IdleThresholdSeconds = idleSeconds
            };
        }

        private static string ReadRegistry(string name)
        {
            try
            {
                // 64bit i 32bit pohled (agent může běžet jako 32b proces na 64b OS).
                using (RegistryKey baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                using (RegistryKey key = baseKey.OpenSubKey(@"SOFTWARE\WorkView"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(name);
                        if (val != null) return val.ToString();
                    }
                }
            }
            catch { /* ignoruj a zkus fallback */ }
            return null;
        }
    }
}
