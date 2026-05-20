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
        private const int IdleThresholdMs = 2000; // bez vstupu déle než 2 s = nečinná sekunda

        private readonly InputCounters _input;
        private readonly LocalBuffer _buffer;
        private readonly int _intervalSeconds;
        private readonly Func<bool> _isLocked;

        private Timer _ticker;
        private readonly object _lock = new object();

        private DateTime _intervalStartUtc;
        private int _elapsedSeconds;
        private int _activeSeconds;
        private int _idleSeconds;
        private int _lockedSeconds;
        private readonly Dictionary<string, int> _appSeconds = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        public ActivityTracker(InputCounters input, LocalBuffer buffer, int intervalSeconds, Func<bool> isLocked)
        {
            _input = input;
            _buffer = buffer;
            _intervalSeconds = intervalSeconds;
            _isLocked = isLocked;
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
                else if (GetIdleMs() < IdleThresholdMs)
                {
                    _activeSeconds++;
                    string app = GetForegroundApp();
                    if (app != null)
                    {
                        int c;
                        _appSeconds.TryGetValue(app, out c);
                        _appSeconds[app] = c + 1;
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

            IntervalRecord rec = new IntervalRecord
            {
                IntervalStartIso = _intervalStartUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture),
                IntervalSeconds = _elapsedSeconds,
                ActiveSeconds = _activeSeconds,
                // locked sekundy spadají do "nečinnosti" + příznak SessionLocked
                IdleSeconds = _idleSeconds + _lockedSeconds,
                ForegroundApp = topApp,
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

        private static string GetForegroundApp()
        {
            try
            {
                IntPtr hwnd = NativeMethods.GetForegroundWindow();
                if (hwnd == IntPtr.Zero) return null;
                uint pid;
                NativeMethods.GetWindowThreadProcessId(hwnd, out pid);
                if (pid == 0) return null;
                using (Process p = Process.GetProcessById((int)pid))
                {
                    try
                    {
                        // Název modulu (např. "winword.exe"). Bez titulku okna kvůli soukromí.
                        return p.MainModule != null ? p.MainModule.ModuleName : (p.ProcessName + ".exe");
                    }
                    catch
                    {
                        return p.ProcessName + ".exe";
                    }
                }
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
