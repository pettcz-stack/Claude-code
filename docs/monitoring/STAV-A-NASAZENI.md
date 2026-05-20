# Monitoring efektivity práce na firemním PC — stav a připravenost k provozu

*Shrnutí k předání vedení / IT. Stav ke dni vydání této větve.*

## 1. Co je hotové

**Backend + dashboard (produkční kvalita, otestováno):**
- Příjem dat od agentů, hodinová agregace, dlouhodobá historie, retence.
- Skóre efektivity, kategorizace činnosti (práce/mimopráce) z aplikací i titulků oken.
- Detekce nepovolených praktik (simulátor myši, předmět na klávesnici, automatizace).
- Přehled firmy (KPI, oddělení, heatmapa „kdy se pracuje"), trendy, žebříček.
- Home Office vyhodnocení (efektivita HO vs. kancelář), počet monitorů, fragmentace pozornosti.
- Report zaměstnance s anonymizovaným srovnáním + volitelné režimy: zábavný, zdravotní, rozvojový.
- E-mailová upozornění (praktiky + výpadek agenta), nastavení v UI, role ADMIN/VIEWER, audit přístupů.
- Export do Excelu, světlý/tmavý režim, 20 automatických testů (zelené).

**Windows agent + watchdog + instalátor (kód kompletní):**
- Agent (`MA win 32.exe`): sběr jen agregovaných metrik, bez obsahu; tichý běh.
- Watchdog služba: po ukončení agenta ho znovu spustí (odolnost proti vypnutí).
- MSI instalátor pro tichou instalaci přes AD/GPO.

**Dokumentace a právo:**
- `DOKUMENTACE.md` (funkce, tok dat, hosting), `BEZPECNOST.md` (audit + opatření).
- `pravni/` – informace pro zaměstnance, DPIA, balanční test (vzory).
- `installer/deploy-gpo.md` – nasazení přes Group Policy.

## 2. Bezpečnost (shrnuto)

- Přenos přes **HTTPS/TLS**, přihlášení přes **session tokeny**, hesla **scrypt**.
- **Rate limiting**, **CSP** a další hlavičky, generická chybová odpověď.
- Řízení rolí, **audit** každého náhledu/exportu dat, retence, minimalizace (žádný obsah).
- V produkci se **odmítne start se slabými výchozími hesly**.
- `npm audit`: backend bez zranitelností (frontend jen dev-server, netýká se produkce).

## 3. Připravenost: ano pro PILOT, plná produkce po checklistu

Software a dashboard jsou připravené. Než pustíme ostře na celou firmu,
je potřeba **dokončit body, které nelze udělat z mé strany**:

**A) Sestavit a otestovat Windows části na Windows** (kritické)
- Zkompilovat agenta, watchdog a MSI (návody v `agent/` a `installer/`).
- Pilotní test na 1–2 PC: tichá instalace přes GPO, ověřit odesílání dat,
  re-launch agenta watchdogem, code-signing + výjimka v antiviru/EDR.

**B) Nasazení serveru (IT)**
- Provoz jen přes **HTTPS** (platný certifikát), **šifrované úložiště** serveru,
  silné `ADMIN_PASSWORD`/`INGEST_TOKEN`, omezení sítě/firewall, zálohy.
- Nastavit **SMTP** pro upozornění.

**C) Právní a organizační (právník/DPO)**
- Schválit a **prokazatelně rozdat informaci zaměstnancům**, dokončit DPIA a balanční test.

**D) Integrace (čeká na přístupy)**
- **OKbase** (HO/dovolená/nemoc) a **Outlook** (meetingy) – teď na demo datech.

## 4. Otevřené body / k vyřešení

1. **Agent/watchdog/MSI nebyly zkompilovány na Windows** (vyvíjeno na Linuxu) –
   nutný build + pilotní test (viz 3A). Toto je hlavní bod před ostrým nasazením.
2. **OKbase a Outlook** zatím nejsou napojené – HO čísla jsou z demo dat.
3. **Kalorie / „naťukaná vzdálenost"** v zábavném režimu jsou orientační odhady.
4. **Časová pásma**: trendy/heatmapa počítají den v UTC; pro ČR doladit na Europe/Prague.
5. **ESLint** nemá flat config (eslint v9+) – kosmetické, doplnit.
6. **Per-device tokeny, 2FA, manažerské role** – doporučená vylepšení (zatím sdílený ingest token + jeden admin).
7. **Verzované DB migrace pro PostgreSQL** – v Dockeru se nyní používá `db push`.

> Závěr: jádro (server + dashboard) je bezpečné a připravené k pilotnímu provozu.
> Pro plné nasazení dokončit Windows build/test, hardening serveru, právní
> schválení a (volitelně) integrace OKbase/Outlook.
