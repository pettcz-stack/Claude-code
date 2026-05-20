using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace WorkView.Agent
{
    /// <summary>
    /// Vstupní bod agenta. Běží v interaktivní session přihlášeného uživatele
    /// (spouští se přes Scheduled Task při logon). Potřebuje message loop kvůli
    /// nízkoúrovňovým hookům a notifikacím o uzamčení session.
    ///
    /// TRANSPARENTNOST (§316 ZP): agent zobrazuje ikonu v oznamovací oblasti
    /// se sdělením, že je počítač monitorován. Žádné skryté sledování.
    /// </summary>
    internal static class Program
    {
        private static volatile bool _sessionLocked;
        private static LocalBuffer _buffer;
        private static Sender _sender;
        private static bool _sending;

        [STAThread]
        private static void Main()
        {
            // Jedna instance na uživatelskou session.
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "WorkViewAgent_" + Environment.UserName, out createdNew))
            {
                if (!createdNew) return;

                AgentConfig cfg;
                try
                {
                    cfg = AgentConfig.Load();
                }
                catch (Exception ex)
                {
                    // Bez konfigurace nemá smysl běžet. (V provozu plní MSI/GPO.)
                    MessageBox.Show("WorkView agent: chybí konfigurace.\n" + ex.Message,
                        "WorkView", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                Application.EnableVisualStyles();

                _buffer = new LocalBuffer();
                _sender = new Sender(cfg);

                using (InputCounters input = new InputCounters())
                using (ActivityTracker tracker = new ActivityTracker(input, _buffer, cfg.IntervalSeconds, () => _sessionLocked, cfg.CaptureWindowTitle, cfg.IdleThresholdSeconds))
                using (NotifyIcon tray = CreateTrayIcon(cfg.CaptureWindowTitle))
                {
                    input.Install();
                    tracker.Start();

                    SystemEvents.SessionSwitch += OnSessionSwitch;

                    // Odesílací smyčka – každých 30 s zkusí odeslat nasbírané dávky.
                    // Odesílání dávek jednou za 5 minut (mezitím se data bufferují lokálně).
                    Timer sendTimer = new Timer { Interval = 5 * 60 * 1000 };
                    sendTimer.Tick += async (s, e) => await TrySendAsync();
                    sendTimer.Start();

                    Application.ApplicationExit += (s, e) =>
                    {
                        SystemEvents.SessionSwitch -= OnSessionSwitch;
                        sendTimer.Stop();
                    };

                    Application.Run();
                }
            }
        }

        private static NotifyIcon CreateTrayIcon(bool captureTitle)
        {
            string titleLine = captureTitle
                ? " a název (titulek) aktivního okna pro rozlišení pracovní a mimopracovní činnosti"
                : "";
            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("O monitoringu…", null, (s, e) =>
                MessageBox.Show(
                    "Tento firemní počítač je monitorován nástrojem pro sledování efektivity práce.\n\n" +
                    "Sledují se: aktivní/nečinný čas, aktivní aplikace, počet úhozů a pohybů myši" +
                    titleLine + ".\n\n" +
                    "NEsledujeme: obsah psaného textu (žádné záznamy kláves), screenshoty, " +
                    "mikrofon ani kameru.\n\n" +
                    "Zpracování probíhá dle §316 zákoníku práce a interní směrnice.",
                    "Informace o monitoringu", MessageBoxButtons.OK, MessageBoxIcon.Information));

            return new NotifyIcon
            {
                Icon = SystemIcons.Information,
                Text = "WorkView – počítač je monitorován (pracovní aktivita)",
                Visible = true,
                ContextMenuStrip = menu
            };
        }

        private static void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            if (e.Reason == SessionSwitchReason.SessionLock || e.Reason == SessionSwitchReason.SessionLogoff)
                _sessionLocked = true;
            else if (e.Reason == SessionSwitchReason.SessionUnlock || e.Reason == SessionSwitchReason.SessionLogon)
                _sessionLocked = false;
        }

        private static async System.Threading.Tasks.Task TrySendAsync()
        {
            if (_sending) return;
            _sending = true;
            try
            {
                // Pošli po dávkách max 500 záznamů, dokud je co posílat.
                while (true)
                {
                    List<string> batch = _buffer.Peek(500);
                    if (batch.Count == 0) break;
                    bool ok = await _sender.SendBatchAsync(batch);
                    if (!ok) break; // necháme v bufferu na další pokus
                    _buffer.Commit(batch.Count);
                    if (batch.Count < 500) break;
                }
            }
            finally
            {
                _sending = false;
            }
        }
    }
}
