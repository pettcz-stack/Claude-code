// swift-tools-version:5.7
// FOCUS Agent pro macOS – Swift Package.
// Build:    swift build -c release
// Spuštění: .build/release/focus-agent
import PackageDescription

let package = Package(
    name: "FocusAgent",
    platforms: [
        .macOS(.v11), // Big Sur a novější (Apple Silicon i Intel)
    ],
    products: [
        .executable(name: "focus-agent", targets: ["FocusAgent"]),
    ],
    targets: [
        .executableTarget(
            name: "FocusAgent",
            path: "Sources/FocusAgent"
        ),
    ]
)
