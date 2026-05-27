enum AgentInfo {
    /// Sjednocená verze napříč Windows + macOS. Při bumpu měň všude:
    /// .NET Watchdog + Agent csproj, MSI Product.wxs, backend/frontend
    /// package.json, AgentInfo.cs, tady AgentInfo.swift.
    static let version = "0.9.1"
    static let platform = "macOS"
}
