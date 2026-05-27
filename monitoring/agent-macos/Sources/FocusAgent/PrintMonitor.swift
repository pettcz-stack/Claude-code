import Foundation

/// Sleduje tisk přes CUPS page_log (/var/log/cups/page_log). CUPS tam zapisuje
/// jeden řádek pro každou tisknutou stránku v formátu:
///
///   printer-name user-name jobid date-time pages-this-page time-stamp options
///
/// Příklad:
///   HP_LaserJet user-name 42 [27/May/2026:11:22:33 +0200] 1 1 -
///
/// Sledování souboru přes DispatchSource (kqueue) – low-overhead, žádný polling.
/// Bezpečnostně OK – page_log je čitelný pouze rootem (launchd daemon ho má).
final class PrintMonitor {
    private let cfg: AgentConfig
    private let sender: Sender
    private let queue = DispatchQueue(label: "focus.printmonitor")
    private var pending: [[String: Any]] = []
    private let pendingLock = NSLock()
    private var watcher: DispatchSourceFileSystemObject?
    private var fileHandle: FileHandle?
    private var flushTimer: DispatchSourceTimer?
    private let MAX_QUEUED = 5000
    private let logPath = "/var/log/cups/page_log"

    init(cfg: AgentConfig, sender: Sender) {
        self.cfg = cfg
        self.sender = sender
    }

    func start() {
        guard cfg.trackPrint else {
            AgentLog.write("PrintMonitor: TrackPrint=false, neaktivuji.")
            return
        }
        // Otevři log a začni číst od konce (jen NOVÉ tisky).
        guard FileManager.default.fileExists(atPath: logPath) else {
            AgentLog.write("PrintMonitor: \(logPath) neexistuje – pravděpodobně se na Macu nikdy netisklo. Čekám.")
            return
        }
        guard let fh = FileHandle(forReadingAtPath: logPath) else {
            AgentLog.write("PrintMonitor: nemůžu otevřít \(logPath) (chybí Full Disk Access?)")
            return
        }
        fh.seekToEndOfFile()
        self.fileHandle = fh

        let src = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fh.fileDescriptor,
                                                            eventMask: [.write, .extend], queue: queue)
        src.setEventHandler { [weak self] in self?.consumeNewLines() }
        src.resume()
        self.watcher = src
        AgentLog.write("PrintMonitor: spuštěn (sleduje \(logPath))")

        // Flush každých 5 min
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + 300, repeating: 300)
        timer.setEventHandler { [weak self] in
            // Capture do `let` před přechodem do Task – jinak Swift hlásí
            // "reference to captured var 'self' in concurrently-executing code".
            guard let strongSelf = self else { return }
            Task { await strongSelf.flush() }
        }
        timer.resume()
        self.flushTimer = timer
    }

    private func consumeNewLines() {
        guard let fh = fileHandle else { return }
        let data = fh.availableData
        guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
        for line in text.split(separator: "\n") {
            parseLine(String(line))
        }
    }

    /// Parsuje CUPS page_log řádek. Formát:
    ///   printer username jobid [date-time +tz] pages count - {options}
    private func parseLine(_ line: String) {
        let parts = line.split(separator: " ", maxSplits: 6, omittingEmptySubsequences: true).map { String($0) }
        guard parts.count >= 6 else { return }
        let printer = parts[0]
        let _ = parts[1] // username (max neumíme namapovat 1:1 na MonitoredUser SID, server matchne přes machineId + SID)
        let _ = parts[2] // jobId
        let dateRaw = (parts[3] + " " + parts[4]).trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        let pages = Int(parts[5]) ?? 1
        // copies = parts[6] (často "1")
        let copies = parts.count > 6 ? Int(parts[6].split(separator: " ").first ?? "1") ?? 1 : 1

        let jobAt = parseCupsDate(dateRaw) ?? Date()
        var job: [String: Any] = [
            "jobAt": ISO8601DateFormatter.iso8601WithMillis.string(from: jobAt),
            "printerName": printer.replacingOccurrences(of: "_", with: " "),
            "pages": pages,
            "copies": copies,
        ]
        if cfg.capturePrintDocName, parts.count > 6 {
            // Document name bývá v sekci {options} jako job-name='Něco'
            if let docNameMatch = line.range(of: #"job-name\s*=\s*'([^']+)'"#, options: .regularExpression) {
                let raw = String(line[docNameMatch])
                if let nameRange = raw.range(of: #"'([^']+)'"#, options: .regularExpression) {
                    let name = raw[nameRange].trimmingCharacters(in: CharacterSet(charactersIn: "'"))
                    job["documentName"] = name
                }
            }
        }

        pendingLock.lock()
        if pending.count < MAX_QUEUED { pending.append(job) }
        pendingLock.unlock()
    }

    private func parseCupsDate(_ s: String) -> Date? {
        // [27/May/2026:11:22:33 +0200]
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "dd/MMM/yyyy:HH:mm:ss Z"
        return f.date(from: s)
    }

    private func flush() async {
        pendingLock.lock()
        let batch = Array(pending.prefix(500))
        let removeCount = batch.count
        pendingLock.unlock()
        if batch.isEmpty { return }

        let body: [String: Any] = [
            "machineId": MachineIdentity.machineId(),
            "sid": MachineIdentity.userSid(),
            "jobs": batch,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let json = String(data: data, encoding: .utf8) else { return }

        let ok = await sender.sendBatchTo(path: "/api/v1/ingest/print", json: json)
        if ok {
            pendingLock.lock()
            pending.removeFirst(min(removeCount, pending.count))
            pendingLock.unlock()
            AgentLog.write("PrintMonitor flush: \(batch.count) úloh")
        } else {
            AgentLog.write("PrintMonitor flush FAILED, nechávám ve frontě")
        }
    }
}
