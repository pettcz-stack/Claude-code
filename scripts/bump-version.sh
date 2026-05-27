#!/usr/bin/env bash
# Bumpne všechny version pole na zadanou verzi.
# Použití:  ./scripts/bump-version.sh 0.9.3
set -euo pipefail
V="${1:?Usage: $0 <new-version>}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "Bumpuju na $V napříč repo..."

# Node packages
for f in monitoring/backend/package.json monitoring/frontend/package.json; do
  python3 -c "
import json
d = json.load(open('$f'))
d['version'] = '$V'
open('$f', 'w').write(json.dumps(d, indent=2) + '\n')
"
  echo "  ✓ $f"
done

# Swift
sed -i.bak -E "s/(let version = )\"[^\"]+\"/\\1\"$V\"/" monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift
sed -i.bak -E "s/(let buildId = )\"[^\"]+\"/\\1\"$V\"/" monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift
rm monitoring/agent-macos/Sources/FocusAgent/AgentInfo.swift.bak
echo "  ✓ AgentInfo.swift"

# Info.plist
sed -i.bak -E "s|<string>[0-9]+\\.[0-9]+\\.[0-9]+</string>|<string>$V</string>|g" \
  monitoring/agent-macos/Resources/Info.plist
rm monitoring/agent-macos/Resources/Info.plist.bak
echo "  ✓ Info.plist"

# build-pkg.sh
sed -i.bak -E "s/^VERSION=\".*\"$/VERSION=\"$V\"/" monitoring/agent-macos/Scripts/build-pkg.sh
rm monitoring/agent-macos/Scripts/build-pkg.sh.bak
echo "  ✓ build-pkg.sh"

# CI workflow
sed -i.bak -E "s/(--version )\"[0-9]+\\.[0-9]+\\.[0-9]+\"/\\1\"$V\"/" \
  .github/workflows/monitoring-agent-macos-build.yml
rm .github/workflows/monitoring-agent-macos-build.yml.bak
echo "  ✓ macos-build.yml"

# C# .NET (jen pokud Windows agent existuje a měl by se taky bumpnout)
if [ -f monitoring/agent/WorkView.Agent/AgentInfo.cs ]; then
  sed -i.bak -E "s|<Version>[0-9]+\\.[0-9]+\\.[0-9]+</Version>|<Version>$V</Version>|" \
    monitoring/agent/WorkView.Watchdog/WorkView.Watchdog.csproj 2>/dev/null || true
  sed -i.bak -E "s|<Version>[0-9]+\\.[0-9]+\\.[0-9]+</Version>|<Version>$V</Version>|" \
    monitoring/agent/WorkView.Agent/WorkView.Agent.csproj 2>/dev/null || true
  sed -i.bak -E "s/(public const string Version = )\"[^\"]+\"/\\1\"$V\"/" \
    monitoring/agent/WorkView.Agent/AgentInfo.cs
  find monitoring/agent -name "*.bak" -delete
  echo "  ✓ .NET agent"
fi

echo ""
echo "Hotovo. Zkontroluj diff:"
echo "  git diff --stat"
echo ""
echo "Dále:"
echo "  1) Doplň CHANGELOG.md sekci ## [$V] pod ## [Unreleased]"
echo "  2) git add -A && git commit -m 'release: v$V'"
echo "  3) git tag -a v$V -m 'v$V'"
echo "  4) git push && git push origin v$V"
