using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace WorkView.Agent
{
    /// <summary>
    /// Zapisovač do %ProgramData%\WorkView\agent.log A SOUČASNĚ do paměťového
    /// ring bufferu, který agent posílá v dalším /ingest dávce do dashboardu
    /// (sekce „Log agenta" v IT pohledu). Operátor tak vidí všechno z prohlížeče
    /// a nemusí lézt na klientské PC.
    /// </summary>
    internal static class AgentLog
    {
        private static readonly object _lock = new object();
        private const int MAX_BUFFER = 200;
        // Maximální velikost agent.log na disku. Při překročení se zrotuje na
        // agent.log.1 (přepsání předchozího) a začne se nový agent.log.
        // 1 MiB stačí pro několik dní debug výstupu; bez rotace by soubor rostl
        // donekonečna a zůstal by na disku i po vyřazení PC (data leak).
        private const long MAX_LOG_BYTES = 1024L * 1024L;
        private static readonly Queue<LogEntry> _buffer = new Queue<LogEntry>(MAX_BUFFER);

        public sealed class LogEntry
        {
            public string Ts;       // ISO 8601 UTC
            public string Message;
        }

        public static void Write(string message)
        {
            string ts = DateTime.UtcNow.ToString("o");
            // Soubor (best-effort) + rotace, když překročí limit.
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkView");
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "agent.log");
                FileInfo fi = new FileInfo(path);
                if (fi.Exists && fi.Length > MAX_LOG_BYTES)
                {
                    string old = path + ".1";
                    try { if (File.Exists(old)) File.Delete(old); } catch { }
                    try { File.Move(path, old); } catch { }
                }
                File.AppendAllText(path, ts + "\t" + message + "\n");
            }
            catch { /* logování nesmí shodit agenta */ }
            // Buffer pro odeslání do dashboardu
            lock (_lock)
            {
                if (_buffer.Count >= MAX_BUFFER) _buffer.Dequeue();
                _buffer.Enqueue(new LogEntry { Ts = ts, Message = message });
            }
        }

        /// <summary>Vrátí všechny nasbírané záznamy a vyprázdní buffer.</summary>
        public static List<LogEntry> Drain()
        {
            lock (_lock)
            {
                List<LogEntry> snap = new List<LogEntry>(_buffer);
                _buffer.Clear();
                return snap;
            }
        }

        /// <summary>JSON pole připravené pro odeslání v /ingest dávce.</summary>
        public static string DrainAsJsonArray()
        {
            List<LogEntry> entries = Drain();
            if (entries.Count == 0) return null;
            StringBuilder sb = new StringBuilder();
            sb.Append('[');
            for (int i = 0; i < entries.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('{');
                sb.Append("\"ts\":").Append(Json.Str(entries[i].Ts)).Append(',');
                sb.Append("\"message\":").Append(Json.Str(entries[i].Message));
                sb.Append('}');
            }
            sb.Append(']');
            return sb.ToString();
        }
    }
}
