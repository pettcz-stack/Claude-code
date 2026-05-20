using System;
using System.Collections.Generic;
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
        private readonly HttpClient _http;
        private readonly string _devicePart;
        private readonly string _userPart;

        public Sender(AgentConfig cfg)
        {
            _cfg = cfg;
            // TLS 1.2 i na starších .NET Framework / Windows.
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", cfg.IngestToken);

            _devicePart = "\"device\":{" +
                "\"machineId\":" + Json.Str(MachineIdentity.MachineId()) + "," +
                "\"hostname\":" + Json.Str(MachineIdentity.Hostname()) + "," +
                "\"os\":" + Json.Str(MachineIdentity.OsName()) + "," +
                "\"agentVersion\":" + Json.Str(AgentInfo.Version) + "}";
            _userPart = "\"user\":{" +
                "\"sid\":" + Json.Str(MachineIdentity.UserSid()) + "," +
                "\"displayName\":" + Json.Str(MachineIdentity.UserDisplayName()) + "}";
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
                using (StringContent content = new StringContent(sb.ToString(), Encoding.UTF8, "application/json"))
                using (HttpResponseMessage resp = await _http.PostAsync(_cfg.BackendUrl + "/api/v1/ingest", content))
                {
                    return resp.IsSuccessStatusCode;
                }
            }
            catch
            {
                return false; // síťová chyba – necháme v bufferu na příště
            }
        }
    }
}
