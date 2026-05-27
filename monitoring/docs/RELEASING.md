# Releasing FOCUS

Tento dokument popisuje jak vydat novou verzi FOCUS. Cílem je, aby každý
push branche `main` (jakmile bude existovat) byl deployovatelný a aby každá
verze měla jasně dokumentované, co se v ní změnilo.

## Kdy bumpnout verzi

Aktuálně jsme **před GA** (vývoj na branchi `claude/employee-monitoring-app-LPmRD`).
Verze se bumpuje při každém **smysluplném pilotním milníku** — typicky cca 1× týdně
nebo když se sejde větší dávka změn pro pilotujícího zákazníka.

Po GA: SemVer.

| Změna | Bump |
|---|---|
| Breaking API change, migrace dat | **MAJOR** (`1.x.x` → `2.0.0`) |
| Nová funkce, nový endpoint, nová UI sekce | **MINOR** (`0.9.x` → `0.10.0`) |
| Bugfix, drobné UX vylepšení, perf | **PATCH** (`0.9.1` → `0.9.2`) |

Současný stav `0.9.x` = pre-GA pilot. Patch bump používáme i pro malé features,
protože ještě nejsme stabilní API. Po vydání `1.0.0` budeme MINOR/MAJOR striktnější.

## Soubory s verzí

Při bumpu **změň všechny tyto soubory** na stejnou verzi (ideálně skriptem
`scripts/bump-version.sh`, viz níže):

| Soubor | Pole |
|---|---|
| `monitoring/backend/package.json` | `"version"` |
| `monitoring/frontend/package.json` | `"version"` |
| `monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift` | `static let version` |
| `monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift` | `static let buildId` |
| `monitoring/agent-macos/Resources/Info.plist` | `CFBundleVersion`, `CFBundleShortVersionString` |
| `monitoring/agent-macos/Scripts/build-pkg.sh` | `VERSION="…"` |
| `.github/workflows/monitoring-agent-macos-build.yml` | `pkgbuild --version "…"` |
| `monitoring/agent/WorkView.Agent/AgentInfo.cs` | `Version` (jen kdy se Windows agent mění) |
| `monitoring/agent/WorkView.Watchdog/WorkView.Watchdog.csproj` | `<Version>` |
| `installer/Product.wxs` | `Version="…"` (WiX MSI) |
| `monitoring/frontend/src/releases.ts` | nová položka v `RELEASES[]` (TOP) |

**`releases.ts` je SSOT pro UI:** sidebar footer, UserMenu badge,
WhatsNewBanner i `<NewBadge />` čtou z `CURRENT_VERSION = RELEASES[0].version`.
Pokud do `releases.ts` přidáš novou položku s `features: ['xxx']`,
po deployi se uživateli ukáže banner "Nová verze X.Y.Z je tady" a klíčové
features dostanou ✨ NEW badge.

## Postup release

1. **CHANGELOG.md** — přesuň obsah ze `## [Unreleased]` do nové sekce `## [X.Y.Z] — Název — YYYY-MM-DD`.
   Sekce `[Unreleased]` zůstává prázdná (jen nadpis) pro další iteraci.

2. **Bump verzí** — buď ručně podle tabulky výše, nebo skriptem:
   ```bash
   ./scripts/bump-version.sh 0.9.3
   ```

3. **Build verifikace**:
   ```bash
   cd monitoring/backend && npx tsc --noEmit && npm test -- --run
   cd monitoring/frontend && npx tsc --noEmit && npm run build
   ```

4. **Commit a tag**:
   ```bash
   git add -A
   git commit -m "release: v0.9.3"
   git tag -a v0.9.3 -m "v0.9.3 — krátký název"
   git push origin claude/employee-monitoring-app-LPmRD
   git push origin v0.9.3
   ```

5. **GitHub Release** se vytvoří **automaticky** ze CHANGELOG sekce přes
   workflow `release-notes.yml` (existuje, sleduje push tagů `v*`).

6. **Pkg/MSI artefakty** — CI workflow `monitoring-agent-*-build.yml` se
   spustí automaticky a publikuje do release `agent-latest` (rolling pre-release).
   Po tagu se taky publikuje samostatný release `v0.9.3` se stable artefakty.

## CHANGELOG šablona

```markdown
## [X.Y.Z] — Krátký název iterace — YYYY-MM-DD

**TL;DR:** Jeden odstavec o tom, co je v této verzi nejdůležitější.
Komu se to týká (admin, IT, end-user) a proč to upgradovat.

### 🆕 Přidáno
- **Název feature** — popis (co, proč, kde to vidět v UI nebo API).

### 🔧 Opraveno
- **Co bylo zlomené** — popis chování před / po.

### 🚀 Výkon
- **Změna** — měřitelný výsledek (-X %, +Y rps, atd.).

### 🛡️ Bezpečnost
- **Vulnerabilita / hardening** — co se opravilo, jaký dopad.

### ⚠️ Breaking
- (Jen pokud MAJOR bump) Co se mění v API / DB a jak migrovat.

### 📦 Verze komponent v X.Y.Z

| Komponenta | Verze |
|---|---|
| Backend | X.Y.Z |
| Frontend | X.Y.Z |
| Agent macOS | X.Y.Z |
| Agent Windows | X.Y.Z |
| Prisma migrace | název |
```

## Skript `scripts/bump-version.sh`

```bash
#!/usr/bin/env bash
# Bumpne všechny version pole na zadanou verzi.
# Použití:  ./scripts/bump-version.sh 0.9.3
set -euo pipefail
V="${1:?Usage: $0 <new-version>}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Node packages
for f in monitoring/backend/package.json monitoring/frontend/package.json; do
  python3 -c "
import json
d = json.load(open('$f'))
d['version'] = '$V'
json.dump(d, open('$f', 'w'), indent=2)
open('$f', 'a').write('\n')
"
done

# Swift
sed -i.bak -E "s/(let version = )\"[^\"]+\"/\\1\"$V\"/" monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift
sed -i.bak -E "s/(let buildId = )\"[^\"]+\"/\\1\"$V\"/" monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift
rm monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift.bak

# Info.plist
sed -i.bak -E "s|<string>[0-9]+\\.[0-9]+\\.[0-9]+</string>|<string>$V</string>|g" \
  monitoring/agent-macos/Resources/Info.plist
rm monitoring/agent-macos/Resources/Info.plist.bak

# build-pkg.sh
sed -i.bak -E "s/^VERSION=\".*\"$/VERSION=\"$V\"/" monitoring/agent-macos/Scripts/build-pkg.sh
rm monitoring/agent-macos/Scripts/build-pkg.sh.bak

# CI workflow
sed -i.bak -E "s/(--version )\"[0-9]+\\.[0-9]+\\.[0-9]+\"/\\1\"$V\"/" \
  .github/workflows/monitoring-agent-macos-build.yml
rm .github/workflows/monitoring-agent-macos-build.yml.bak

# C# .NET
sed -i.bak -E "s|<Version>[0-9]+\\.[0-9]+\\.[0-9]+</Version>|<Version>$V</Version>|" \
  monitoring/agent/WorkView.Watchdog/WorkView.Watchdog.csproj \
  monitoring/agent/WorkView.Agent/WorkView.Agent.csproj 2>/dev/null || true
sed -i.bak -E "s/(public const string Version = )\"[^\"]+\"/\\1\"$V\"/" \
  monitoring/agent/WorkView.Agent/AgentInfo.cs
find monitoring/agent -name "*.bak" -delete

echo "Bumped $V"
git diff --stat
```
