using System;
using System.Diagnostics;
using System.Threading;

namespace WorkView.Agent
{
    /// <summary>
    /// Globální nízkoúrovňové hooky klávesnice a myši. Pouze POČÍTAJÍ události.
    /// Záměrně NEčtou kód klávesy ani souřadnice – jediný stav jsou dva čítače.
    /// Pohyb myši je throttlovaný (max 1 započtení / 100 ms), aby WM_MOUSEMOVE
    /// nezahltil čítač.
    /// </summary>
    internal sealed class InputCounters : IDisposable
    {
        private IntPtr _kbHook = IntPtr.Zero;
        private IntPtr _mouseHook = IntPtr.Zero;

        // Delegáty drženy jako pole, aby je GC neuvolnil za běhu hooku.
        private readonly NativeMethods.LowLevelHookProc _kbProc;
        private readonly NativeMethods.LowLevelHookProc _mouseProc;

        private long _keystrokes;
        private long _mouseEvents;
        private int _lastMouseMoveTick;

        public InputCounters()
        {
            _kbProc = KeyboardProc;
            _mouseProc = MouseProc;
        }

        public void Install()
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                IntPtr hMod = NativeMethods.GetModuleHandle(curModule.ModuleName);
                _kbHook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_KEYBOARD_LL, _kbProc, hMod, 0);
                _mouseHook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_MOUSE_LL, _mouseProc, hMod, 0);
            }
        }

        private IntPtr KeyboardProc(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                if (msg == NativeMethods.WM_KEYDOWN || msg == NativeMethods.WM_SYSKEYDOWN)
                {
                    // POUZE inkrement. Obsah lParam (kód klávesy) se ZÁMĚRNĚ nečte.
                    Interlocked.Increment(ref _keystrokes);
                }
            }
            return NativeMethods.CallNextHookEx(_kbHook, nCode, wParam, lParam);
        }

        private IntPtr MouseProc(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                if (msg == NativeMethods.WM_MOUSEMOVE)
                {
                    int now = Environment.TickCount;
                    if (now - _lastMouseMoveTick >= 100)
                    {
                        _lastMouseMoveTick = now;
                        Interlocked.Increment(ref _mouseEvents);
                    }
                }
                else if (msg == NativeMethods.WM_LBUTTONDOWN || msg == NativeMethods.WM_RBUTTONDOWN ||
                         msg == NativeMethods.WM_MBUTTONDOWN || msg == NativeMethods.WM_MOUSEWHEEL)
                {
                    Interlocked.Increment(ref _mouseEvents);
                }
            }
            return NativeMethods.CallNextHookEx(_mouseHook, nCode, wParam, lParam);
        }

        /// <summary>Vrátí aktuální čítače a vynuluje je (atomicky).</summary>
        public void TakeAndReset(out long keystrokes, out long mouseEvents)
        {
            keystrokes = Interlocked.Exchange(ref _keystrokes, 0);
            mouseEvents = Interlocked.Exchange(ref _mouseEvents, 0);
        }

        public void Dispose()
        {
            if (_kbHook != IntPtr.Zero) { NativeMethods.UnhookWindowsHookEx(_kbHook); _kbHook = IntPtr.Zero; }
            if (_mouseHook != IntPtr.Zero) { NativeMethods.UnhookWindowsHookEx(_mouseHook); _mouseHook = IntPtr.Zero; }
        }
    }
}
