using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Threading;

namespace WorkView.Agent
{
    /// <summary>
    /// Každou sekundu vzorkuje stav (aktivní/nečinný/zamčeno + aktivní aplikace).
    /// Po uplynutí intervalu sestaví agregovaný IntervalRecord a uloží do bufferu.
    ///
    /// Sbírá POUZE: aktivní/idle/locked sekundy, název aktivní aplikace (bez titulku),
    /// počty úhozů a myších událostí. Žádný obsah.
    /// </summary>
    internal sealed class ActivityTracker : IDisposable
    {
        // Bez vstupu (myš/klávesnice/přepnutí okna) déle než tento práce = nečinnost.
        // Výchozí 5 minut – člověk je „u PC" dokud do 5 min něco neudělá.
        private readonly int _idleThresholdMs;

        private readonly InputCounters _input;
        private readonly LocalBuffer _buffer;
        private readonly int _intervalSeconds;
        private readonly Func<bool> _isLocked;
        private readonly bool _captureTitle;

        private Timer _ticker;
        private readonly object _lock = new object();

        private DateTime _intervalStartUtc;
        private int _elapsedSeconds;
        private int _activeSeconds;
        private int _idleSeconds;
        private int _lockedSeconds;
        // Cache aktivní aplikace dle okna – proces zjišťujeme jen při ZMĚNĚ okna
        // (drahá operace), ne každou sekundu. Šetří CPU.
        private IntPtr _lastHwnd = IntPtr.Zero;
        private string _cachedApp;
        private readonly Dictionary<string, int> _appSeconds = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> _titleSeconds = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        public ActivityTracker(InputCounters input, LocalBuffer buffer, int intervalSeconds, Func<bool> isLocked, bool captureTitle, int idleThresholdSeconds)
        {
            _input = input;
            _buffer = buffer;
            _intervalSeconds = intervalSeconds;
            _isLocked = isLocked;
            _captureTitle = captureTitle;
            _idleThresholdMs = Math.Max(1, idleThresholdSeconds) * 1000;
            _intervalStartUtc = DateTime.UtcNow;
        }

        public void Start()
        {
            _ticker = new Timer(OnTick, null, 1000, 1000);
        }

        private void OnTick(object state)
        {
            lock (_lock)
            {
                bool locked = SafeIsLocked();
                if (locked)
                {
                    _lockedSeconds++;
                }
                else if (GetIdleMs() < _idleThresholdMs)
                {
                    _activeSeconds++;
                    IntPtr hwnd = NativeMethods.GetForegroundWindow();
                    if (hwnd != _lastHwnd)
                    {
                        _lastHwnd = hwnd;
                        _cachedApp = ResolveApp(hwnd); // drahé jen při změně okna
                    }
                    if (_cachedApp != null)
                    {
                        int c;
                        _appSeconds.TryGetValue(_cachedApp, out c);
                        _appSeconds[_cachedApp] = c + 1;
                    }
                    if (_captureTitle)
                    {
                        // titulek čteme i v rámci stejného okna (přepínání záložek), je to levné
                        string title = GetWindowTitle(hwnd);
                        if (!string.IsNullOrEmpty(title))
                        {
                            int tc;
                            _titleSeconds.TryGetValue(title, out tc);
                            _titleSeconds[title] = tc + 1;
                        }
                    }
                }
                else
                {
                    _idleSeconds++;
                }

                _elapsedSeconds++;
                if (_elapsedSeconds >= _intervalSeconds)
                {
                    Flush();
                }
            }
        }

        private void Flush()
        {
            long ks, mouse;
            _input.TakeAndReset(out ks, out mouse);

            string topApp = null;
            int best = -1;
            foreach (KeyValuePair<string, int> kv in _appSeconds)
            {
                if (kv.Value > best) { best = kv.Value; topApp = kv.Key; }
            }

            string topTitle = null;
            if (_captureTitle)
            {
                int bestT = -1;
                foreach (KeyValuePair<string, int> kv in _titleSeconds)
                {
                    if (kv.Value > bestT) { bestT = kv.Value; topTitle = kv.Key; }
                }
            }

            IntervalRecord rec = new IntervalRecord
            {
                IntervalStartIso = _intervalStartUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture),
                IntervalSeconds = _elapsedSeconds,
                ActiveSeconds = _activeSeconds,
                // locked sekundy spadají do "nečinnosti" + příznak SessionLocked
                IdleSeconds = _idleSeconds + _lockedSeconds,
                ForegroundApp = topApp,
                WindowTitle = topTitle,
                KeystrokeCount = ks,
                MouseEvents = mouse,
                SessionLocked = _lockedSeconds * 2 >= _elapsedSeconds
            };

            try { _buffer.Enqueue(rec.ToJson()); } catch { /* nesmí shodit ticker */ }

            // reset pro další interval
            _intervalStartUtc = DateTime.UtcNow;
            _elapsedSeconds = 0;
            _activeSeconds = 0;
            _idleSeconds = 0;
            _lockedSeconds = 0;
            _appSeconds.Clear();
            _titleSeconds.Clear();
        }

        private bool SafeIsLocked()
        {
            try { return _isLocked(); } catch { return false; }
        }

        private static int GetIdleMs()
        {
            NativeMethods.LASTINPUTINFO lii = new NativeMethods.LASTINPUTINFO();
            lii.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(lii);
            if (!NativeMethods.GetLastInputInfo(ref lii)) return 0;
            return unchecked(Environment.TickCount - (int)lii.dwTime);
        }

        private static string ResolveApp(IntPtr hwnd)
        {
            try
            {
                if (hwnd == IntPtr.Zero) return null;
                uint pid;
                NativeMethods.GetWindowThreadProcessId(hwnd, out pid);
                if (pid == 0) return null;
                // ProcessName je levné (neotevírá MainModule). Stačí "winword" → "winword.exe".
                using (Process p = Process.GetProcessById((int)pid))
                {
                    return p.ProcessName + ".exe";
                }
            }
            catch
            {
                return null;
            }
        }

        private static string GetWindowTitle(IntPtr hwnd)
        {
            try
            {
                if (hwnd == IntPtr.Zero) return null;
                int len = NativeMethods.GetWindowTextLength(hwnd);
                if (len <= 0) return null;
                var sb = new System.Text.StringBuilder(len + 1);
                NativeMethods.GetWindowText(hwnd, sb, sb.Capacity);
                string title = sb.ToString();
                // ořež na rozumnou délku
                return title.Length > 300 ? title.Substring(0, 300) : title;
            }
            catch
            {
                return null;
            }
        }

        public void Dispose()
        {
            if (_ticker != null) { _ticker.Dispose(); _ticker = null; }
        }
    }
}
