using System;
using System.Collections.Generic;
using System.IO;

namespace WorkView.Agent
{
    /// <summary>
    /// Odolný lokální buffer (NDJSON soubor v %ProgramData%\WorkView).
    /// Při výpadku sítě se záznamy hromadí lokálně a odešlou později.
    /// </summary>
    internal sealed class LocalBuffer
    {
        private readonly object _lock = new object();
        private readonly string _path;

        public LocalBuffer()
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkView");
            Directory.CreateDirectory(dir);
            _path = Path.Combine(dir, "spool.ndjson");
        }

        public void Enqueue(string jsonLine)
        {
            lock (_lock)
            {
                File.AppendAllText(_path, jsonLine + "\n");
            }
        }

        /// <summary>Načte až <paramref name="max"/> řádků (nejstarší první).</summary>
        public List<string> Peek(int max)
        {
            lock (_lock)
            {
                List<string> result = new List<string>();
                if (!File.Exists(_path)) return result;
                foreach (string line in File.ReadAllLines(_path))
                {
                    if (line.Length == 0) continue;
                    result.Add(line);
                    if (result.Count >= max) break;
                }
                return result;
            }
        }

        /// <summary>Odebere prvních <paramref name="count"/> řádků (po úspěšném odeslání).</summary>
        public void Commit(int count)
        {
            lock (_lock)
            {
                if (!File.Exists(_path)) return;
                List<string> all = new List<string>(File.ReadAllLines(_path));
                int remove = Math.Min(count, all.Count);
                all.RemoveRange(0, remove);
                File.WriteAllLines(_path, all);
            }
        }

        public int Count()
        {
            lock (_lock)
            {
                if (!File.Exists(_path)) return 0;
                int n = 0;
                foreach (string line in File.ReadAllLines(_path)) if (line.Length > 0) n++;
                return n;
            }
        }
    }
}
