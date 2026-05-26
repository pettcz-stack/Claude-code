# Test na jednom Windows PC – bez příkazové řádky

Cíl: na jednom Windows PC rozběhnout server i agenta a vidět data v dashboardu.
Vše se ovládá **dvojklikem na připravené soubory** – nic se nepíše do příkazové řádky.

## Co potřebuješ jednou připravit
1. **Docker Desktop** – stáhni z `https://www.docker.com/products/docker-desktop/`,
   nainstaluj, restartuj PC když to vyžádá, spusť ho a počkej, až je vlevo dole
   ikona velryby zelená („Engine running"). V Dockeru samotném nic neklikáš.
2. **Tento projekt** – na GitHubu repo `pettcz-stack/claude-code`, větev
   `claude/employee-monitoring-app-LPmRD` → zelené **Code** → **Download ZIP** →
   rozbal třeba do `C:\focus`.
3. **FocusAgent.msi** – z GitHub → Actions → „Monitoring Agent (Windows build)"
   → poslední zelený běh → dole **Artifacts** → stáhni a rozbal.

## Spuštění serveru (dvojklik)
- Ve složce projektu otevři `monitoring` a **2× klikni na `start-demo.bat`**.
- Počká, až server naběhne, a sám otevře dashboard `http://localhost:8080`
  (přihlášení **admin / admin**).
- Server běží na pozadí. Vypneš ho dvojklikem na **`stop-demo.bat`**.

## Instalace agenta (dvojklik)
1. Soubor `monitoring\installer\install-agent-test.bat` **zkopíruj do složky,
   kde máš `FocusAgent.msi`** (aby byly vedle sebe).
2. **2× klikni na `install-agent-test.bat`** → potvrď okno správce (UAC).
3. Agent se nainstaluje a začne posílat data na `http://localhost:8080`.
4. Po pár minutách běžné práce (myš, klávesnice, aplikace) se v dashboardu
   objevíš jako nové zařízení.
- Odinstalace agenta: dvojklik na **`uninstall-agent-test.bat`**.

## Když něco nepůjde
- Server: znovu spusť `start-demo.bat`, opiš poslední řádky z okna.
- Agent: pošli soubor `%TEMP%\FocusAgent-install.log` a `C:\ProgramData\WorkView\agent.log`.

> Toto je jen TESTOVACÍ režim (demo data, slabé heslo, jen tento PC). Ostré
> firemní nasazení (HTTPS server, GPO, podpis agenta) řeší `installer/deploy-gpo.md`
> a `installer/PILOT-TEST.md`.
