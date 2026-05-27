# FOCUS Agent — macOS

Nativní macOS agent FOCUS pro Apple Silicon (M1/M2/M3+) i Intel Macy.

- **Jazyk:** Swift 5.7+
- **Min. OS:** macOS 11 Big Sur
- **Architektury:** Universal binary (arm64 + x86_64)
- **Verze:** stejná jako Windows (v0.9.1)
- **Komunikace:** identický backend protokol jako Windows agent — žádné změny serveru

## Co umí (parita s Windows agentem v0.9.1)

| Funkce | macOS implementace |
|---|---|
| Aktivita / nečinný čas | `IOHIDSystem.HIDIdleTime` (IOKit) |
| Foreground aplikace | `NSWorkspace.frontmostApplication` |
| Titulek aktivního okna | Accessibility API (`AXUIElementCopyAttributeValue`) |
| Počty kláves a kliků | `CGEventTap` (listen-only, NIKDY obsah) |
| HW telemetrie | `system_profiler`, `pmset`, `sysctl`, `FileManager` |
| Tisk | CUPS `/var/log/cups/page_log` přes `DispatchSource` (kqueue) |
| USB / externí disky | `FSEvents` nad `/Volumes/*` |
| Identifikace stroje | `IOPlatformUUID` (totéž jako Windows GUID) |
| Per-device enrollment token | Stejný flow jako Windows (sdílený → enrollment → per-device) |
| Activity log streaming | In-memory ring buffer → vyprázdněn každým /ingest |
| Heartbeat každý send-interval | Stejné jako Windows |
| Watchdog | macOS `launchd` (KeepAlive=true + ThrottleInterval) |
| Auto-aktualizace | Přes MDM update payload (Jamf/Kandji/Mosyle/Intune) |

## Permissions (důležité!)

macOS vyžaduje **uživatelovo schválení** pro citlivá API. Bez nich agent
běží, ale s omezenou funkcionalitou:

| Permission | Co bez něj nefunguje |
|---|---|
| **Accessibility** | Titulky aktivních oken (foreground app stačí AppKit) |
| **Input Monitoring** | Počty kláves/kliků (HID idle time funguje dál) |
| **Full Disk Access** | CUPS print log, FSEvents na /Volumes ostatních uživatelů |

### ⚠️ Permissions resetují při každém update (známé omezení ad-hoc podpisu)

Agent je v pilot fázi **ad-hoc podepsaný** (bez Developer ID). macOS TCC
pamatuje povolení podle CDHash binárky – ten se s každým rebuildem mění,
takže po update Input Monitoring a Accessibility znovu žádají schválení.

**Krátkodobé řešení:** spusť `install-mac.sh` po každém update – nově detekuje,
co konkrétně chybí, a otevře pouze ty System Settings panely, kde je třeba
ručně přidat focus-agent. ~30 s práce.

**Dlouhodobé řešení (před GA):** Apple Developer Program ($99/rok) →
Developer ID Application certifikát → podpis přes `codesign --sign "Developer ID..."`.
TCC pak bude tracovat podle stabilního **Team ID + bundle ID**, povolení
přežije všechny updaty bez zásahu uživatele. Toto je standardní postup pro
distribuci macOS softwaru mimo App Store.

### Hromadné předudělení přes MDM (doporučeno)

Při enterprise nasazení vytvořte **PPPC profil (Privacy Preferences Policy
Control)** v MDM (Jamf/Kandji/Mosyle/Intune) — uživatelé pak nemusí klikat.

Bundle ID agenta: `com.sinsu.focusagent` (TCC services: `kTCCServiceAccessibility`,
`kTCCServiceListenEvent`, `kTCCServiceSystemPolicyAllFiles`).

### Manuální (pro testování)

```text
System Settings → Privacy & Security
  → Accessibility       → ✓ focus-agent
  → Input Monitoring    → ✓ focus-agent
  → Full Disk Access    → ✓ focus-agent
```

## Build .pkg installeru (na Macu)

```bash
cd monitoring/agent-macos
./Scripts/build-pkg.sh
```

Pro **podepsaný + notarized** balíček (povinné pro distribuci mimo MDM):

