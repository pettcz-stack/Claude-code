import Foundation
import AppKit

/// Menu bar ikonka FOCUS agenta – ekvivalent Windows tray ikony.
///
/// Cíl: zaměstnanec vidí, že FOCUS běží, a může si **kdykoli otevřít vlastní
/// report** ("Můj report") s přehledem co o něm systém ví. To je klíčový prvek
/// transparentnosti, který se hodí jak pro odbory, tak pro DPO (GDPR čl. 13).
///
/// Implementace:
///  - NSStatusBar.system.statusItem (variable length) s SF Symbol ikonkou.
///  - Klik → menu se 3 položkami:
///      1) "Můj report" → POST /api/v1/self/token → otevři default browser.
///      2) "Otevřít diagnostiku" → otevři Finder na /Library/Application Support/FOCUS/.
///      3) "Verze 0.9.2 (build ...)" – informativní, neklikatelná.
///
/// Visibility: pokud `employeeReportEnabled=false` (Nastavení v dashboardu),
/// ikona se nezobrazí – stejně jako Windows Sender lastEmployeeReportEnabled.
final class MenuBarController {
    private let cfg: AgentConfig
    private let sender: Sender
    private var statusItem: NSStatusItem?

    init(cfg: AgentConfig, sender: Sender) {
        self.cfg = cfg
        self.sender = sender
    }

    /// Zobrazí menu bar item. Musí běžet na main thread (NSStatusBar API požaduje).
    func install() {
        DispatchQueue.main.async { [weak self] in
            self?.createStatusItem()
        }
    }

    private func createStatusItem() {
        // Variable length – šířka ikony se přizpůsobí. SF Symbol "gauge" je vizuálně
        // jasný a srozumitelný (rychloměr = produktivita).
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            if let image = NSImage(systemSymbolName: "gauge.with.dots.needle.50percent", accessibilityDescription: "FOCUS") {
                image.isTemplate = true // automaticky se přebarví podle dark/light mode
                button.image = image
            } else {
                button.title = "F"
            }
            button.toolTip = "FOCUS Agent \(AgentInfo.version) – monitoring běží"
        }

        let menu = NSMenu()

        // "Můj report"
        let reportItem = NSMenuItem(title: "Můj report…", action: #selector(MenuTarget.openReport), keyEquivalent: "")
        let target = MenuTarget(sender: sender)
        reportItem.target = target
        menu.addItem(reportItem)

        menu.addItem(NSMenuItem.separator())

        // "Otevřít diagnostiku" – Finder na /Library/Application Support/FOCUS
        let diagItem = NSMenuItem(title: "Otevřít složku agenta…", action: #selector(MenuTarget.openFocusFolder), keyEquivalent: "")
        diagItem.target = target
        menu.addItem(diagItem)

        menu.addItem(NSMenuItem.separator())

        // Info o verzi (neklikatelné)
        let infoItem = NSMenuItem(title: "FOCUS Agent \(AgentInfo.version) (build \(AgentInfo.buildId))", action: nil, keyEquivalent: "")
        infoItem.isEnabled = false
        menu.addItem(infoItem)

        item.menu = menu
        // Drž referenci, jinak se NSStatusItem dealokuje a zmizí
        self.statusItem = item
        // Drz cely MenuTarget – ARC by ho jinak smazal protoze NSMenuItem.target je weak
        objc_setAssociatedObject(item, &MenuBarController.targetKey, target, .OBJC_ASSOCIATION_RETAIN)

        AgentLog.write("MenuBar: ikonka v menu baru aktivní.")
    }

    private static var targetKey: UInt8 = 0
}

/// Mosty Swift -> @objc selectory. NSMenuItem.action vyžaduje Objective-C metodu.
@objc final class MenuTarget: NSObject {
    private let sender: Sender

    init(sender: Sender) {
        self.sender = sender
        super.init()
    }

    @objc func openReport() {
        Task { [weak self] in
            guard let self = self else { return }
            let backendUrl = self.sender.cfg.backendUrl
            let token = await self.sender.requestSelfToken()
            await MainActor.run {
                let urlString: String
                if let token = token, !token.isEmpty {
                    // Fragment (#) místo query (?) – token se NEPOSÍLÁ na server,
                    // neukáže se v access-logu ani v back-end logu reverzní proxy.
                    urlString = "\(backendUrl)/#selfToken=\(token)"
                } else {
                    // Fallback – otevři dashboard bez tokenu, user se ručně přihlásí.
                    AgentLog.write("MenuBar: self-token selhal, otevírám dashboard bez tokenu.")
                    urlString = backendUrl
                }
                if let url = URL(string: urlString) {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }

    @objc func openFocusFolder() {
        let url = URL(fileURLWithPath: "/Library/Application Support/FOCUS", isDirectory: true)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }
}
