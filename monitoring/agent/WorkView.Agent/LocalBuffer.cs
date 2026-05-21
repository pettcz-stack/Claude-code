using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace WorkView.Agent
{
    /// <summary>
    /// Odolný lokální buffer (NDJSON soubor v %ProgramData%\WorkView).
    /// Při výpadku sítě / mimo firemní síť se záznamy hromadí lokálně (přežijí
    /// restart agenta i reboot PC) a po připojení se odešlou všechny.
    ///
    /// Zápisy jsou proudové (nečte se celý soubor do paměti) a Commit je ATOMICKÝ
    /// (zápis do .tmp + File.Replace), takže ani pád/odpojení v průběhu nepoškodí
    /// frontu. Spolu s idempotentním ingestem (unikát device+user+intervalStart)
    /// to dává jistotu: nahromaděná data za libovolně dlouhou dobu se nahrají
    /// kompletně a bez duplicit.
    /// </summary>
    internal sealed class LocalBuffer
    {
        private readonly object _lock = new object();
        private readonly string _path;
        private readonly string _tmpPath;

        public LocalBuffer()
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkView");
            Directory.CreateDirectory(dir);
            _path = Path.Combine(dir, "spool.ndjson");
            _tmpPath = _path + ".tmp";
        }

        public void Enqueue(string jsonLine)
        {
            lock (_lock)
            {
                // UTF-8 bez BOM, oddělovač "\n" (kompatibilní napříč platformami).
                File.AppendAllText(_path, jsonLine + "\n", new UTF8Encoding(false));
            }
        }

        /// <summary>Načte až <paramref name="max"/> nejstarších řádků (proudově, bez čtení celého souboru).</summary>
        public List<string> Peek(int max)
        {
            lock (_lock)
            {
                List<string> result = new List<string>();
                if (max <= 0 || !File.Exists(_path)) return result;
                using (StreamReader reader = new StreamReader(_path, Encoding.UTF8))
                {
                    string line;
                    while (result.Count < max && (line = reader.ReadLine()) != null)
                    {
                        if (line.Length == 0) continue;
                        result.Add(line);
                    }
                }
                return result;
            }
        }

        /// <summary>
        /// Odebere prvních <paramref name="count"/> řádků (po úspěšném odeslání).
        /// Atomicky: zbytek se zapíše do .tmp a ten nahradí původní soubor.
        /// </summary>
        public void Commit(int count)
        {
            lock (_lock)
            {
                if (count <= 0 || !File.Exists(_path)) return;
                int skipped = 0;
                bool wroteAny = false;
                using (StreamReader reader = new StreamReader(_path, Encoding.UTF8))
                using (StreamWriter writer = new StreamWriter(_tmpPath, false, new UTF8Encoding(false)) { NewLine = "\n" })
                {
                    string line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        if (line.Length == 0) continue;
                        if (skipped < count) { skipped++; continue; }
                        writer.WriteLine(line);
                        wroteAny = true;
                    }
                }
                // Atomická výměna – buď platí starý, nebo nový obsah, nikdy půlka.
                // Když selže, originál zůstane nedotčený → dávka se prostě pošle
                // znovu (ingest je idempotentní). Nikdy nesmíme shodit agenta.
                try
                {
                    File.Replace(_tmpPath, _path, null);
                }
                catch
                {
                    return;
                }
                if (!wroteAny)
                {
                    // Prázdná fronta – ať nezůstává nulový soubor zbytečně.
                    try { File.Delete(_path); } catch { /* nepodstatné */ }
                }
            }
        }

        public int Count()
        {
            lock (_lock)
            {
                if (!File.Exists(_path)) return 0;
                int n = 0;
                using (StreamReader reader = new StreamReader(_path, Encoding.UTF8))
                {
                    string line;
                    while ((line = reader.ReadLine()) != null) if (line.Length > 0) n++;
                }
                return n;
            }
        }
    }
}
