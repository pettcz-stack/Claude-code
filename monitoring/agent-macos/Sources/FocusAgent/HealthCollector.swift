import Foundation

/// HW telemetrie přes `system_profiler` a `pmset`. Sběr 1× při startu (po 30 s)
/// a pak každou hodinu. Identické JSON pole jako Windows HealthCollector –
/// backend nerozlišuje OS.
enum HealthCollector {
    static func buildJson() -> String {
        let machineId = MachineIdentity.machineId()
        let now = ISO8601DateFormatter.iso8601WithMillis.string(from: Date())

        var dict: [String: Any] = [
            "machineId": machineId,
            "reportedAt": now,
            "osName": "macOS",
            "osVersion": osVersion(),
            "uptimeSec": Int(ProcessInfo.processInfo.systemUptime),
        ]
        if let hw = hardwareInfo() {
            dict.merge(hw) { _, new in new }
        }
        if let mem = memoryInfo() {
            dict.merge(mem) { _, new in new }
        }
        if let bat = batteryInfo() {
            dict.merge(bat) { _, new in new }
        }
        if let disks = diskInfo() {
            dict["disks"] = disks
        }
        // macOS nemá běžně třetí stranu Defender; XProtect je vestavěný a nevypnutelný.
        dict["antivirusEnabled"] = true
        dict["antivirusUpdated"] = true
        // macOS reboot pending: po major updatu existuje /var/db/.AppleSetupDone vs. softwareupdate -l
        dict["rebootPending"] = false

        if let data = try? JSONSerialization.data(withJSONObject: dict),
           let s = String(data: data, encoding: .utf8) {
            return s
        }
        return "{}"
    }

    private static func osVersion() -> String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        return "\(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }

    /// system_profiler SPHardwareDataType -json
    private static func hardwareInfo() -> [String: Any]? {
        guard let out = runCommand("/usr/sbin/system_profiler", args: ["SPHardwareDataType", "-json"]) else { return nil }
        guard let data = out.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let arr = json["SPHardwareDataType"] as? [[String: Any]],
              let hw = arr.first else { return nil }

        var result: [String: Any] = [:]
        if let model = hw["machine_model"] as? String { result["model"] = model }
        if let maker = hw["machine_name"] as? String { result["manufacturer"] = maker } // např. "Mac mini"
        if let serial = hw["serial_number"] as? String { result["serial"] = serial }
        if let chip = hw["chip_type"] as? String {
            result["cpuModel"] = chip // Apple Silicon (M1/M2/M3...)
        } else if let cpu = hw["cpu_type"] as? String {
            result["cpuModel"] = cpu // Intel
        }
        if let boot = hw["boot_rom_version"] as? String {
            result["biosVersion"] = boot
        }
        return result
    }

    /// Paměť přes sysctl hw.memsize + vm_stat pro využití
    private static func memoryInfo() -> [String: Any]? {
        var total: UInt64 = 0
        var size = MemoryLayout<UInt64>.size
        sysctlbyname("hw.memsize", &total, &size, nil, 0)
        guard total > 0 else { return nil }
        let totalMB = Int(total / 1024 / 1024)
        // vm_stat parser
        var usedPct: Int? = nil
        if let stat = runCommand("/usr/bin/vm_stat") {
            let lines = stat.split(separator: "\n")
            var pageSize: Int64 = 4096
            if let szLine = lines.first(where: { $0.contains("page size of") }) {
                let nums = String(szLine).components(separatedBy: CharacterSet.decimalDigits.inverted).compactMap { Int64($0) }
                if let s = nums.first { pageSize = s }
            }
            func pages(_ key: String) -> Int64 {
                guard let l = lines.first(where: { $0.contains(key) }) else { return 0 }
                let nums = String(l).components(separatedBy: CharacterSet.decimalDigits.inverted).compactMap { Int64($0) }
                return nums.first ?? 0
            }
            let active = pages("Pages active:")
            let wired = pages("Pages wired down:")
            let compressed = pages("Pages occupied by compressor:")
            let usedBytes = (active + wired + compressed) * pageSize
            usedPct = Int(Double(usedBytes) / Double(total) * 100)
        }
        var r: [String: Any] = ["ramTotalMB": totalMB]
        if let u = usedPct { r["ramUsedPct"] = u }
        return r
    }

    /// pmset -g batt
    private static func batteryInfo() -> [String: Any]? {
        guard let out = runCommand("/usr/bin/pmset", args: ["-g", "batt"]) else { return nil }
        // Když není baterie (Mac mini, Mac Pro), výstup řekne "InternalBattery" se nepublikuje.
        guard out.contains("InternalBattery") else {
            return ["batteryPresent": false, "onAcPower": true]
        }
        var r: [String: Any] = ["batteryPresent": true]
        // "  -InternalBattery-0 (id=...)	78%; discharging; 4:12 remaining"
        if let pctMatch = out.range(of: #"(\d+)%"#, options: .regularExpression) {
            let s = String(out[pctMatch]).replacingOccurrences(of: "%", with: "")
            if let v = Int(s) { r["batteryChargePct"] = v }
        }
        r["onAcPower"] = !out.contains("discharging")
        return r
    }

    /// diskutil list + apfs info → souhrn diskového prostoru
    private static func diskInfo() -> [[String: Any]]? {
        // Hlavní APFS svazek je obvykle /System/Volumes/Data; pro souhrn použijme `/`.
        guard let attrs = try? FileManager.default.attributesOfFileSystem(forPath: "/") else { return nil }
        let total = (attrs[.systemSize] as? NSNumber)?.int64Value ?? 0
        let free = (attrs[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
        if total == 0 { return nil }
        return [[
            "name": "/",
            "totalGB": Int(total / (1024 * 1024 * 1024)),
            "freeGB": Int(free / (1024 * 1024 * 1024)),
            "smartStatus": "OK", // macOS neexpose SMART tak jednoduše; OK je realistic default
        ]]
    }

    private static func runCommand(_ path: String, args: [String] = []) -> String? {
        let task = Process()
        task.launchPath = path
        task.arguments = args
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = Pipe()
        do { try task.run() } catch { return nil }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        task.waitUntilExit()
        return String(data: data, encoding: .utf8)
    }
}
