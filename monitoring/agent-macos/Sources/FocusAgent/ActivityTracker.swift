import Foundation
import AppKit
import IOKit

/// Agreguje aktivitu do intervalů (default 60 s) a posílá je do LocalBufferu.
/// Měří:
///  - aktivní čas (čas s detekovaným vstupem nebo přepnutím okna)
///  - nečinný čas (sekundy bez vstupu = HID idle time)
///  - foreground aplikaci (přes NSWorkspace)
///  - titulek aktivního okna (pokud captureWindowTitle a má Accessibility permission)
///  - počty kláves a kliků (pokud má Input Monitoring permission)
final class ActivityTracker {
    private let cfg: AgentConfig
    private let buffer: LocalBuffer
    private var timer: Timer?

    // Akumulátory pro aktuální interval
    private var intervalStart = Date()
    private var elapsedSeconds = 0
    private var activeSeconds = 0
    private var idleSeconds = 0
    private var lockedSeconds = 0
    private var sessionLocked = false

    // Per-app a per-titulek čítače sekund (most used wins)
    private var appSeconds: [String: Int] = [:]
    private var titleSeconds: [String: Int] = [:]

    // Klávesy/kliky – počítá InputCounters přes CGEventTap
    private let input = InputCounters()

    init(cfg: AgentConfig, buffer: LocalBuffer) {
        self.cfg = cfg
        self.buffer = buffer
    }

    func start() {
        input.install()
        intervalStart = Date()
        // Tick každou sekundu – počítáme idle/active sekundy přesně.
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in self?.tick() }
        if let t = timer { RunLoop.main.add(t, forMode: .common) }
        // Sleduj zámek obrazovky (NSWorkspace notifikace).
        NotificationCenter.default.addObserver(forName: NSNotification.Name("com.apple.screenIsLocked"),
                                               object: nil, queue: nil) { [weak self] _ in self?.sessionLocked = true }
        NotificationCenter.default.addObserver(forName: NSNotification.Name("com.apple.screenIsUnlocked"),
                                               object: nil, queue: nil) { [weak self] _ in self?.sessionLocked = false }
    }

    private func tick() {
        elapsedSeconds += 1
        if sessionLocked {
            lockedSeconds += 1
        } else {
            let idle = systemIdleSeconds()
            if idle >= Double(cfg.idleThresholdSeconds) {
                idleSeconds += 1
            } else {
                activeSeconds += 1
                // Zaznamenej aktuální foreground app
                if let app = NSWorkspace.shared.frontmostApplication {
                    let name = app.localizedName ?? app.bundleIdentifier ?? "unknown"
                    appSeconds[name, default: 0] += 1
                    if cfg.captureWindowTitle, let title = WindowTitleCapture.frontTitle(for: app), !title.isEmpty {
                        titleSeconds[title, default: 0] += 1
                    }
                }
            }
        }
        if elapsedSeconds >= cfg.intervalSeconds {
            flush()
        }
    }

    private func flush() {
        let counters = input.takeAndReset()
        let topApp = appSeconds.max(by: { $0.value < $1.value })?.key
        let topTitle = cfg.captureWindowTitle ? titleSeconds.max(by: { $0.value < $1.value })?.key : nil

        let isoStart = ISO8601DateFormatter.iso8601WithMillis.string(from: intervalStart)
        // Stavíme record podmíněně – backend `z.optional()` odmítá `null`, takže
        // nepřítomné fieldy musíme vynechat úplně (ne posílat jako null).
        var record: [String: Any] = [
            "intervalStart": isoStart,
            "intervalSeconds": elapsedSeconds,
            "activeSeconds": activeSeconds,
            "idleSeconds": idleSeconds + lockedSeconds,
            "keystrokeCount": counters.keystrokes,
            "mouseEvents": counters.mouse,
            // Fáze 2 typingKpm – přesný čas a počet úhozů v souvislých
            // typing sessions (úhoz/úhoz s gapem < 5s). Backend pak počítá
            // typingKpm = typingKeystrokes / (typingMs / 60000) bez pauz.
            "typingMs": counters.typingMs,
            "typingKeystrokeCount": counters.typingKeystrokes,
            "sessionLocked": lockedSeconds * 2 >= elapsedSeconds,
            "monitorCount": NSScreen.screens.count,
        ]
        if let topApp = topApp { record["foregroundApp"] = topApp }
        if let topTitle = topTitle { record["windowTitle"] = topTitle }
        if let ip = NetworkInfo.localIPv4() { record["clientIp"] = ip }
        if let data = try? JSONSerialization.data(withJSONObject: record),
           let json = String(data: data, encoding: .utf8) {
            buffer.enqueue(json)
        }

        // Reset
        intervalStart = Date()
        elapsedSeconds = 0; activeSeconds = 0; idleSeconds = 0; lockedSeconds = 0
        appSeconds.removeAll(keepingCapacity: true)
        titleSeconds.removeAll(keepingCapacity: true)
    }

    /// Vrátí počet sekund od posledního HID vstupu (klávesnice/myš). IOKit API.
    private func systemIdleSeconds() -> Double {
        var iterator: io_iterator_t = 0
        // kIOMasterPortDefault: deprecated v macOS 12 (warning), ale jediná varianta
        // dostupná na macOS 11 (Big Sur). kIOMainPortDefault by zvedl min. OS na 12.
        let result = IOServiceGetMatchingServices(kIOMasterPortDefault, IOServiceMatching("IOHIDSystem"), &iterator)
        guard result == KERN_SUCCESS else { return 0 }
        defer { IOObjectRelease(iterator) }
        let entry = IOIteratorNext(iterator)
        guard entry != 0 else { return 0 }
        defer { IOObjectRelease(entry) }

        var props: Unmanaged<CFMutableDictionary>?
        guard IORegistryEntryCreateCFProperties(entry, &props, kCFAllocatorDefault, 0) == KERN_SUCCESS,
              let dict = props?.takeRetainedValue() as? [String: Any],
              let idleNs = dict["HIDIdleTime"] as? UInt64 else { return 0 }
        return Double(idleNs) / 1_000_000_000.0
    }
}

extension ISO8601DateFormatter {
    static let iso8601WithMillis: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
