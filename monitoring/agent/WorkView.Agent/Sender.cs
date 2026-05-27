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
            // TLS 1.2/1.3 i na starších .NET Framework / Windows.
            // ServerCertificateValidationCallback záměrně NEPŘEPISUJEME – ponecháváme
            // výchozí validaci proti systémovému trust store. Bez tohohle komentáře by
            // některý security audit (oprávněně) ohlásil "chybí explicitní TLS check".
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
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
            // Auth token: preferujeme per-device token (vznikl enrollmentem),
            // jinak fallback na sdílený INGEST_TOKEN z konfigurace agenta.
            string activeToken = string.IsNullOrEmpty(_cfg.DeviceToken) ? _cfg.IngestToken : _cfg.DeviceToken;
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", activeToken);
        }

        /// <summary>
        /// Při prvním běhu (nebo po revokaci) si agent vyžádá per-device token.
        /// Autentizuje se SDÍLENÝM INGEST_TOKEN, server vrátí jedinečný token,
        /// který se uloží do HKLM\SOFTWARE\WorkView\DeviceToken a používá pro
        /// všechny další /ingest dotazy. Únik tokenu z jednoho PC tak nezpřístupní
        /// data ostatních strojů (per-device izolace).
        /// </summary>
        public async Task<string> RequestDeviceTokenAsync()
        {
            try
            {
                // Pro /enroll musíme dočasně použít sdílený token, ne per-device.
                using (HttpClient enrollHttp = new HttpClient { Timeout = TimeSpan.FromSeconds(30) })
                {
                    enrollHttp.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _cfg.IngestToken);
                    string body = "{" + "\"machineId\":" + Json.Str(MachineIdentity.MachineId()) + "," +
                                  "\"hostname\":" + Json.Str(MachineIdentity.Hostname()) + "," +
                                  "\"os\":" + Json.Str(MachineIdentity.OsName()) + "," +
                                  "\"agentVersion\":" + Json.Str(AgentInfo.Version) + "}";
                    using (StringContent content = new StringContent(body, Encoding.UTF8, "application/json"))
                    using (HttpResponseMessage resp = await enrollHttp.PostAsync(_cfg.BackendUrl + "/api/v1/ingest/enroll", content))
                    {
                        if (!resp.IsSuccessStatusCode)
                        {
                            AgentLog.Write("ENROLL FAILED " + (int)resp.StatusCode);
                            return null;
                        }
                        string respBody = await resp.Content.ReadAsStringAsync();
                        // Minimalistický JSON parse na "deviceToken":"…"
                        int i = respBody.IndexOf("\"deviceToken\"", StringComparison.OrdinalIgnoreCase);
                        if (i < 0) return null;
                        int q1 = respBody.IndexOf('"', i + 13 + 1);
                        int q2 = respBody.IndexOf('"', q1 + 1);
                        if (q1 < 0 || q2 < 0) return null;
                        string token = respBody.Substring(q1 + 1, q2 - q1 - 1);
                        AgentLog.Write("ENROLL OK – získán per-device token (délka " + token.Length + ")");
                        return token;
                    }
                }
            }
            catch (Exception ex)
            {
                AgentLog.Write("ENROLL EXCEPTION " + ex.Message);
                return null;
            }
        }

        /// <summary>Po enrollmentu se odpoví novým tokenem – HttpClient přebuduje s ním. </summary>
        public void UpdateDeviceToken(string deviceToken)
        {
            _cfg.SetDeviceToken(deviceToken);
            try { _http?.Dispose(); } catch { /* nepodstatné */ }
            BuildHttpClient();
        }

        /// <summary>Pošle dávku JSON řádků intervalů. Vrací true při úspěchu (HTTP 2xx).</summary>
        /// <remarks>
        /// Když je seznam prázdný, pošleme „heartbeat" (prázdná dávka). Server ji
        /// akceptuje a založí v DB device + user. Díky tomu se zařízení objeví
        /// v dashboardu ihned po prvním zavolání agenta, ne až po prvním 60s
        /// intervalu aktivity.
        /// </remarks>
        public async Task<bool> SendBatchAsync(List<string> intervalJsonLines)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append('{').Append(_devicePart).Append(',').Append(_userPart).Append(',');
            sb.Append("\"intervals\":[");
            for (int i = 0; i < intervalJsonLines.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append(intervalJsonLines[i]);
            }
            sb.Append(']');
            // Přibal posbíraný log agenta – server ho zobrazí v dashboardu
            // (IT pohled → detail PC → Log agenta), takže operátor nemusí lézt
            // na klientské PC číst soubor agent.log.
            string logJson = AgentLog.DrainAsJsonArray();
            if (logJson != null)
            {
                sb.Append(",\"agentLog\":").Append(logJson);
            }
            sb.Append('}');

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
                        if (!resp.IsSuccessStatusCode)
                        {
                            string err = null;
                            try { err = await resp.Content.ReadAsStringAsync(); } catch { /* nepodstatné */ }
                            AgentLog.Write("INGEST FAILED HTTP " + (int)resp.StatusCode + " body=" + (err ?? ""));
                            return false;
                        }
                        try
                        {
                            string body = await resp.Content.ReadAsStringAsync();
                            LastEmployeeReportEnabled = body.IndexOf("\"employeeReportEnabled\":true", StringComparison.Ordinal) >= 0;
                        }
                        catch { /* nepodstatné pro úspěch odeslání */ }
                        AgentLog.Write("INGEST OK n=" + intervalJsonLines.Count + " (employeeReport=" + LastEmployeeReportEnabled + ")");
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                AgentLog.Write("INGEST EXCEPTION " + ex.GetType().Name + ": " + ex.Message + " (url=" + _cfg.BackendUrl + ")");
                return false;
            }
        }

        /// <summary>Odešle HW snapshot na backend (POST /api/v1/ingest/health). Volá se ~1x za hodinu.</summary>
        public async Task<bool> SendHealthAsync(string healthJson)
        {
            try
            {
                byte[] gz = Gzip(healthJson);
                using (ByteArrayContent content = new ByteArrayContent(gz))
                {
                    content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
                    content.Headers.ContentEncoding.Add("gzip");
                    using (HttpResponseMessage resp = await _http.PostAsync(_cfg.BackendUrl + "/api/v1/ingest/health", content))
                    {
                        if (!resp.IsSuccessStatusCode)
                        {
                            string err = null;
                            try { err = await resp.Content.ReadAsStringAsync(); } catch { /* nepodstatné */ }
                            AgentLog.Write("HEALTH FAILED HTTP " + (int)resp.StatusCode + " body=" + (err ?? ""));
                            return false;
                        }
                        AgentLog.Write("HEALTH OK");
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                AgentLog.Write("HEALTH EXCEPTION " + ex.GetType().Name + ": " + ex.Message);
                return false;
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
