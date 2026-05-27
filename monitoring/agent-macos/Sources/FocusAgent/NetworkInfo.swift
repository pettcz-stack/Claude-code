import Foundation
#if canImport(Darwin)
import Darwin
#endif

/// Vrátí lokální IPv4 (typicky 10.x / 192.168.x) prvního up rozhraní.
/// Slouží k mapování na Site (provozovnu) podle firemních CIDR – ne k
/// lokalizaci zaměstnance mimo firmu.
enum NetworkInfo {
    static func localIPv4() -> String? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(ifaddr) }

        var ptr = first
        while true {
            let interface = ptr.pointee
            let family = interface.ifa_addr.pointee.sa_family
            if family == UInt8(AF_INET) {
                let name = String(cString: interface.ifa_name)
                // Skip loopback a Tunnel rozhraní (utun*, lo*).
                if !name.hasPrefix("lo") && !name.hasPrefix("utun") && !name.hasPrefix("awdl") {
                    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    let r = getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                                        &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
                    if r == 0 {
                        let ip = String(cString: host)
                        if ip != "0.0.0.0" { return ip }
                    }
                }
            }
            guard let next = interface.ifa_next else { break }
            ptr = next
        }
        return nil
    }
}
