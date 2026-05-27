# Zásady ochrany osobních údajů – FOCUS

*(Vzor pro umístění na web zákazníka nebo jako příloha intranetu. Posuďte
s právníkem/DPO. Viz `00-DISCLAIMER.md`.)*

**Účinné od:** [DOPLŇTE: datum]
**Verze:** [DOPLŇTE]
**Správce osobních údajů:** [DOPLŇTE: zaměstnavatel, IČO, sídlo, DPO kontakt]

---

## 1. Kdo jsme a proč FOCUS používáme

V naší společnosti používáme nástroj **FOCUS** ke kontrole přiměřeného
využití firemních pracovních prostředků (služebních počítačů) dle § 316
odst. 1 zákoníku práce. Účelem je doložení odpracované doby, organizace
práce, ochrana majetku a IT preventivní údržba.

Toto je informace o zpracování osobních údajů dle čl. 13 GDPR a § 316
odst. 3 ZP. Před zavedením monitoringu jsme vás o tom písemně
informovali (viz `01-informace-zamestnancum.md`).

## 2. Jaké údaje sbíráme

FOCUS instalovaný na firemním PC zaznamenává po dobu vašeho přihlášení
do Windows pouze **agregované údaje**:

- **Doba aktivity a nečinnosti** (po minutových intervalech).
- **Název aktivní aplikace** (např. `excel.exe`, `chrome.exe`).
- **Titulek aktivního okna** *pouze pokud je tato funkce zapnuta*. Při
  zapnutí může titulek obsahovat citlivé údaje (název dokumentu, e-mailu,
  webové stránky) – proto je o ní informujeme samostatně.
- **Počet** úhozů na klávesnici a **počet** pohybů/kliků myši.
  **NIKDY** se nezaznamenává **obsah** úhozů ani schránky.
- **Identifikace zařízení**: hostname, MAC adresa, lokální IP (privátní),
  Windows SID, jméno přihlášeného uživatele (z AD/Active Directory).
- **Hardware telemetrie**: model, CPU, RAM, baterie, disky (zdraví),
  antivirus, BIOS verze – pro IT preventivní údržbu.

FOCUS **nesbírá**:

- ❌ Obsah úhozů na klávesnici (keylogger).
- ❌ Snímky obrazovky (screenshots).
- ❌ Obsah souborů, e-mailů, chatu, kamery, mikrofonu.
- ❌ Navštívené URL mimo název okna.
- ❌ Soukromou komunikaci.

## 3. Právní základ zpracování

- **Oprávněný zájem zaměstnavatele** (čl. 6 odst. 1 písm. f) GDPR) na
  kontrole využití firemních prostředků a organizaci práce, **omezený**
  povinnostmi z § 316 ZP. Vyvážení zájmů jsme provedli v dokumentu
  „Balanční test" (k nahlédnutí u DPO).

## 4. Komu se údaje předávají

| Příjemce | Účel | Rozsah |
|---|---|---|
| Vedoucí zaměstnanec, HR, IT správce | Hodnocení, plánování, IT podpora | Agregované údaje vašeho oddělení |
| Poskytovatel SaaS služby FOCUS *(jen pokud nepoužíváme on-prem)* | Provoz služby | Vše, na základě DPA |
| Úřady veřejné moci | Pouze na základě závazného právního důvodu (např. usnesení soudu) | Dle žádosti |

Údaje **nepředáváme** marketingovým partnerům, neprodáváme je.

## 5. Lokalita a předávání mimo EU

Veškerá data zůstávají v rámci **Evropské unie / EHP**:

- Server: [DOPLŇTE: např. „naše interní DC v Praze" nebo „AWS Frankfurt"]
- Zálohy: [DOPLŇTE]

Údaje **nepředáváme** mimo EU/EHP bez Standardních smluvních doložek (SCC).

## 6. Doba uchování

| Údaj | Doba | Důvod |
|---|---|---|
| Surové intervaly aktivity (1minutové) | 35 dní | Minimální detail po dobu reklamace docházky |
| Hodinové a denní agregáty | 540 dní (~18 měsíců) | Doložení dlouhodobých trendů, archivační zákon |
| HW telemetrie (poslední snapshot) | 90 dní | IT preventivní údržba |
| Audit přístupů (kdo z adminů co viděl) | 365 dní | GDPR čl. 32 – transparentnost |
| Identifikační údaje (jméno, SID) | Po dobu pracovního poměru + 30 dní | Návaznost na osobní spis |

Po uplynutí lhůty se údaje **automaticky nevratně smažou** automatizovaným
úlohou. Při ukončení pracovního poměru můžete požádat o okamžitý výmaz
(viz odst. 8).

## 7. Vaše práva

Jako subjekt údajů máte dle GDPR právo:

- **na přístup** (čl. 15) – co o vás zpracováváme. K dispozici je
  self-service portál `https://[DOPLŇTE]/?selfToken=…` (odkaz najdete
  v tray ikoně FOCUS na vašem PC).
- **na opravu** (čl. 16) – pokud je něco nepřesné (např. zařazení do
  oddělení) – ozvěte se HR.
- **na výmaz** (čl. 17) – po skončení pracovního poměru nebo z jiných
  zákonných důvodů.
- **na omezení zpracování** (čl. 18).
- **na přenositelnost údajů** (čl. 20) – v self-service portálu kliknout
  na „Stáhnout všechna moje data (JSON)".
- **na námitku proti zpracování** (čl. 21).
- **podat stížnost u dozorového úřadu** – Úřad pro ochranu osobních
  údajů, www.uoou.cz.

Žádosti směřujte na **[DOPLŇTE: e-mail DPO / HR]**. Odpovíme do 30 dní.

## 8. Kdo se na vaše data smí dívat

Přístup mají pouze:

- vedoucí zaměstnanec / HR / IT správce s rolí ADMIN nebo VIEWER,
- DPO (pověřenec pro ochranu osobních údajů),
- v případě SaaS i pověření pracovníci poskytovatele (na základě DPA).

**Každé nahlédnutí je trvale zaznamenáno** v auditním logu. V self-service
portálu vidíte záložku „Kdo se na moje data díval" se seznamem všech
přístupů.

## 9. Bezpečnost

- Šifrovaný přenos (TLS 1.2+) mezi PC a serverem.
- Šifrovaný diskový svazek serveru.
- HttpOnly + SameSite=Strict cookie pro dashboard.
- Per-device enrollment tokeny (žádný sdílený sekret).
- Pravidelné penetrační testy.
- Zálohy 30 dní šifrované.

## 10. Změny zásad

Tyto Zásady můžeme upravit. Aktuální verzi vždy najdete na
[DOPLŇTE: URL nebo intranetové umístění]. O podstatných změnách vás
budeme informovat e-mailem nebo na poradě nejméně **15 dní předem**.

## 11. Kontakt

- **Pověřenec pro ochranu osobních údajů (DPO):** [DOPLŇTE: jméno, e-mail, telefon]
- **HR oddělení:** [DOPLŇTE]
- **IT správce:** [DOPLŇTE]
