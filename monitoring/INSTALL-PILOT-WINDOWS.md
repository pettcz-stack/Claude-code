# Instalace na 1 testovací PC (server v Dockeru + agent natvrdo)

Tato varianta nasazení je určená pro **jeden testovací Windows PC**, kde:

- **Server FOCUSu běží v Dockeru** na stejném (nebo jiném) PC,
- **Agent je nainstalovaný natvrdo** přes MSI, posílá data na server.

Data SQLite databáze jsou v Docker volume `focus-db`, takže přežijí restart PC i `docker compose down`.

---

## 0. Co budeš potřebovat
- **Windows 10 / 11** (nebo Server 2019+) s admin právy.
- **Docker Desktop** ([download.docker.com](https://www.docker.com/products/docker-desktop)).
- Soubor **`FocusAgent.msi`** (z GitHub Actions → workflow „Agent (Windows build)" → Artifacts → `focus-windows-build`).
- Tento repozitář naklonovaný (kvůli `docker-compose.demo.yml` a doprovodným .bat souborům).

---

## 1. ⚠️ Pokud máš na PC starou verzi agenta — nejdřív odinstaluj

**Stará verze se musí pryč**, jinak by nový MSI buď upgradoval (a běžel s novou logikou), nebo dělal divoké věci.

**Možnost A — přes klikací odinstalátor (doporučeno):**

1. Zkopíruj si `installer/uninstall-agent-test.bat` a starý `FocusAgent.msi` (případně **`DeviceMonitorAgent.msi`** nebo **`WorkViewAgent.msi`** podle stáří instalace) do **jedné společné složky**.
2. Klikni na `uninstall-agent-test.bat` pravým → **Spustit jako správce**.
3. Skript zavolá `msiexec /x` a tiše odinstaluje.

**Možnost B — přes Ovládací panely:**
1. **Nastavení → Aplikace → Nainstalované aplikace**, najdi položku **„MA win 32"** (úmyslně diskrétní jméno) a klikni **Odinstalovat**.

**Možnost C — když nemáš MSI po ruce:** otevři **PowerShell jako Administrator**:
```powershell
sc stop MAWin32 2>$null
sc delete MAWin32 2>$null
# pokud zbyly soubory:
Remove-Item -Recurse -Force "$env:ProgramData\WorkView" -ErrorAction SilentlyContinue
```

**Ověř, že je odinstalováno:**
```powershell
sc query MAWin32      # má vrátit "The specified service does not exist as an installed service"
Get-Process MA* 2>$null
```

---

## 2. Spuštění serveru v Dockeru

1. **Spusť Docker Desktop** a počkej, až se vlevo dole rozsvítí „Engine running".
2. **Z root složky `monitoring/`** dvojklik na **`start-demo.bat`** (nebo v terminálu:
   ```bat
   docker compose -f docker-compose.demo.yml up -d --build
   ```
   První spuštění trvá pár minut — Docker stahuje image a sestavuje. Další už za pár vteřin.
3. V prohlížeči se otevře `http://localhost:8080`. Přihlas se **`admin` / `admin`**.

> 💾 **Data zůstávají ve volume `focus-db`.** Restart PC, `down`, ani rebuild image data nezmaže.
> Úplně čistý začátek: `docker compose -f docker-compose.demo.yml down -v`.

---

## 3. Nasazení agenta na test PC

1. Vytvoř na PC složku, např. `C:\focus-test\`.
2. Zkopíruj do ní:
   - `FocusAgent.msi` (z GitHub Actions),
   - `installer/install-agent-test.bat` (z repa).
3. Pravým na `install-agent-test.bat` → **Spustit jako správce**.

Skript automaticky:
- nainstaluje agenta i jeho watchdog službu (`MAWin32`),
- nastaví `BACKENDURL=http://localhost:8080` a `INGESTTOKEN=dev-token` (to sedí s defaultním tokenem v Dockeru),
- agent se hned přihlásí a začne odesílat.

**Když je server na jiném PC než agent**, uprav `install-agent-test.bat` před spuštěním:

```bat
msiexec /i "%~dp0FocusAgent.msi" /qn /norestart ^
  BACKENDURL=http://<IP-serveru>:8080 INGESTTOKEN=dev-token ...
```

> ⚠️ V tom případě otevři na serveru port **8080** ve firewallu Windows (případně dej trvale).

---

## 4. Ověření, že to funguje

**Na test PC (PowerShell):**
```powershell
sc query MAWin32                                    # má být RUNNING
Get-Process | Where-Object Name -like "MA win 32*"  # má tam být proces
Get-Content -Tail 20 "$env:ProgramData\WorkView\agent.log"  # poslední aktivita
```

**V dashboardu** (`http://localhost:8080` → **Správa → Zařízení**) se do **~5 minut** objeví zařízení s hostname tvého PC. **Aktivita** (po klikání/psaní) přijde do dashboardu za další ~5–10 minut (kvůli agregaci).

---

## 5. Vypnutí / restart

- **Vypnout server:** dvojklik na `stop-demo.bat` (nebo `docker compose -f docker-compose.demo.yml down`).
- **Restart serveru:** `start-demo.bat` ho rozjede znovu, data jsou stejná.
- **Restart agenta** (po dlouhém spánku PC, pokud běží stará verze bez resume handleru):
  ```powershell
  Restart-Service MAWin32
  ```
  Nová verze agenta (od commitu `01727e6` výš) tohle dělá **automaticky** při probuzení.

---

## 6. Časté problémy

| Symptom | Příčina | Řešení |
|---|---|---|
| `[CHYBA] Docker Desktop nebezi` | Docker Desktop nestartuje | Otevři Docker Desktop, počkej na „Engine running" |
| Port 8080 už používá jiná aplikace | Konflikt portů | V `docker-compose.demo.yml` změň `'8080:8080'` na `'9090:8080'`, pak na agentovi nastav `BACKENDURL=http://localhost:9090` |
| Agent nainstalovaný, ale dashboard nevidí zařízení | Token nesedí / síť | `reg query HKLM\SOFTWARE\WorkView` zkontroluj `IngestToken`, srovnej s `INGEST_TOKEN` v Dockeru (default `dev-token`) |
| Po probuzení PC nic nepřichází | Agent má mrtvé TCP spojení | `Restart-Service MAWin32` (krátkodobá oprava) NEBO updejtni MSI na verzi s resume handlerem |
| Antivirus / Defender hlásí agenta | Není code-signed | Pro test přidej výjimku na `C:\Program Files\WorkView\`. Pro produkci podepiš MSI EV certifikátem |
| Chci úplně čistý začátek | DB má staré demo nebo test data | `docker compose -f docker-compose.demo.yml down -v` smaže volume |

---

## Co je „natvrdo" a co je „v Dockeru"

| Komponenta | Kde | Trvalost |
|---|---|---|
| **Agent + watchdog služba** | Nainstalované na test PC (`C:\Program Files\WorkView\`, služba `MAWin32`) | Přežijí restart, dokud nedojde k odinstalaci. |
| **SQLite databáze** | Docker volume `focus-db` | Přežije `docker compose down`, restart PC. Smaže ji jen `down -v`. |
| **Backend + dashboard** | Docker kontejner z image | Restartuje se s Docker Desktopem (`restart: unless-stopped`). |
| **Konfigurace agenta** | Registry `HKLM\SOFTWARE\WorkView` | Trvalá, dokud nepřeinstaluješ. |
