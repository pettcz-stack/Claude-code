import Foundation

/// Zapisovač do `/Library/Application Support/FOCUS/agent.log` (rotace na 1 MiB)
/// A SOUČASNĚ do paměťového ring bufferu, který agent posílá v dalším /ingest
/// dávce do dashboardu. Operátor tak vidí log agenta z prohlížeče bez SSH.
enum AgentLog {
    private static let lock = NSLock()
    private static var buffer: [(ts: String, message: String)] = []
    private static let MAX_BUFFER = 200
    private static let MAX_LOG_BYTES: UInt64 = 1024 * 1024

    static var logPath: String { "/Library/Application Support/FOCUS/agent.log" }

    static func write(_ message: String) {
        let ts = ISO8601DateFormatter.iso8601WithMillis.string(from: Date())
        // Soubor + rotace
        do {
            let dir = "/Library/Application Support/FOCUS"
            try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            let path = logPath
            if let attr = try? FileManager.default.attributesOfItem(atPath: path),
               let size = attr[.size] as? UInt64, size > MAX_LOG_BYTES {
                let oldPath = path + ".1"
                try? FileManager.default.removeItem(atPath: oldPath)
                try? FileManager.default.moveItem(atPath: path, toPath: oldPath)
            }
            let line = "\(ts)\t\(message)\n"
            if FileManager.default.fileExists(atPath: path),
               let handle = FileHandle(forWritingAtPath: path) {
                defer { try? handle.close() }
                handle.seekToEndOfFile()
                if let d = line.data(using: .utf8) { handle.write(d) }
            } else {
                try line.write(toFile: path, atomically: true, encoding: .utf8)
            }
        } catch { /* logování nesmí shodit agenta */ }

        // Ring buffer pro dashboard
        lock.lock()
        if buffer.count >= MAX_BUFFER { buffer.removeFirst() }
        buffer.append((ts: ts, message: message))
        lock.unlock()
    }

    /// JSON pole připravené k zařazení do /ingest payloadu.
    static func drainAsJsonArray() -> String? {
        lock.lock()
        let snapshot = buffer
        buffer.removeAll(keepingCapacity: true)
        lock.unlock()
        if snapshot.isEmpty { return nil }
        let arr: [[String: Any]] = snapshot.map { ["ts": $0.ts, "message": $0.message] }
        guard let data = try? JSONSerialization.data(withJSONObject: arr),
              let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }
}
