using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace WorkView.Agent
{
    /// <summary>Odesílá nasbírané intervaly na backend (POST /api/v1/ingest).</summary>
    internal sealed class Sender
    {
        private readonly AgentConfig _cfg;
        private HttpClient _http;
        private readonly string _devicePart;
        private readonly string _userPart;

        // Server v odpovědi ingestu řekne, zda je zaměstnancům zpřístupněn report
        // (přepínač v administraci). Agent podle toho zobrazí/skryje ikonku v liště.
        public volatile bool LastEmployeeReportEnabled;

        public Sender(AgentConfig cfg)
        {
            _cfg = cfg;
            // TLS 1.2 i na starších .NET Framework / Windows.
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            BuildHttpClient();

            _devicePart = "\"device\":{" +
                "\"machineId\":" + Json.Str(MachineIdentity.MachineId()) + "," +
                "\"hostname\":" + Json.Str(MachineIdentity.Hostname()) + "," +
                "\"os\":" + Json.Str(MachineIdentity.OsName()) + "," +
                "\"agentVersion\":" + Json.Str(AgentInfo.Version) + "}";
            _userPart = "\"user\":{" +
                "\"sid\":" + Json.Str(MachineIdentity.UserSid()) + "," +
                "\"displayName\":" + Json.Str(MachineIdentity.UserDisplayName()) + "}";
        }

        /// <summary>
        /// Po probuzení Windows ze spánku jsou navázaná TCP spojení v poolu mrtvá
        /// (server-side keep-alive timeout, výměna IP adresy přes DHCP, jiný DNS).
        /// Tahle metoda zahodí starého klienta i connection pool pro backend
        /// a navážeme čerstvě. Volá se z handleru SystemEvents.PowerModeChanged = Resume.
        /// </summary>
        public void ResetConnection()
        {
            try { _http?.Dispose(); } catch { /* nepodstatné */ }
            try
            {
                ServicePoint sp = ServicePointManager.FindServicePoint(new Uri(_cfg.BackendUrl));
                sp.CloseConnectionGroup(null); // zavři otevřené keep-alive sokety
            }
            catch { /* nepodstatné */ }
            BuildHttpClient();
        }

        private void BuildHttpClient()
        {
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _cfg.IngestToken);
        }

        /// <summary>Pošle dávku JSON řádků intervalů. Vrací true při úspěchu (HTTP 2xx).</summary>
        public async Task<bool> SendBatchAsync(List<string> intervalJsonLines)
        {
            if (intervalJsonLines.Count == 0) return true;

            StringBuilder sb = new StringBuilder();
            sb.Append('{').Append(_devicePart).Append(',').Append(_userPart).Append(',');
            sb.Append("\"intervals\":[");
            for (int i = 0; i < intervalJsonLines.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append(intervalJsonLines[i]);
            }
            sb.Append("]}");

            try
            {
                // GZip – JSON se komprimuje řádově 5–10×, šetří přenos po síti.
                // Backend (body-parser) gzip požadavky transparentně dekomprimuje.
                byte[] gz = Gzip(sb.ToString());
                using (ByteArrayContent content = new ByteArrayContent(gz))
                {
                    content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
                    content.Headers.ContentEncoding.Add("gzip");
                    using (HttpResponseMessage resp = await _http.PostAsync(_cfg.BackendUrl + "/api/v1/ingest", content))
                    {
                        if (!resp.IsSuccessStatusCode) return false;
                        try
                        {
                            string body = await resp.Content.ReadAsStringAsync();
                            LastEmployeeReportEnabled = body.IndexOf("\"employeeReportEnabled\":true", StringComparison.Ordinal) >= 0;
                        }
                        catch { /* nepodstatné pro úspěch odeslání */ }
                        return true;
                    }
                }
            }
            catch
            {
                return false; // síťová chyba – necháme v bufferu na příště
            }
        }

        /// <summary>Vyžádá krátkodobý odkaz na report pro přihlášeného uživatele (vázaný na jeho SID).</summary>
        public async Task<string> RequestSelfTokenAsync()
        {
            try
            {
                string payload = "{\"sid\":" + Json.Str(MachineIdentity.UserSid()) + "}";
                using (StringContent content = new StringContent(payload, Encoding.UTF8, "application/json"))
                using (HttpResponseMessage resp = await _http.PostAsync(_cfg.BackendUrl + "/api/v1/self/token", content))
                {
                    if (!resp.IsSuccessStatusCode) return null;
                    string body = await resp.Content.ReadAsStringAsync();
                    const string key = "\"token\":\"";
                    int i = body.IndexOf(key, StringComparison.Ordinal);
                    if (i < 0) return null;
                    i += key.Length;
                    int j = body.IndexOf('"', i);
                    return j > i ? body.Substring(i, j - i) : null;
                }
            }
            catch
            {
                return null;
            }
        }

        private static byte[] Gzip(string json)
        {
            byte[] raw = Encoding.UTF8.GetBytes(json);
            using (MemoryStream ms = new MemoryStream())
            {
                using (GZipStream gzip = new GZipStream(ms, CompressionMode.Compress, true))
                {
                    gzip.Write(raw, 0, raw.Length);
                }
                return ms.ToArray();
            }
        }
    }
}
