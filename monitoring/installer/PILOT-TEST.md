# Pilotní test na Windows (1–2 testovací PC)

Cíl: ověřit, že se agent tiše nainstaluje, sbírá a odesílá data, je odolný proti
vypnutí (watchdog) a antivirus ho neoznačí. Runtime test nelze udělat na Linuxu –
proběhne na Windows.

## 0. Build MSI
- Automaticky: GitHub Actions workflow **„Monitoring Agent (Windows build)"** →
  stáhni artefakt `monitoring-windows-build` (obsahuje `WorkViewAgent.msi`).
- Nebo lokálně: `pwsh monitoring/agent/build-all.ps1` (vyžaduje .NET SDK).

## 1. Příprava serveru (dev/test)
- Spusť backend (např. `monitoring/dev.sh` nebo Docker), zjisti `INGEST_TOKEN`.
- Ověř, že je dostupný z testovacího PC (HTTP(S) na `BACKENDURL`).

## 2. Tichá instalace
```
msiexec /i WorkViewAgent.msi /qn ^
  BACKENDURL=https://<server> INGESTTOKEN=<token> INTERVALSECONDS=60 CAPTURETITLE=1
```
Ověř:
- [ ] služba **`MAWin32`** existuje a běží (`services.msc` nebo `sc query MAWin32`),
- [ ] po přihlášení uživatele běží proces **`MA win 32.exe`** v jeho session (Správce úloh),
- [ ] v `HKLM\SOFTWARE\WorkView` jsou hodnoty (BackendUrl, IngestToken…).

## 3. Sběr a odeslání dat
- Pracuj ~10 minut (myš, klávesnice, přepínání aplikací, prohlížeč).
- [ ] V dashboardu se objeví zařízení a po pár minutách aktivita,
- [ ] sedí počet monitorů, aktivní/nečinný čas, kategorie z titulků oken,
- [ ] při odpojení sítě se data nakešují (`%ProgramData%\WorkView\spool.ndjson`)
      a po obnově dorazí.

## 4. Odolnost proti vypnutí (watchdog)
- Ve Správci úloh ukonči `MA win 32.exe`.
- [ ] do ~20 s ho služba `MAWin32` znovu spustí (viz `%ProgramData%\WorkView\watchdog.log`),
- [ ] běžný uživatel bez admin práv službu `MAWin32` nezastaví.

## 5. Antivirus / EDR
- [ ] Defender/EDR agenta neoznačí. Pokud ano: podepiš `.exe`/`.msi`
      code-signing certifikátem a přidej výjimku (globální hook klávesnice/myši
      bývá heuristicky hlídán). Viz `../../docs/monitoring/DOKUMENTACE.md`.

## 6. Odinstalace / upgrade
- [ ] `msiexec /x WorkViewAgent.msi /qn` službu zastaví, odebere a uklidí,
- [ ] upgrade vyšší verzí MSI proběhne (MajorUpgrade).

## Co hlásit zpět
Výstup z `watchdog.log` a `agent.log`, screenshot dashboardu, případná hlášení AV.
