import Foundation

/// Persistentní fronta intervalů (NDJSON soubor v /Library/Application Support
/// /FOCUS/spool.ndjson). Přežije pád agenta i restart Macu. Bezpečně thread-safe.
final class LocalBuffer {
    private let path: String
    private let queue = DispatchQueue(label: "focus.localbuffer", qos: .utility)
    private var inMemory: [String] = []

    init() {
        let dir = "/Library/Application Support/FOCUS"
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        self.path = dir + "/spool.ndjson"
        loadFromDisk()
    }

    private func loadFromDisk() {
        guard let data = try? String(contentsOfFile: path, encoding: .utf8) else { return }
        inMemory = data.split(separator: "\n").map { String($0) }.filter { !$0.isEmpty }
    }

    func enqueue(_ jsonLine: String) {
        queue.sync {
            inMemory.append(jsonLine)
            try? (jsonLine + "\n").appendToFile(at: path)
        }
    }

    /// Vrátí max N záznamů. Nesmaže – commit dělá až `commit(_:)`.
    func peek(_ max: Int) -> [String] {
        queue.sync {
            return Array(inMemory.prefix(max))
        }
    }

    /// Smaže prvních N záznamů (po úspěšném odeslání).
    func commit(_ count: Int) {
        queue.sync {
            if count >= inMemory.count {
                inMemory.removeAll()
                try? "".write(toFile: path, atomically: true, encoding: .utf8)
            } else {
                inMemory.removeFirst(count)
                let rewrite = inMemory.joined(separator: "\n") + "\n"
                try? rewrite.write(toFile: path, atomically: true, encoding: .utf8)
            }
        }
    }
}

private extension String {
    func appendToFile(at path: String) throws {
        if FileManager.default.fileExists(atPath: path),
           let handle = FileHandle(forWritingAtPath: path) {
            defer { try? handle.close() }
            handle.seekToEndOfFile()
            if let data = self.data(using: .utf8) {
                handle.write(data)
            }
        } else {
            try self.write(toFile: path, atomically: true, encoding: .utf8)
        }
    }
}
