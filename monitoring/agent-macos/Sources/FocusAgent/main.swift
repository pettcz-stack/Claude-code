import Foundation
import AppKit

/// Vstupní bod FOCUS macOS agenta.
///
/// Spouští se jako launchd LaunchAgent (per-user session) – binárka leží v
/// /Library/Application Support/FOCUS/focus-agent, plist v
/// /Library/LaunchAgents/com.sinsu.focusagent.plist. Watchdog dělá launchd
/// sám (KeepAlive=true → restart při pádu, ThrottleInterval bránění loopu).
///
/// Pro běh musí mít uživatel povolení:
///   - Accessibility (titulek okna)
///   - Input Monitoring (počty kláves)
///   - Full Disk Access (CUPS print log, USB events)
/// PPPC profil přes MDM (Jamf/Kandji/Mosyle/Intune) je předudělí všem zaměstnancům
/// hromadně. Ručně: System Settings → Privacy & Security.

let cfg: AgentConfig
do {
    cfg = try AgentConfig.load()
} catch {
    AgentLog.write("FATAL: \(error.localizedDescription)")
    exit(2)
}

let buffer = LocalBuffer()
let sender = Sender(cfg: cfg)
let tracker = ActivityTracker(cfg: cfg, buffer: buffer)
let printMonitor = PrintMonitor(cfg: cfg, sender: sender)
let usbMonitor = UsbMonitor(cfg: cfg, sender: sender)

AgentLog.write("FOCUS agent macOS \(AgentInfo.version) build \(AgentInfo.buildId) startup, backend=\(cfg.backendUrl), interval=\(cfg.intervalSeconds)s, send=\(cfg.sendIntervalSeconds)s")

// Enrollment (per-device token) na pozadí, pokud chybí
if cfg.deviceToken == nil || cfg.deviceToken!.isEmpty {
    Task {
        if let token = await sender.requestDeviceToken() {
            sender.updateDeviceToken(token)
        }
    }
}

// Permissions check + log (žádný UI dialog – ten dělá .pkg postinstall script)
if !WindowTitleCapture.isAuthorized() {
    AgentLog.write("PERMS: Accessibility není povoleno – titulky oken neuvidíme. Otevři System Settings → Privacy & Security → Accessibility a přidej focus-agent.")
}

// Spusť aktivitu, monitory
tracker.start()
printMonitor.start()
usbMonitor.start()

// Heartbeat při startu – aby se zařízení a uživatel zaregistrovali v dashboardu
// IHNED, ne až za 60 s prvního intervalu.
Task {
    _ = await sender.sendBatch(intervals: [])
}

// HW snapshot 1× při startu (po 30 s) a pak každou hodinu.
Task {
    try? await Task.sleep(nanoseconds: 30_000_000_000)
    while true {
        let json = HealthCollector.buildJson()
        await sender.sendHealth(json)
        try? await Task.sleep(nanoseconds: 3_600_000_000_000)
    }
}

// Send timer – flush buffer + heartbeat.
let sendTimer = Timer.scheduledTimer(withTimeInterval: Double(cfg.sendIntervalSeconds), repeats: true) { _ in
    Task { await flushBatches() }
}
RunLoop.main.add(sendTimer, forMode: .common)

@MainActor
func flushBatches() async {
    var sentAnything = false
    while true {
        let batch = buffer.peek(500)
        if batch.isEmpty { break }
        let ok = await sender.sendBatch(intervals: batch)
        if !ok { break }
        buffer.commit(batch.count)
        sentAnything = true
        if batch.count < 500 { break }
    }
    // Heartbeat když není co posílat (drainuje agentLog do dashboardu)
    if !sentAnything {
        _ = await sender.sendBatch(intervals: [])
    }
}

// Hold the run loop alive (CGEventTap a Timer ji potřebují)
RunLoop.main.run()
