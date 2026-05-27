import Foundation
import CoreGraphics

/// Počítadlo kláves a kliků myši. **POUZE COUNT, nikdy obsah** – zákon §316 ZP
/// (zákaz keyloggeru) i GDPR (minimalizace).
///
/// Implementace přes CGEventTap, který vyžaduje uživatelovo povolení
/// v System Settings → Privacy & Security → **Input Monitoring** (přidat
/// `focus-agent` binárku). Bez toho tap selže a vrátí 0/0 – agent funguje
/// dál, jen bez tempa.
final class InputCounters {
    private var keystrokes: Int = 0
    private var mouseEvents: Int = 0
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private let lock = NSLock()

    func install() {
        let mask: CGEventMask = (1 << CGEventType.keyDown.rawValue)
                              | (1 << CGEventType.leftMouseDown.rawValue)
                              | (1 << CGEventType.rightMouseDown.rawValue)
                              | (1 << CGEventType.otherMouseDown.rawValue)

        let userInfo = Unmanaged.passUnretained(self).toOpaque()
        let callback: CGEventTapCallBack = { _, type, _, refcon in
            guard let refcon = refcon else { return nil }
            let self_ = Unmanaged<InputCounters>.fromOpaque(refcon).takeUnretainedValue()
            self_.lock.lock()
            if type == .keyDown { self_.keystrokes += 1 }
            else { self_.mouseEvents += 1 }
            self_.lock.unlock()
            return nil // .listenOnly – nepřepisujeme událost
        }

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: mask,
            callback: callback,
            userInfo: userInfo
        ) else {
            AgentLog.write("InputCounters: tapCreate selhal (chybí Input Monitoring permission v System Settings)")
            return
        }
        self.eventTap = tap
        let src = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), src, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        self.runLoopSource = src
        AgentLog.write("InputCounters: tap nainstalován")
    }

    func takeAndReset() -> (Int, Int) {
        lock.lock()
        defer { lock.unlock() }
        let k = keystrokes
        let m = mouseEvents
        keystrokes = 0
        mouseEvents = 0
        return (k, m)
    }
}
