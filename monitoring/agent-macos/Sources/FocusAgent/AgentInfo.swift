enum AgentInfo {
    /// Sjednocená verze napříč Windows + macOS. Při bumpu měň všude:
    /// .NET Watchdog + Agent csproj, MSI Product.wxs, backend/frontend
    /// package.json, AgentInfo.cs, tady AgentInfo.swift.
    static let version = "0.9.1"
    static let platform = "macOS"
    /// Identifikátor konkrétního buildu – mění se s každým commitem agenta,
    /// aby šlo z logu okamžitě poznat, jestli běží stará nebo nová binárka.
    /// Bumpni při každé změně v monitoring/agent-macos/Sources/**.
    static let buildId = "2026-05-27-codesign"
}
