import Foundation
#if canImport(CoreServices)
import CoreServices
#endif

/// Sleduje externí (USB / Thunderbolt) disky přes FSEvents nad /Volumes/*.
/// macOS automaticky mountuje removable disky do /Volumes/. FSEvents API
/// poskytuje real-time notifikace o souborových operacích.
///
/// Vyžaduje **Full Disk Access** v System Settings → Privacy & Security
/// (jinak FSEvents pro /Volumes neuvidí soubory ostatních uživatelů).
final class UsbMonitor {
    private let cfg: AgentConfig
    private let sender: Sender
    private let queue = DispatchQueue(label: "focus.usbmonitor")
    private var pending: [[String: Any]] = []
    private let pendingLock = NSLock()
    private var stream: FSEventStreamRef?
    private var flushTimer: DispatchSourceTimer?
    private let MAX_QUEUED = 10000

    init(cfg: AgentConfig, sender: Sender) {
        self.cfg = cfg
        self.sender = sender
    }

    func start() {
        guard cfg.trackUsb else {
            AgentLog.write("UsbMonitor: TrackUsb=false, neaktivuji.")
            return
        }
        // FSEvents na celé /Volumes/ – pokrývá všechny removable + sítové disky.
        let pathsToWatch = ["/Volumes"] as CFArray
        var context = FSEventStreamContext(version: 0,
                                           info: Unmanaged.passUnretained(self).toOpaque(),
                                           retain: nil, release: nil, copyDescription: nil)
        let flags = UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer)
        guard let s = FSEventStreamCreate(kCFAllocatorDefault,
                                          { _, info, count, paths, flags, _ in
                                              guard let info = info, let pathArr = unsafeBitCast(paths, to: NSArray.self) as? [String] else { return }
                                              let self_ = Unmanaged<UsbMonitor>.fromOpaque(info).takeUnretainedValue()
                                              let flagsBuf = UnsafeBufferPointer(start: flags, count: count)
                                              for i in 0..<count {
                                                  self_.handleEvent(path: pathArr[i], flags: flagsBuf[i])
                                              }
                                          },
                                          &context, pathsToWatch, FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
                                          1.0, flags) else {
            AgentLog.write("UsbMonitor: FSEventStreamCreate selhal")
            return
        }
        FSEventStreamSetDispatchQueue(s, queue)
        FSEventStreamStart(s)
        self.stream = s
        AgentLog.write("UsbMonitor: spuštěn (FSEvents na /Volumes)")

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

    private func handleEvent(path: String, flags: FSEventStreamEventFlags) {
        // Ignoruj boot disk – /Volumes/Macintosh\ HD je symlink na /
        // (jen z externích disků nás zajímá DLP riziko).
        if path == "/Volumes" || path.hasPrefix("/Volumes/Macintosh HD") { return }

        let isCreated = (flags & UInt32(kFSEventStreamEventFlagItemCreated)) != 0
        let isModified = (flags & UInt32(kFSEventStreamEventFlagItemModified)) != 0
        let isRemoved = (flags & UInt32(kFSEventStreamEventFlagItemRemoved)) != 0
        let isRenamed = (flags & UInt32(kFSEventStreamEventFlagItemRenamed)) != 0
        let isDir = (flags & UInt32(kFSEventStreamEventFlagItemIsDir)) != 0
        if isDir { return } // sledujeme jen soubory

        let action: String
        if isRemoved { action = "DELETE" }
        else if isRenamed { action = "RENAME" }
        else if isCreated { action = "CREATE" }
        else if isModified { action = "WRITE" }
        else { return }

        // Drive letter ekvivalent na macOS = první komponenta cesty (svazek)
        // "/Volumes/USB-KEY/foo/bar.pdf" → drive: "/Volumes/USB-KEY"
        let comps = path.split(separator: "/").map { String($0) }
        guard comps.count >= 2 else { return }
        let driveLabel = comps[1]
        let drivePath = "/Volumes/\(driveLabel)"
        let fileName = (path as NSString).lastPathComponent
        let ext = (path as NSString).pathExtension.lowercased()

        var size: Int64 = 0
        if let attrs = try? FileManager.default.attributesOfItem(atPath: path) {
            size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
        }

        var event: [String: Any] = [
            "eventAt": ISO8601DateFormatter.iso8601WithMillis.string(from: Date()),
            "action": action,
            "driveLetter": drivePath,
            "driveLabel": driveLabel,
        ]
        if !ext.isEmpty { event["fileExt"] = ext }
        if size > 0 { event["sizeBytes"] = String(size) } // BigInt jako string
        if cfg.captureUsbFilename { event["fileName"] = fileName }

        pendingLock.lock()
        if pending.count < MAX_QUEUED { pending.append(event) }
        pendingLock.unlock()
    }

    private func flush() async {
        pendingLock.lock()
        let batch = Array(pending.prefix(1000))
        let removeCount = batch.count
        pendingLock.unlock()
        if batch.isEmpty { return }

        let body: [String: Any] = [
            "machineId": MachineIdentity.machineId(),
            "sid": MachineIdentity.userSid(),
            "events": batch,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let json = String(data: data, encoding: .utf8) else { return }
        let ok = await sender.sendBatchTo(path: "/api/v1/ingest/usb", json: json)
        if ok {
            pendingLock.lock()
            pending.removeFirst(min(removeCount, pending.count))
            pendingLock.unlock()
            AgentLog.write("UsbMonitor flush: \(batch.count) událostí")
        } else {
            AgentLog.write("UsbMonitor flush FAILED, nechávám ve frontě")
        }
    }
}
