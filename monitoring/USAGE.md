# Uživatelská příručka — vedení / HR / IT

Krátký průvodce, co kde v dashboardu najdete a jak nástroj nasadit férově.

## Přihlášení

Otevřete adresu, kterou vám dalo IT (např. `https://device-monitor.firma.cz/`),
zadejte uživatelské jméno a heslo. Pro každou roli (ADMIN / VIEWER) lze založit
samostatné účty.

## Levé menu — záložky

| Záložka | Co tam je |
|---|---|
| **Přehled** | KPI firmy: skóre, aktivní hodiny, zábava %, lokality, top/bottom týmy |
| **Home Office** | Srovnání efektivity HO vs kancelář, podíl zábavy |
| **Detail uživatele** | Vyber jednoho – jeho skóre, aplikace, focus sessions, monitory |
| **Žebříček** | Sestupně podle skóre, férově zarovnaný (po odečtu dovolených) |
| **Upozornění** | Detekované pirátské praktiky (jiggler myši, automatizace) |
| **Trendy** | Vývoj v čase (skóre, podíl zábavy, monitory) |
| **Aplikace & weby** | Top aplikace a weby napříč firmou / oddělením |
| **Software & náklady** | Kolik stojí nepouživaný software + cena neproduktivního času v Kč |
| **Kalendář** | Per uživatel, denní heatmapa |
| **Firemní přehled** | Tabulka všech uživatelů – jednorázový pohled |
| **Správa** | Zařízení, uživatelé, oddělení, mzdy, reklamace klasifikace |
| **IT – zdraví zařízení** | Prediktivní HW monitoring (SMART, baterie, RAM, BIOS, antivirus) |
| **Nastavení** | Upozornění, soukromí, retence, klasifikace, výjimky podle oddělení |

## Jak číst skóre

- **Skóre** je % naplnění očekávaného pracovního dne **aktivní prací**.
- **Dovolená / nemoc / svátky** se NEpočítají proti — den se vyřadí z dělitele.
- **Více monitorů** = bonus u IT/Konstrukce/Vývoje (handicap factor).
- **Zaokrouhlení** je na celé %.

> ⚠️ Skóre **není známka člověka**. Je to **indikátor využití firemního PC**.
> Pracovní výkon se měří výsledky, ne hodinami u obrazovky.

## Klasifikace — práce vs. zábava

Aplikace a weby jsou rozdělené do **kategorií** (CRM, e-mail, sociální sítě, sázky, hry, prohlížeč…). Každá kategorie má **typ**:

- **WORK** (práce) — započítá se do aktivní práce.
- **NON_WORK** (zábava) — započítá se proti.
- **NEUTRAL** — necítaná do skóre (např. systémové utility).
- **UNKNOWN** — vyjmuto, dokud admin nezařadí (nestrhává body).

V **Nastavení → klasifikace** můžeš:
- přidat / upravit kategorii aplikace,
- přidat pravidlo pro web (klíčové slovo v titulku okna nebo doména),
- přidat **výjimku podle oddělení** — např. LinkedIn = WORK pro Personalistiku.

## Per-oddělení výjimky (důležité pro HR/Nábor)

LinkedIn je defaultně zábava — ale pro HR/Personalistika/Nábor je to nábor (práce).
Toto je předvyplněno. Vlastní výjimky přidej v **Nastavení → klasifikace → Pravidla podle oddělení**:

| Oddělení | Kategorie | Typ |
|---|---|---|
| Personalistika | LinkedIn | WORK |
| Marketing | Sociální sítě | WORK (správa profilů) |
| Obchod | LinkedIn | WORK (sales výzkum) |

## Soukromí a uchovávání dat

V **Nastavení → Soukromí a uchovávání dat (GDPR)**:

- **Ukládat z prohlížeče jen doménu** — místo „Schůzka 14:00 – Outlook" se uloží jen `outlook.com`. Bez ztráty klasifikace. Doporučeno pro DE/expanzi.
- **Retence** — kolik dní držet syrové intervaly s detailem. **Denní agregáty (kolik % byla práce / zábava) zůstávají navždy.** Rychlé presety: 90 dní (privacy-first) / 1 / 3 / 5 let (drží detail navždy).

## Report zaměstnance (volitelné)

V **Nastavení → Report zaměstnance** můžeš:

- **Zpřístupnit report přímo zaměstnancům** (ikonka v liště PC) — uvidí sami svůj rozpad, focus sessions, nejproduktivnější hodinu, trend tento týden vs minulý.
- **Ukázat zaměstnanci „kdo se na moje data díval"** — transparentní výpis přístupů. Pro CZ vypnuto; doporučeno pro firmy s odbory a německý trh.
- **Zábavné / zdravotní / rozvojové režimy** — odznaky, kalorie psaní, citáty velikánů.

Bez zapnutí těchto přepínačů zaměstnanec **nevidí absolutně nic** — do aplikace má přístup jen vedení/HR/IT.

## IT — zdraví zařízení

Záložka **IT – zdraví zařízení** ukazuje prediktivní HW monitoring:

- **Kritické** (červené) = okamžitá akce: vypnutý antivirus, plný disk, SMART hlásí poruchu, dochází baterie pod 50 %.
- **Pozor** (žluté) = naplánovat: skoro plný disk, opotřebená baterie, hodně čekajících aktualizací, dlouhé uptime.
- **V pořádku** (zelené) = nic neřešit.

Kliknutím na zařízení se otevře detail s úplným rozpisem (OS, BIOS, CPU, RAM, baterie, jednotlivé disky, antivir).

## Reklamace klasifikace

Když je zaměstnanec přesvědčen, že aplikace je špatně zařazená (CRM místo „sociální sítě"), může v reportu **podat reklamaci**. ADMIN ji v **Správě → Reklamace** schválí/zamítne (→ kategorie se přepíše napříč firmou).

## Jak nasadit férově (právní)

1. **Před spuštěním** informujte zaměstnance — viz šablona [`docs/pravni/01-informace-zamestnancum.md`](docs/pravni/01-informace-zamestnancum.md).
2. **Uzavřete DPIA** — šablona [`docs/pravni/02-dpia-podklad.md`](docs/pravni/02-dpia-podklad.md).
3. Pokud máte odbory / radu zaměstnanců: **projednejte / uzavřete dohodu**. Pro DE pobočky je to povinné (Betriebsvereinbarung).
4. **Důsledně nepoužívejte** k disciplinárním řízením proti jednotlivci bez kontextu — nástroj je pro agregovaný pohled a optimalizaci.

Viz také [`docs/pravni/00-DISCLAIMER.md`](docs/pravni/00-DISCLAIMER.md) a [`docs/pravni/03-balancni-test.md`](docs/pravni/03-balancni-test.md).
