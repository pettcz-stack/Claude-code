import Foundation
import CoreGraphics
import IOKit.hid

/// Počítadlo kláves a kliků myši. **POUZE COUNT, nikdy obsah** – zákon §316 ZP
/// (zákaz keyloggeru) i GDPR (minimalizace).
///
/// Měří navíc "typing session" pro spravedlivé KPM:
///  - session začne první klávesou,
///  - každá další klávesa do 5 s session prodlouží,
///  - mezera ≥ 5 s session ukončí.
/// `typingMs` = součet trvání všech sessionů v intervalu (60 s default),
/// `typingKeystrokes` = úhozy uvnitř sessionů. Pak kpm = typingKeystrokes /
/// (typingMs / 60000) bez ředění pauzami.
///
/// Implementace přes CGEventTap, který vyžaduje uživatelovo povolení
/// v System Settings → Privacy & Security → **Input Monitoring** (přidat
/// `focus-agent` binárku). Bez toho tap selže a vrátí 0 – agent funguje
/// dál, jen bez tempa.
final class InputCounters {
    private var keystrokes: Int = 0
    private var mouseEvents: Int = 0
    // Typing session state
    private var lastKeystrokeAt: TimeInterval = 0
    private var sessionStartedAt: TimeInterval = 0
    private var sessionKeystrokes: Int = 0
    private var accumulatedTypingMs: Int = 0
    private var accumulatedTypingKeystrokes: Int = 0
    private let typingGapMs: Double = 5000 // 5 s
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private let lock = NSLock()

    func install() {
        let access = IOHIDCheckAccess(kIOHIDRequestTypeListenEvent)
        switch access {
        case kIOHIDAccessTypeGranted:
            AgentLog.write("InputCounters: Input Monitoring je povolen, instaluji tap.")
        case kIOHIDAccessTypeDenied:
            AgentLog.write("PERMS: Input Monitoring je ODMÍTNUT v System Settings → Privacy & Security → Input Monitoring. Bez něj nebudou počty kláves ani kliků.")
            return
        case kIOHIDAccessTypeUnknown:
            AgentLog.write("PERMS: Input Monitoring není ještě rozhodnut – vyvolávám systémový dialog. Po schválení agenta restartuj (launchctl kickstart).")
            _ = IOHIDRequestAccess(kIOHIDRequestTypeListenEvent)
            return
        default:
            AgentLog.write("PERMS: IOHIDCheckAccess vrátil neznámý stav (\(access.rawValue)).")
        }

        let mask: CGEventMask = (1 << CGEventType.keyDown.rawValue)
                              | (1 << CGEventType.leftMouseDown.rawValue)
                              | (1 << CGEventType.rightMouseDown.rawValue)
                              | (1 << CGEventType.otherMouseDown.rawValue)

        let userInfo = Unmanaged.passUnretained(self).toOpaque()
        let callback: CGEventTapCallBack = { _, type, _, refcon in
            guard let refcon = refcon else { return nil }
            let self_ = Unmanaged<InputCounters>.fromOpaque(refcon).takeUnretainedValue()
            self_.lock.lock()
            if type == .keyDown {
                self_.keystrokes += 1
                self_.recordKeystrokeTimestamp(at: Date().timeIntervalSince1970 * 1000)
            } else {
                self_.mouseEvents += 1
            }
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

    /// Volá callback při keyDown. lock je už drzeny.
    private func recordKeystrokeTimestamp(at nowMs: TimeInterval) {
        if sessionStartedAt == 0 {
            // Nová session – první úhoz po startu nebo po dlouhé pauze.
            sessionStartedAt = nowMs
            sessionKeystrokes = 1
        } else {
            let gap = nowMs - lastKeystrokeAt
            if gap > typingGapMs {
                // Pauza ≥ 5s ukončila předchozí session – uložíme ji a začneme novou.
                accumulatedTypingMs += Int(lastKeystrokeAt - sessionStartedAt)
                accumulatedTypingKeystrokes += sessionKeystrokes
                sessionStartedAt = nowMs
                sessionKeystrokes = 1
            } else {
                sessionKeystrokes += 1
            }
        }
        lastKeystrokeAt = nowMs
    }

    /// Vrátí počty za uplynulý interval a resetuje.
    /// Pokud session ještě běží, neukončuje ji – pokračuje do dalšího intervalu.
    func takeAndReset() -> (keystrokes: Int, mouse: Int, typingMs: Int, typingKeystrokes: Int) {
        lock.lock()
        defer { lock.unlock() }
        let k = keystrokes
        let m = mouseEvents
        // "Snapshotneme" aktuálně běžící session do akumulátoru, ale nesmažeme ji –
        // další úhozy by ji stejně prodloužily. Místo toho po snapshotu posuneme
        // sessionStartedAt na lastKeystrokeAt, takže další interval bude počítat
        // session od posledního známého úhozu.
        var snapMs = accumulatedTypingMs
        var snapKs = accumulatedTypingKeystrokes
        if sessionStartedAt > 0 && lastKeystrokeAt > sessionStartedAt {
            snapMs += Int(lastKeystrokeAt - sessionStartedAt)
            snapKs += sessionKeystrokes
            // Reset akumulátoru, ale ponechá session "živou" pro další tick:
            sessionStartedAt = lastKeystrokeAt
            sessionKeystrokes = 0
        }
        keystrokes = 0
        mouseEvents = 0
        accumulatedTypingMs = 0
        accumulatedTypingKeystrokes = 0
        return (k, m, snapMs, snapKs)
    }
}
