import Foundation
import IOKit

/// Identifikace stroje a aktuálně přihlášeného uživatele.
///
/// `machineId` je IOPlatformUUID – stabilní napříč reinstalací OS, vázaný
/// na hardware (totéž jako Win GUID v registry). machineId je sdílený mezi
/// Windows i macOS agenty – server podle něj jednoznačně identifikuje zařízení.
enum MachineIdentity {
    static func machineId() -> String {
        let platformExpert = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOPlatformExpertDevice"))
        defer { if platformExpert != 0 { IOObjectRelease(platformExpert) } }
        guard platformExpert != 0,
              let cf = IORegistryEntryCreateCFProperty(platformExpert, "IOPlatformUUID" as CFString, kCFAllocatorDefault, 0)
        else {
            // Fallback – hostname (deterministic ale méně stabilní).
            return "MAC-" + hostname()
        }
        return (cf.takeRetainedValue() as? String) ?? "MAC-" + hostname()
    }

    static func hostname() -> String {
        var buf = [CChar](repeating: 0, count: 256)
        if gethostname(&buf, buf.count) == 0 {
            return String(cString: buf)
        }
        return ProcessInfo.processInfo.hostName
    }

    static func osName() -> String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        return "macOS \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }

    /// Unix uid přihlášeného uživatele agenta. Slouží jako "SID" ekvivalent
    /// – server akceptuje libovolný stabilní string.
    static func userSid() -> String {
        let uid = getuid()
        // Předponou "macOS-uid:" odlišíme od Windows SIDů ("S-1-5-21-..."),
        // aby se omylem nemapovaly na stejné DB řádky.
        return "macOS-uid:\(uid)"
    }

    static func userDisplayName() -> String {
        return NSFullUserName()
    }
}
