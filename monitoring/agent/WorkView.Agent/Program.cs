using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace WorkView.Agent
{
    /// <summary>
    /// Vstupní bod agenta. Běží tiše na pozadí v interaktivní session uživatele
    /// (bez okna a bez ikony v liště). Potřebuje message loop kvůli nízkoúrovňovým
    /// hookům a notifikacím o uzamčení session.
    ///
    /// Transparentnost dle §316 ZP je zajištěna PÍSEMNÝM poučením zaměstnanců
    /// (viz docs/monitoring/pravni), nikoli běhovou ikonou.
    /// </summary>
    internal static class Program
    {
        private static volatile bool _sessionLocked;
        private static LocalBuffer _buffer;
        private static Sender _sender;
        private static AgentConfig _cfg;
        private static bool _sending;
        private static NotifyIcon _tray; // vytvořena eagerně na UI thready, jen se přepíná Visible
        private static System.Threading.SynchronizationContext _uiSync; // marshalování z background tasků
        private static bool _trayWasVisible; // detekce přechodu false→true pro toast notifikaci

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
                    // Bez konfigurace nemá smysl běžet. Tiše zaloguj a skonči (žádný pop-up).
                    AgentLog.Write("Chybí/špatná konfigurace: " + ex.Message);
                    return;
                }

                // Nízká priorita – agent nikdy nesoupeří o CPU s prací uživatele.
                try { System.Diagnostics.Process.GetCurrentProcess().PriorityClass = System.Diagnostics.ProcessPriorityClass.BelowNormal; }
                catch { /* nepodstatné, pokračuj */ }

                _cfg = cfg;
                _buffer = new LocalBuffer();
                _sender = new Sender(cfg);
                AgentLog.Write("Agent startup OK, sending to " + cfg.BackendUrl + ", interval=" + cfg.IntervalSeconds + "s, send=" + cfg.SendIntervalSeconds + "s");

                using (InputCounters input = new InputCounters())
                using (ActivityTracker tracker = new ActivityTracker(input, _buffer, cfg.IntervalSeconds, () => _sessionLocked, cfg.CaptureWindowTitle, cfg.IdleThresholdSeconds))
                {
                    input.Install();
                    tracker.Start();

                    // Inicializuj WinForms message loop (nutné pro NotifyIcon) + zachytí
                    // SynchronizationContext UI threadu, abychom mohli z background tasků
                    // bezpečně marshalovat update tray ikonky.
                    System.Windows.Forms.WindowsFormsSynchronizationContext.AutoInstall = false;
                    System.Threading.SynchronizationContext.SetSynchronizationContext(new System.Windows.Forms.WindowsFormsSynchronizationContext());
                    _uiSync = System.Threading.SynchronizationContext.Current;

                    // Tray ikonka se vytvoří JEDNOU na UI thready (skrytá). Pak se jen
                    // přepíná Visible podle nastavení ze serveru. Tím se zaručí, že její
                    // skrytý okno-handle žije na UI thready a kliky / kontextové menu
                    // skutečně fungují (jinak by ikonka mohla být "mrtvá").
                    _tray = new NotifyIcon
                    {
                        Icon = System.Drawing.SystemIcons.Information,
                        Text = "FOCUS – můj report práce",
                        Visible = false,
                    };
                    ContextMenuStrip trayMenu = new ContextMenuStrip();
                    trayMenu.Items.Add("Otevřít můj report", null, async (s, e) => await OpenReportAsync());
                    _tray.ContextMenuStrip = trayMenu;
                    _tray.DoubleClick += async (s, e) => await OpenReportAsync();
                    _tray.BalloonTipClicked += async (s, e) => await OpenReportAsync();

                    SystemEvents.SessionSwitch += OnSessionSwitch;
                    SystemEvents.PowerModeChanged += OnPowerModeChanged;

                    // Hned po startu pošli heartbeat (prázdná dávka). Tím se zařízení
                    // i uživatel zaregistrují v dashboardu IHNED, ne až po prvních
                    // 60 sekundách aktivity. Pokud heartbeat selže (síť/token),
                    // chyba se zaloguje a další pokus bude přes sendTimer.
                    _ = System.Threading.Tasks.Task.Run(async () =>
                    {
                        try { await _sender.SendBatchAsync(new System.Collections.Generic.List<string>()); UpdateTray(); }
                        catch (Exception ex) { AgentLog.Write("Heartbeat exception: " + ex.Message); }
                    });

                    // HW snapshot na pozadí: 1× při startu (po 30 s, ať si DHCP/síť sedne)
                    // a pak každou hodinu. WMI dotazy dohromady běží desítky až stovky ms
                    // jen 1× za hodinu → na CPU agenta naprosto nezbytné.
                    _ = System.Threading.Tasks.Task.Run(async () =>
                    {
                        await System.Threading.Tasks.Task.Delay(30_000);
                        while (true)
                        {
                            try
                            {
                                string json = HealthCollector.BuildJson();
                                await _sender.SendHealthAsync(json);
                            }
                            catch (Exception ex) { AgentLog.Write("Health collector exception: " + ex.Message); }
                            await System.Threading.Tasks.Task.Delay(60 * 60 * 1000); // 1 hodina
                        }
                    });

                    // Odesílání dávek v konfigurovatelném intervalu (výchozí 15 minut).
                    // Mezitím se data hromadí v lokálním bufferu (přežijí restart i výpadek sítě).
                    System.Windows.Forms.Timer sendTimer = new System.Windows.Forms.Timer { Interval = cfg.SendIntervalSeconds * 1000 };
                    sendTimer.Tick += async (s, e) => { await TrySendAsync(); UpdateTray(); };
                    sendTimer.Start();

                    Application.ApplicationExit += (s, e) =>
                    {
                        SystemEvents.SessionSwitch -= OnSessionSwitch;
                        SystemEvents.PowerModeChanged -= OnPowerModeChanged;
                        sendTimer.Stop();
                        if (_tray != null) { _tray.Visible = false; _tray.Dispose(); _tray = null; }
                    };

                    Application.Run();
                }
            }
        }

        /// <summary>
        /// Zobrazí/skryje ikonku reportu v liště podle přepínače z administrace.
        /// Bezpečně marshaluje na UI thready – volá se i z background tasků
        /// (sendTimer.Tick je UI, ale heartbeat task běží na thread-pool).
        /// </summary>
        private static void UpdateTray()
        {
            if (_tray == null || _uiSync == null) return;
            bool on = _sender != null && _sender.LastEmployeeReportEnabled;
            _uiSync.Post(_ =>
            {
                try
                {
                    if (_tray == null) return;
                    if (on && !_trayWasVisible)
                    {
                        _tray.Visible = true;
                        _trayWasVisible = true;
                        // Windows 11 schovává nové tray ikonky do overflow. Toast je vždy viditelný.
                        _tray.BalloonTipTitle = "FOCUS";
                        _tray.BalloonTipText = "Tvůj osobní report je teď přístupný. Klikni na tuhle bublinu nebo na ikonku v liště (vpravo dole, případně klikni na šipku ↑).";
                        try { _tray.ShowBalloonTip(10_000); } catch { /* nepodstatné */ }
                        AgentLog.Write("Tray icon shown (employeeReportEnabled=true)");
                    }
                    else if (!on && _trayWasVisible)
                    {
                        _tray.Visible = false;
                        _trayWasVisible = false;
                        AgentLog.Write("Tray icon hidden (employeeReportEnabled=false)");
                    }
                }
                catch (Exception ex) { AgentLog.Write("UpdateTray exception: " + ex.Message); }
            }, null);
        }

        private static async System.Threading.Tasks.Task OpenReportAsync()
        {
            try
            {
                string token = await _sender.RequestSelfTokenAsync();
                if (string.IsNullOrEmpty(token)) return;
                // Fragment (#) místo query (?) – token se NEPOSÍLÁ na server, neukáže
                // se v access-logu, refereru ani v back-end logu reverzní proxy.
                // Frontend ho čte z URL hashe, uloží do sessionStorage a hash okamžitě
                // odstraní (history.replaceState), takže nezůstává v historii prohlížeče.
                string url = _cfg.BackendUrl + "/#selfToken=" + Uri.EscapeDataString(token);
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch { /* nepodstatné */ }
        }

        private static void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            if (e.Reason == SessionSwitchReason.SessionLock || e.Reason == SessionSwitchReason.SessionLogoff)
                _sessionLocked = true;
            else if (e.Reason == SessionSwitchReason.SessionUnlock || e.Reason == SessionSwitchReason.SessionLogon)
                _sessionLocked = false;
        }

        /// <summary>
        /// Reaguje na uspání / probuzení Windows. Po probuzení (Resume) zahodí
        /// stará HTTP spojení a hned se pokusí odeslat data, která se nashromáždila
        /// v bufferu, případně dorovná chvilku po probuzení sítě.
        ///
        /// Bez tohoto handleru proces po vícedenním spánku „mlčí" – běží, ale jeho
        /// keep-alive sokety jsou mrtvé a žádné retry je nezachrání.
        /// </summary>
        private static async void OnPowerModeChanged(object sender, PowerModeChangedEventArgs e)
        {
            if (e.Mode != PowerModes.Resume) return;
            try
            {
                AgentLog.Write("PowerMode=Resume → resetuji HTTP klienta a posílám buffer");
                _sender?.ResetConnection();
                // Pár sekund na obnovu wifi / DHCP / DNS po probuzení.
                await System.Threading.Tasks.Task.Delay(5000);
                await TrySendAsync();
                UpdateTray();
            }
            catch (Exception ex)
            {
                AgentLog.Write("Resume handler selhal: " + ex.Message);
            }
        }

        private static async System.Threading.Tasks.Task TrySendAsync()
        {
            if (_sending) return;
            // Když je zapnuté „jen z firemní sítě" a nejsme v ní, nech data v bufferu.
            if (_cfg.CompanyNetworkOnly && !NetworkGuard.OnCompanyNetwork(_cfg.CompanyProbeHost)) return;
            _sending = true;
            try
            {
                // Pošli po dávkách max 500 záznamů, dokud je co posílat.
                bool sentAnything = false;
                while (true)
                {
                    List<string> batch = _buffer.Peek(500);
                    if (batch.Count == 0) break;
                    bool ok = await _sender.SendBatchAsync(batch);
                    if (!ok) break; // necháme v bufferu na další pokus
                    _buffer.Commit(batch.Count);
                    sentAnything = true;
                    if (batch.Count < 500) break;
                }
                // Když není co posílat, udělej heartbeat (prázdná dávka). Tím se zároveň
                // vyprázdní in-memory log agenta do dashboardu a obnoví se lastSeen –
                // takže administrátor v UI vidí aktuální stav i tehdy, kdy uživatel
                // momentálně nepracuje (např. session locked, oběd, schůzka).
                if (!sentAnything)
                {
                    await _sender.SendBatchAsync(new List<string>());
                }
            }
            finally
            {
                _sending = false;
            }
        }
    }
}
