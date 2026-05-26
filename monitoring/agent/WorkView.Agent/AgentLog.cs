using System;
using System.IO;

namespace WorkView.Agent
{
    /// <summary>
    /// Jednoduchý zapisovač do %ProgramData%\WorkView\agent.log. Píše i normální
    /// události (start, úspěšné odeslání), ne jen chyby – diagnostika je tak
    /// jasná i bez Event Vieweru.
    /// </summary>
    internal static class AgentLog
    {
        private static readonly object _lock = new object();

        public static void Write(string message)
        {
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkView");
                Directory.CreateDirectory(dir);
                string line = $"{DateTime.UtcNow:o}\t{message}\n";
                lock (_lock)
                {
                    File.AppendAllText(Path.Combine(dir, "agent.log"), line);
                }
            }
            catch { /* logování nesmí shodit agenta */ }
        }
    }
}
