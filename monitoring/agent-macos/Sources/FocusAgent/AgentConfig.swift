import Foundation

/// Konfigurace agenta. Primárně z `/Library/Application Support/FOCUS/config.plist`
/// (per-machine, populovat MDM nebo .pkg installer postinstall scriptem).
/// Fallback na proměnné prostředí pro vývoj.
///
/// Pro per-user override (typicky DeviceToken po enrollmentu) také
/// `~/Library/Application Support/FOCUS/config.plist` – ale token se ukládá
/// per-machine, aby přežil změny uživatele.
struct AgentConfig {
    let backendUrl: String
    /// Sdílený INGEST_TOKEN z MSI / MDM. Slouží POUZE k získání per-device tokenu
    /// přes /enroll. Pro běžný /ingest se používá DeviceToken (per-device).
    let ingestToken: String
    /// Per-device token získaný enrollmentem. nil před prvním /enroll.
    var deviceToken: String?
    /// Délka agregačního intervalu (sekundy). Výchozí 60 s.
    let intervalSeconds: Int
    /// Jak často flushovat dávky na server (sekundy). Výchozí 120 s.
    let sendIntervalSeconds: Int
    /// Sbírat titulek aktivního okna. Default true (totéž jako Windows v0.9.1+).
    /// Pro vypnutí vyžaduje pak ještě uživatelův souhlas Accessibility permission.
    let captureWindowTitle: Bool
    /// Práh nečinnosti v sekundách (default 300 = 5 min).
    let idleThresholdSeconds: Int
    /// Sledovat tisk přes CUPS page_log. Default false (opt-in jako Windows).
    let trackPrint: Bool
    let capturePrintDocName: Bool
    /// Sledovat USB / externí disky (FSEvents nad /Volumes/*). Default false.
    let trackUsb: Bool
    let captureUsbFilename: Bool

    static let SYSTEM_CONFIG_PATH = "/Library/Application Support/FOCUS/config.plist"
    static let DEVICE_TOKEN_PATH = "/Library/Application Support/FOCUS/device-token"

    static func load() throws -> AgentConfig {
        let dict = readPlist(at: SYSTEM_CONFIG_PATH) ?? [:]

        func str(_ key: String, env: String) -> String? {
            if let v = dict[key] as? String, !v.isEmpty { return v }
            if let v = ProcessInfo.processInfo.environment[env], !v.isEmpty { return v }
            return nil
        }
        func int(_ key: String, env: String, default def: Int) -> Int {
            if let v = dict[key] as? Int { return v }
            if let s = ProcessInfo.processInfo.environment[env], let v = Int(s) { return v }
            return def
        }
        func bool(_ key: String, env: String, default def: Bool) -> Bool {
            if let v = dict[key] as? Bool { return v }
            if let s = ProcessInfo.processInfo.environment[env] {
                return s == "1" || s.lowercased() == "true"
            }
            return def
        }

        guard let backend = str("BackendUrl", env: "FOCUS_BACKEND_URL") else {
            throw NSError(domain: "FOCUS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Chybí BackendUrl v /Library/Application Support/FOCUS/config.plist"])
        }
        guard let token = str("IngestToken", env: "FOCUS_INGEST_TOKEN") else {
            throw NSError(domain: "FOCUS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Chybí IngestToken"])
        }

        // HTTPS guard – analogicky jako Windows AgentConfig.
        let allowInsecure = bool("AllowInsecureHttp", env: "FOCUS_ALLOW_INSECURE_HTTP", default: false)
        let trimmed = backend.hasSuffix("/") ? String(backend.dropLast()) : backend
        if !allowInsecure {
            guard let url = URL(string: trimmed), url.scheme != nil else {
                throw NSError(domain: "FOCUS", code: 2, userInfo: [NSLocalizedDescriptionKey: "BackendUrl není platná URL"])
            }
            let isLocal = url.host == "localhost" || url.host == "127.0.0.1"
            if url.scheme != "https" && !isLocal {
                throw NSError(domain: "FOCUS", code: 2, userInfo: [NSLocalizedDescriptionKey: "BackendUrl musí být https:// (pro vývoj nastav AllowInsecureHttp=true)"])
            }
        }

        let deviceToken: String? = {
            if let v = try? String(contentsOfFile: DEVICE_TOKEN_PATH, encoding: .utf8) {
                let t = v.trimmingCharacters(in: .whitespacesAndNewlines)
                return t.isEmpty ? nil : t
            }
            return nil
        }()

        var send = int("SendIntervalSeconds", env: "FOCUS_SEND_INTERVAL_SECONDS", default: 120)
        if send < 60 { send = 60 }

        return AgentConfig(
            backendUrl: trimmed,
            ingestToken: token,
            deviceToken: deviceToken,
            intervalSeconds: int("IntervalSeconds", env: "FOCUS_INTERVAL_SECONDS", default: 60),
            sendIntervalSeconds: send,
            captureWindowTitle: bool("CaptureWindowTitle", env: "FOCUS_CAPTURE_TITLE", default: true),
            idleThresholdSeconds: int("IdleThresholdSeconds", env: "FOCUS_IDLE_SECONDS", default: 300),
            trackPrint: bool("TrackPrint", env: "FOCUS_TRACK_PRINT", default: false),
            capturePrintDocName: bool("CapturePrintDocName", env: "FOCUS_CAPTURE_PRINT_DOCNAME", default: false),
            trackUsb: bool("TrackUsb", env: "FOCUS_TRACK_USB", default: false),
            captureUsbFilename: bool("CaptureUsbFilename", env: "FOCUS_CAPTURE_USB_FILENAME", default: false)
        )
    }

    /// Persistuje per-device token získaný enrollmentem. Vyžaduje root/SYSTEM
    /// (launchd daemon ho má). Soubor je chmod 600.
    static func saveDeviceToken(_ token: String) throws {
        let path = DEVICE_TOKEN_PATH
        let dir = (path as NSString).deletingLastPathComponent
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try token.write(toFile: path, atomically: true, encoding: .utf8)
        // chmod 600 – jen root čte, jiní ne
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path)
    }

    private static func readPlist(at path: String) -> [String: Any]? {
        guard let data = FileManager.default.contents(atPath: path) else { return nil }
        return try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
    }
}
