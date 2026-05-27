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
        // Délka agregačního intervalu (jeden záznam). Výchozí 60 s = jemná granularita
        // pro kalendář, klasifikaci a detekci praktik. NEMĚNÍ frekvenci odesílání.
        public int IntervalSeconds { get; private set; }
        // Jak často se nasbírané dávky odešlou na server (výchozí 900 s = 15 minut).
        // Mezitím se data hromadí v lokálním bufferu (přežijí restart i výpadek sítě).
        public int SendIntervalSeconds { get; private set; }
        // Sbírat titulek aktivního okna (pro klasifikaci práce/zábava).
        // Titulek je osobní údaj – nasazení musí krýt informace pro zaměstnance + DPIA.
        public bool CaptureWindowTitle { get; private set; }
        // Práh nečinnosti v sekundách (výchozí 300 = 5 minut bez vstupu/přepnutí okna).
        public int IdleThresholdSeconds { get; private set; }
        // Odesílat jen z firemní sítě (LAN nebo VPN, která dává firemní DNS). Když je
        // zapnuté, agent před odesláním ověří dostupnost firemní sítě přes CompanyProbeHost;
        // mimo síť data dál bufferuje a odešle, až se připojí. Výchozí false.
        public bool CompanyNetworkOnly { get; private set; }
        // Interní jméno, které se má dát přeložit přes DNS jako důkaz připojení k firemní
        // síti (např. doména AD nebo interní host serveru). Když není uvedeno, použije se
        // host z BackendUrl. Vyber jméno, které se VENKU nepřeloží (interní-only A záznam).
        public string CompanyProbeHost { get; private set; }

        public static AgentConfig Load()
        {
            string backend = ReadRegistry("BackendUrl") ?? Environment.GetEnvironmentVariable("WORKVIEW_BACKEND_URL");
            string token = ReadRegistry("IngestToken") ?? Environment.GetEnvironmentVariable("WORKVIEW_INGEST_TOKEN");
            string intervalRaw = ReadRegistry("IntervalSeconds") ?? Environment.GetEnvironmentVariable("WORKVIEW_INTERVAL_SECONDS");

            int interval;
            if (!int.TryParse(intervalRaw, out interval) || interval <= 0) interval = 60;

            string sendRaw = ReadRegistry("SendIntervalSeconds") ?? Environment.GetEnvironmentVariable("WORKVIEW_SEND_INTERVAL_SECONDS");
            int sendInterval;
            if (!int.TryParse(sendRaw, out sendInterval) || sendInterval <= 0) sendInterval = 120; // 2 minuty (rovnou viditelný log v dashboardu)
            if (sendInterval < 60) sendInterval = 60; // pod 1 min nedává smysl

            string captureRaw = ReadRegistry("CaptureWindowTitle") ?? Environment.GetEnvironmentVariable("WORKVIEW_CAPTURE_TITLE");
            bool captureTitle = captureRaw == "1" || string.Equals(captureRaw, "true", StringComparison.OrdinalIgnoreCase);

            string idleRaw = ReadRegistry("IdleThresholdSeconds") ?? Environment.GetEnvironmentVariable("WORKVIEW_IDLE_SECONDS");
            int idleSeconds;
            if (!int.TryParse(idleRaw, out idleSeconds) || idleSeconds <= 0) idleSeconds = 300;

            string netOnlyRaw = ReadRegistry("CompanyNetworkOnly") ?? Environment.GetEnvironmentVariable("WORKVIEW_COMPANY_NETWORK_ONLY");
            bool networkOnly = netOnlyRaw == "1" || string.Equals(netOnlyRaw, "true", StringComparison.OrdinalIgnoreCase);
            string probeHost = ReadRegistry("CompanyProbeHost") ?? Environment.GetEnvironmentVariable("WORKVIEW_COMPANY_PROBE_HOST");

            if (string.IsNullOrWhiteSpace(backend))
                throw new InvalidOperationException("Chybí BackendUrl (HKLM\\SOFTWARE\\WorkView nebo WORKVIEW_BACKEND_URL).");
            if (string.IsNullOrWhiteSpace(token))
                throw new InvalidOperationException("Chybí IngestToken.");

            backend = backend.TrimEnd('/');

            // HTTPS je povinné kromě explicitního opt-outu pro lokální vývoj.
            // Bez šifrování by ingest token i obsah datu šly volně po síti.
            string allowInsecureRaw = ReadRegistry("AllowInsecureHttp") ?? Environment.GetEnvironmentVariable("WORKVIEW_ALLOW_INSECURE_HTTP");
            bool allowInsecure = allowInsecureRaw == "1" || string.Equals(allowInsecureRaw, "true", StringComparison.OrdinalIgnoreCase);
            if (!allowInsecure)
            {
                Uri parsed;
                if (!Uri.TryCreate(backend, UriKind.Absolute, out parsed))
                    throw new InvalidOperationException("BackendUrl není platná absolutní URL: " + backend);
                bool isLocalhost = parsed.IsLoopback || string.Equals(parsed.Host, "localhost", StringComparison.OrdinalIgnoreCase);
                if (!string.Equals(parsed.Scheme, "https", StringComparison.OrdinalIgnoreCase) && !isLocalhost)
                    throw new InvalidOperationException("BackendUrl musí používat https:// (pro vývoj nastav AllowInsecureHttp=1 v HKLM\\SOFTWARE\\WorkView).");
            }

            if (string.IsNullOrWhiteSpace(probeHost)) probeHost = HostFromUrl(backend);

            return new AgentConfig
            {
                BackendUrl = backend,
                IngestToken = token,
                IntervalSeconds = interval,
                SendIntervalSeconds = sendInterval,
                CaptureWindowTitle = captureTitle,
                IdleThresholdSeconds = idleSeconds,
                CompanyNetworkOnly = networkOnly,
                CompanyProbeHost = probeHost
            };
        }

        private static string HostFromUrl(string url)
        {
            try { return new Uri(url).Host; }
            catch { return null; }
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
