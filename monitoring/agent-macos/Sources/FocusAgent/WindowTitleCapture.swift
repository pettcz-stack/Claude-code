import Foundation
import AppKit
import ApplicationServices

/// Titulek aktivního okna přes Accessibility API.
/// Vyžaduje povolení v System Settings → Privacy & Security → **Accessibility**.
/// Bez povolení vrátí nil – classifier pak pracuje jen s názvem aplikace.
enum WindowTitleCapture {
    /// True pokud má agent povolení k AX API. Při false UI nabídne přesměrování
    /// na System Settings (welcome wizard při prvním spuštění).
    static func isAuthorized() -> Bool {
        return AXIsProcessTrusted()
    }

    static func frontTitle(for app: NSRunningApplication) -> String? {
        guard isAuthorized() else { return nil }
        let pid = app.processIdentifier
        let appElement = AXUIElementCreateApplication(pid)

        var focusedWindow: AnyObject?
        let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)
        guard result == .success, let window = focusedWindow else { return nil }

        var title: AnyObject?
        let titleResult = AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &title)
        guard titleResult == .success, let s = title as? String, !s.isEmpty else { return nil }

        // Sanitizace – max 300 znaků, jednořádkové
        let trimmed = s.replacingOccurrences(of: "\n", with: " ")
                       .replacingOccurrences(of: "\r", with: " ")
        return String(trimmed.prefix(300))
    }
}