```bash
# 1) Apple Developer ID Installer cert v Keychain
PRODUCT_SIGN_ID="Developer ID Installer: Sinsu Platform s.r.o. (XXXXXXXXXX)" \
  ./Scripts/build-pkg.sh

# 2) Notarizace (max ~5 min)
xcrun notarytool submit focus-agent-macos.pkg \
  --keychain-profile "AC_PASSWORD" --wait

# 3) Stapling (vloží notarizační ticket do .pkg, ať funguje offline)
xcrun stapler staple focus-agent-macos.pkg
```

Cena Apple Developer Program: **99 USD / rok**.

## Konfigurace

Per-machine config v `/Library/Application Support/FOCUS/config.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>BackendUrl</key>            <string>https://focus.firma.cz</string>
    <key>IngestToken</key>           <string>__SET_BY_MDM_OR_INSTALL__</string>
    <key>IntervalSeconds</key>       <integer>60</integer>
    <key>SendIntervalSeconds</key>   <integer>120</integer>
    <key>CaptureWindowTitle</key>    <true/>
    <key>IdleThresholdSeconds</key>  <integer>300</integer>
    <key>TrackPrint</key>            <false/>
    <key>CapturePrintDocName</key>   <false/>
    <key>TrackUsb</key>              <false/>
    <key>CaptureUsbFilename</key>    <false/>
</dict>
</plist>
```

Per-device token získaný enrollmentem (postupně po prvním běhu):
`/Library/Application Support/FOCUS/device-token` (chmod 600).

## Tichá instalace na cíli

```bash
sudo installer -pkg focus-agent-macos.pkg -target /
```

(MDM dělá totéž automatizovaně.)

## Soubory na cílovém Macu

| Cesta | Účel |
|---|---|
| `/Library/Application Support/FOCUS/focus-agent` | Binárka agenta |
| `/Library/Application Support/FOCUS/config.plist` | Konfigurace |
| `/Library/Application Support/FOCUS/device-token` | Per-device auth token (chmod 600) |
| `/Library/Application Support/FOCUS/agent.log` | Log agenta (rotace 1 MiB) |
| `/Library/Application Support/FOCUS/spool.ndjson` | Buffer intervalů (přežívá restart) |
| `/Library/LaunchAgents/com.sinsu.focusagent.plist` | launchd config |

## Odinstalace

```bash
sudo launchctl unload /Library/LaunchAgents/com.sinsu.focusagent.plist
sudo rm /Library/LaunchAgents/com.sinsu.focusagent.plist
sudo rm -rf "/Library/Application Support/FOCUS"
# Volitelně i Receipts:
sudo pkgutil --forget com.sinsu.focusagent
```

## Co macOS NEDĚLÁ stejně jako Windows

| Aspekt | Důvod |
|---|---|
| Sběr keystroke obsahu | Stejné – NIKDY (zákaz §316 ZP + GDPR) |
| Screenshoty | Stejné – NIKDY |
| Microphone / kamera | Stejné – NIKDY |
| Tray ikona (zobrazení pro zaměstnance) | macOS používá menu bar item; *nezahrnuto v v0.9.1*, plánováno v0.10. Zatím self-service URL přes browser link. |
| Sdílené síťové disky | FSEvents pokrývá jen `/Volumes/`. NFS/AFP/SMB mounty občas nestreamují eventy stejně spolehlivě. |

## Bezpečnost a transparentnost

Stejné principy jako Windows:

- HTTPS-only (kromě localhost pro vývoj)
- TLS validace přes systémový trust store (Sender používá výchozí URLSession)
- Per-device enrollment tokens
- Activity log streaming do dashboardu (admin vidí stav agenta z prohlížeče)
- Capture title / print docname / usb filename — vše opt-in (default OFF u tisku/USB,
  default ON jen u window title — totéž jako Windows v0.9.1+)

## Roadmap macOS agent

- v0.9.x: parita s Windows (tato verze)
- v1.0: notarized + stapled .pkg, hromadné podepsání pro store distribuci
- v1.1: NSStatusItem (menu bar tray ikona pro zaměstnanecký self-report)
- v1.2: integrace Apple MDM zero-touch enrollment
