import Foundation

/// HTTP komunikace s FOCUS serverem. Posílá batch /ingest, /ingest/health,
/// /ingest/print, /ingest/usb a vyřizuje /ingest/enroll pro per-device token.
final class Sender {
    /// Public-read aby MenuBarController mohl číst backendUrl pro otevření browseru.
    private(set) var cfg: AgentConfig
    private let session: URLSession

    /// Server v odpovědi ingestu řekne, zda mají zaměstnanci přístup k reportu –
    /// agent podle toho ukáže / skryje tray ikonu.
    private(set) var lastEmployeeReportEnabled: Bool = false

    init(cfg: AgentConfig) {
        self.cfg = cfg
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 30
        config.httpAdditionalHeaders = ["Content-Type": "application/json"]
        self.session = URLSession(configuration: config)
    }

    private var authHeader: String {
        let token = cfg.deviceToken?.isEmpty == false ? cfg.deviceToken! : cfg.ingestToken
        return "Bearer \(token)"
    }

    /// /enroll – při prvním startu (nebo po revokaci) vyzvedne per-device token.
    /// Autentizuje SDÍLENÝM INGEST_TOKEN, vrátí per-device token a uloží ho.
    func requestDeviceToken() async -> String? {
        let body: [String: Any] = [
            "machineId": MachineIdentity.machineId(),
            "hostname": MachineIdentity.hostname(),
            "os": MachineIdentity.osName(),
            "agentVersion": AgentInfo.version,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let url = URL(string: cfg.backendUrl + "/api/v1/ingest/enroll") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(cfg.ingestToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = data
        do {
            let (respData, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                AgentLog.write("ENROLL FAILED HTTP \((resp as? HTTPURLResponse)?.statusCode ?? -1)")
                return nil
            }
            guard let dict = try JSONSerialization.jsonObject(with: respData) as? [String: Any],
                  let token = dict["deviceToken"] as? String else { return nil }
            AgentLog.write("ENROLL OK – získán per-device token (délka \(token.count))")
            return token
        } catch {
            AgentLog.write("ENROLL EXCEPTION \(error.localizedDescription)")
            return nil
        }
    }

    func updateDeviceToken(_ token: String) {
        cfg.deviceToken = token
        try? AgentConfig.saveDeviceToken(token)
    }

    /// Pošle dávku JSON intervalů (každý prvek pole je 1 řádek JSON). Volá se
    /// i s prázdným polem jako "heartbeat" – server akceptuje a vrátí lastSeen.
    func sendBatch(intervals: [String]) async -> Bool {
        var sb = "{"
        sb += "\"device\":{"
            + "\"machineId\":\(quote(MachineIdentity.machineId())),"
            + "\"hostname\":\(quote(MachineIdentity.hostname())),"
            + "\"os\":\(quote(MachineIdentity.osName())),"
            + "\"agentVersion\":\(quote(AgentInfo.version))"
            + "},"
        sb += "\"user\":{"
            + "\"sid\":\(quote(MachineIdentity.userSid())),"
            + "\"displayName\":\(quote(MachineIdentity.userDisplayName()))"
            + "},"
        sb += "\"intervals\":[" + intervals.joined(separator: ",") + "]"
        if let logJson = AgentLog.drainAsJsonArray() {
            sb += ",\"agentLog\":" + logJson
        }
        sb += "}"

        guard let url = URL(string: cfg.backendUrl + "/api/v1/ingest"),
              let data = sb.data(using: .utf8) else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(authHeader, forHTTPHeaderField: "Authorization")
        req.httpBody = data
        do {
            let (respData, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                AgentLog.write("INGEST FAILED HTTP \((resp as? HTTPURLResponse)?.statusCode ?? -1)")
                return false
            }
            if let dict = try? JSONSerialization.jsonObject(with: respData) as? [String: Any],
               let enabled = dict["employeeReportEnabled"] as? Bool {
                lastEmployeeReportEnabled = enabled
            }
            AgentLog.write("INGEST OK \(intervals.count) intervalů")
            return true
        } catch {
            AgentLog.write("INGEST EXCEPTION \(error.localizedDescription)")
            return false
        }
    }

    /// Pošle HW snapshot.
    func sendHealth(_ json: String) async {
        guard let url = URL(string: cfg.backendUrl + "/api/v1/ingest/health"),
              let data = json.data(using: .utf8) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(authHeader, forHTTPHeaderField: "Authorization")
        req.httpBody = data
        do {
            _ = try await session.data(for: req)
            AgentLog.write("HEALTH OK")
        } catch {
            AgentLog.write("HEALTH FAILED \(error.localizedDescription)")
        }
    }

    /// Self-token pro otevření "Můj report" v prohlížeči.
    /// Backend ho HMAC-podepíše + nastaví TTL ~5 min. Token se NEUKLÁDÁ
    /// na disku ani v keychain – pokaždé se vyžaduje fresh.
    func requestSelfToken() async -> String? {
        guard let url = URL(string: cfg.backendUrl + "/api/v1/self/token") else { return nil }
        let body = "{\"sid\":\(quote(MachineIdentity.userSid()))}"
        guard let data = body.data(using: .utf8) else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(authHeader, forHTTPHeaderField: "Authorization")
        req.httpBody = data
        do {
            let (respData, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                AgentLog.write("SELF TOKEN FAILED HTTP \((resp as? HTTPURLResponse)?.statusCode ?? -1)")
                return nil
            }
            guard let dict = try JSONSerialization.jsonObject(with: respData) as? [String: Any],
                  let token = dict["token"] as? String else { return nil }
            return token
        } catch {
            AgentLog.write("SELF TOKEN EXCEPTION \(error.localizedDescription)")
            return nil
        }
    }

    /// Tisk a USB sdílí pomocnou metodu (stejný request shape).
    func sendBatchTo(path: String, json: String) async -> Bool {
        guard let url = URL(string: cfg.backendUrl + path),
              let data = json.data(using: .utf8) else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(authHeader, forHTTPHeaderField: "Authorization")
        req.httpBody = data
        do {
            let (_, resp) = try await session.data(for: req)
            let status = (resp as? HTTPURLResponse)?.statusCode ?? -1
            return (200..<300).contains(status)
        } catch { return false }
    }

    private func quote(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s])
        if let d = data, let str = String(data: d, encoding: .utf8) {
            let trimmed = str.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
            return trimmed
        }
        return "\"\(s)\""
    }
}
