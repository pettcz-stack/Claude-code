# Právní manuál FOCUS

*Monitoring přiměřeného využití firemních PC podle českého práva a GDPR (verze platná k roku 2026).*

*Tento dokument je **interní podklad pro správce a DPO**. Před uvedením do provozu musí být schválen advokátem / pověřencem pro ochranu osobních údajů. Viz `00-DISCLAIMER.md`.*

> **Pro koho je manuál určen:**
> – HR a vedení firmy, které FOCUS nasazuje
> – IT správce, který program instaluje
> – Pověřenec pro ochranu osobních údajů (DPO), pokud je jmenován
> – Advokát při finálním právním auditu

---

## 1. Co FOCUS sbírá a co NIKDY nesbírá

Manuál je psán s vědomím, jak FOCUS **technicky** pracuje. Část právních rizik
spojených s monitorovacími nástroji se na FOCUS **nevztahuje**, protože program
záměrně nesbírá obsah komunikace, soubory ani screenshoty.

### Co FOCUS na firemním PC sbírá

| Údaj | Účel | Citlivost dle GDPR |
|---|---|---|
| **Doba aktivity / nečinnosti** (po minutách, agregováno na hodiny) | Doložení odpracované doby (§ 96 ZP) | Běžný osobní údaj |
| **Název aktivní aplikace** (`excel.exe`, `chrome.exe`) | Klasifikace pracovní vs. mimopracovní činnosti | Běžný osobní údaj |
| **Titulek aktivního okna** *(opt-in `CAPTURETITLE=1`)* | Jemnější klasifikace (např. odlišení Wikipedie od YouTube) | Může obsahovat citlivý údaj — proto opt-in |
| **Počet úhozů a počet kliků** (pouze počítadlo, **NIKDY** obsah) | Detekce nečinnosti, tempo práce | Běžný |
| **Hostname, MAC, lokální IP, Windows SID, jméno uživatele** | Identifikace zařízení a osoby | Běžný |
| **HW telemetrie** (CPU, RAM, baterie, disky, BIOS, antivirus) | IT preventivní údržba (čl. 6/1/f GDPR — oprávněný zájem zaměstnavatele na funkčnosti majetku) | Technický |
| **Hodinová mzda** *(volitelně, doplní HR)* | Výpočet ceny neproduktivního času | Citlivý HR údaj — chráněn rolí ADMIN |
| **Tiskové úlohy** *(opt-in `TRACKPRINT=1`)*: čas, tiskárna, počet stran, A4/A3, barva, duplex | Doložení využití tiskárny, kontrola nákladů | Běžný |
| **Název tištěného dokumentu** *(opt-in `CAPTUREPRINTDOCNAME=1`)* | Doložení, jaký soubor byl tištěn | **Citlivý** — může obsahovat zdravotní zprávu, mzdový list, soukromý dopis. Opt-in. |
| **USB události** *(opt-in `TRACKUSB=1`)*: čas, akce (CREATE/WRITE/DELETE), disk, velikost, přípona | DLP – kontrola kopírování firemních dat ven | Běžný |
| **Název USB souboru** *(opt-in `CAPTUREUSBFILENAME=1`)* | Konkrétní soubor, který si zaměstnanec kopíruje | **Citlivý** — opt-in, stejná logika jako u titulku okna |

### Co FOCUS **NIKDY** nesbírá ❌

- ❌ Obsah úhozů na klávesnici (žádný keylogger)
- ❌ Snímky obrazovky (screenshots)
- ❌ Obsah souborů na disku či schránky
- ❌ Mikrofon, kamera, GPS
- ❌ Obsah e-mailu, chatu, SMS
- ❌ Plné URL navštívené v prohlížeči (jen titulek okna, pokud je opt-in)
- ❌ Soukromá komunikace přes Skype/Teams/WhatsApp

> **Důsledek:** Většina právních rizik z manuálů monitorovacích nástrojů
> (keylogger, sledování e-mailů, čtení souborů) se na FOCUS **strukturálně
> nevztahuje** — nesbíráme to, takže nemůžeme porušit.

---

## 2. Aktuální právní rámec (ČR + EU, stav k 2026)

### 2.1 Listina základních práv a svobod

| Článek | Co říká | Co to znamená pro FOCUS |
|---|---|---|
| **Čl. 10 (2)** | Právo na ochranu před zasahováním do soukromí | Monitoring musí být přiměřený — FOCUS sbírá agregáty, ne obsah |
| **Čl. 10 (3)** | Právo na ochranu před neoprávněným shromažďováním údajů | Vyžaduje právní základ — u FOCUS je to **oprávněný zájem zaměstnavatele** (čl. 6/1/f GDPR) |
| **Čl. 13** | Listovní tajemství a tajemství zpráv | **Plně chráněno** — FOCUS nečte zprávy, e-maily ani soubory |

### 2.2 Zákoník práce (zákon č. 262/2006 Sb., ve znění pozdějších předpisů)

**§ 316 zákoníku práce** — klíčové ustanovení pro monitoring na pracovišti.

#### § 316 odst. 1 — užívání firemních prostředků jen pro práci

> *„Zaměstnanci nesmějí bez souhlasu zaměstnavatele užívat pro svou osobní
> potřebu výrobní a pracovní prostředky zaměstnavatele včetně výpočetní
> techniky ani jeho telekomunikační zařízení. Dodržování zákazu podle věty
> první je zaměstnavatel oprávněn přiměřeným způsobem kontrolovat."*

**Co to znamená:**
- Zaměstnavatel **smí** kontrolovat, jak zaměstnanec využívá firemní PC.
- Kontrola musí být **přiměřená** — FOCUS sbírá agregované metriky, ne obsah.
- Není potřeba souhlas zaměstnance pro kontrolu samotnou (oprávněný zájem),
  ale je potřeba **transparentně informovat** (viz § 316/3).

#### § 316 odst. 2 — zákaz narušování soukromí bez závažného důvodu

> *„Zaměstnavatel nesmí bez závažného důvodu spočívajícího ve zvláštní povaze
> činnosti zaměstnavatele narušovat soukromí zaměstnance na pracovištích…
> tím, že podrobuje zaměstnance otevřenému nebo skrytému sledování,
> odposlechu a záznamu jeho telefonických hovorů, kontrole elektronické
> pošty nebo kontrole listovních zásilek adresovaných zaměstnanci."*

**Co to znamená:**
- **NEMŮŽEME** odposlouchávat telefonáty, číst e-maily ani otevírat zásilky
  bez závažného důvodu.
- **FOCUS nic z toho nedělá** ✅ — sbíráme jen meta-informace (doba aktivity,
  název aplikace, počty úhozů), ne obsah.

#### § 316 odst. 3 — povinnost informovat předem (TRANSPARENTNOST)

> *„Jestliže je u zaměstnavatele dán závažný důvod… je zaměstnavatel
> povinen přímo informovat zaměstnance o rozsahu kontroly a o způsobech
> jejího provádění."*

**Co to znamená — POVINNÝ KROK PŘED INSTALACÍ FOCUS:**
1. **Písemně poučit zaměstnance** o rozsahu a způsobu monitoringu.
2. Šablona: [`docs/pravni/01-informace-zamestnancum.md`](01-informace-zamestnancum.md)
3. Informaci doručit **dříve, než se FOCUS na PC poprvé spustí**.
4. Doporučeno: nechat zaměstnance podepsat převzetí informace (důkaz pro
   případnou kontrolu ÚOOÚ).

> ⚠️ **Bez splnění § 316 odst. 3 je nasazení monitoringu nezákonné.**
> Hrozí pokuta ÚOOÚ (až 4 % obratu / 20 mil. EUR podle GDPR čl. 83) +
> občanskoprávní odpovědnost vůči zaměstnanci.

### 2.3 GDPR (Nařízení EU 2016/679) + zákon č. 110/2019 Sb.

**Nahradilo zrušený zákon 101/2000 Sb.** Účinnost od 25. 5. 2018.

| Článek GDPR | Co říká | Jak to FOCUS plní |
|---|---|---|
| **Čl. 6/1/f** Oprávněný zájem | Zpracování je zákonné, pokud je nezbytné pro oprávněné zájmy správce | FOCUS = oprávněný zájem zaměstnavatele na efektivním využití pracovní doby a ochraně majetku |
| **Čl. 13** Informační povinnost | Subjekt údajů musí být předem informován | Šablona poučení + Privacy Policy (`05-privacy-policy.md`) |
| **Čl. 15** Právo na přístup | Subjekt smí vědět, co se o něm zpracovává | Self-service portál (`/?selfToken=…`) + admin endpoint `GET /api/v1/admin/users/:id/export` |
| **Čl. 16** Právo na opravu | Subjekt smí požádat o opravu nepřesností | HR upraví profil v admin SPA |
| **Čl. 17** Právo na výmaz | „Právo být zapomenut" | `DELETE /api/v1/admin/users/:id?confirm=DELETE` — viz `userPrivacy.ts` |
| **Čl. 20** Přenositelnost | Subjekt smí dostat svá data ve strojově čitelném formátu | Self-export `GET /api/v1/self/export` vrací kompletní JSON dump |
| **Čl. 21** Námitka | Subjekt smí podat námitku proti zpracování na základě oprávněného zájmu | Manuálně přes DPO, na úrovni FOCUS lze deaktivovat sledování konkrétního zařízení |
| **Čl. 30** Záznam o činnostech zpracování | Nahrazuje **starou registraci u ÚOOÚ** podle § 16 ZOOÚ — registrace **už není povinná**, ale interní záznam ano | Šablona `06-rrpp-vzor.md` |
| **Čl. 32** Bezpečnost zpracování | Pseudonymizace, šifrování, řízení přístupů, audit | HTTPS / TLS 1.2+, HttpOnly cookie, per-device tokeny, role ADMIN/VIEWER, AccessAudit s immutable adminId |
| **Čl. 33** Hlášení breach ÚOOÚ | Do 72 h od zjištění | Plán reakce: `07-incident-response.md` |
| **Čl. 34** Informování dotčených subjektů | Při vysokém riziku | Plán reakce: `07-incident-response.md` |
| **Čl. 35** DPIA | Pokud zpracování může představovat vysoké riziko | Šablona `02-dpia-podklad.md` — pro monitoring zaměstnanců se **doporučuje** |

> 🚫 **NEPOUŽÍVEJTE „souhlas zaměstnance" jako právní titul.**
> Stanovisko ÚOOÚ + EDPB Guidelines 05/2020: souhlas zaměstnance je
> v zaměstnaneckém vztahu zpravidla **neplatný** kvůli nerovnováze sil.
> Správný titul je **oprávněný zájem zaměstnavatele dle čl. 6/1/f GDPR**
> doložený **balančním testem** (`03-balancni-test.md`).

### 2.4 Občanský zákoník (zákon č. 89/2012 Sb., NOZ)

**Nahradil zrušený OZ 40/1964 Sb.** Účinnost od 1. 1. 2014.

| Ustanovení | Co říká |
|---|---|
| **§ 81 NOZ** | Chráněna je osobnost člověka včetně jeho přirozených práv — života, zdraví, důstojnosti, vážnosti, cti, soukromí a projevů osobní povahy |
| **§ 82 NOZ** | Člověk, jehož osobnost byla dotčena, má právo domáhat se upuštění od zásahu a odstranění následků |
| **§ 84–90 NOZ** | Podoba a soukromí — zachycení podoby člověka, jeho hlasu nebo soukromí jen s jeho svolením (s výjimkami) |

**Pro FOCUS:**
- Nesbíráme podobu, hlas ani soukromé projevy → § 84-90 se nás netýká.
- Metadata o aktivitě jsou v rozsahu, který § 316 ZP a § 81 NOZ umožňuje
  při dodržení transparentnosti.

### 2.5 Zákon o elektronických komunikacích (zákon č. 127/2005 Sb.)

**§ 89** zakazuje odposlech, ukládání a sledování zpráv bez souhlasu uživatelů.

**Pro FOCUS:** Plně dodrženo — neukládáme obsah zpráv ani odposlech.

### 2.6 Trestní zákoník (zákon č. 40/2009 Sb.)

| § | Co říká | Riziko pro FOCUS |
|---|---|---|
| **§ 180** Neoprávněné nakládání s osobními údaji | Odnětí svobody až 3 roky / zákaz činnosti při způsobení vážné újmy | Hrozí, pokud admin využije FOCUS k osobní šikaně. Mitigace: AccessAudit log + role-based access |
| **§ 182** Porušení tajemství dopravovaných zpráv | Odnětí svobody až 6 měsíců | Nehrozí — FOCUS nečte zprávy |
| **§ 184** Pomluva | Odnětí svobody až 1 rok | Hrozí, pokud admin zveřejní data o zaměstnanci. Mitigace: AccessAudit |

---

## 3. Co je dovoleno a co je zakázáno

### ✅ Dovoleno (a FOCUS to dělá)

| Forma kontroly | Právní podklad |
|---|---|
| Měření doby aktivní a nečinné práce na firemním PC | § 316/1 ZP + čl. 6/1/f GDPR |
| Sledování názvu aktivní aplikace (např. `chrome.exe`) | § 316/1 ZP |
| Počítání úhozů a kliků jako ukazatel tempa práce | § 316/1 ZP |
| HW telemetrie pro IT (preventivní údržba majetku) | § 316/1 ZP |
| Mapování pracoviště podle lokální IP / Site | § 316/1 ZP |
| Sběr titulku okna **při opt-in instalaci** | § 316/1 ZP + balanční test |
| Sledování tisku na firemní tiskárně (počty stran) | § 316/1 ZP — firemní tiskárna je pracovní prostředek |
| Sledování přesunů na USB **při opt-in** | § 316/1 ZP + DLP nárok zaměstnavatele na ochranu obchodního tajemství |

### ⚠️ Dovoleno jen s omezeními

| Forma kontroly | Omezení |
|---|---|
| Sledování doby strávené na konkrétním webu | OK na agregované úrovni, ale neukládejme plnou URL — jen doménu (`youtube.com`), ne `youtube.com/watch?v=osobni-video` |
| Sběr titulku okna | Default vypnuto. Pokud zapnete, musí být **explicitně v poučení zaměstnance** a doporučeno **DPIA** |
| Sběr **názvů tištěných dokumentů** | Default vypnuto. Pokud zapnete, **musí** být v poučení zaměstnance, doporučeno DPIA. Pro většinu compliance scénářů stačí počty stran. |
| Sběr **názvů USB souborů** | Default vypnuto. Stejně jako u titulku okna: pokud zapnete, musí být v poučení + DPIA. Pro DLP detekci ve většině případů stačí velikosti a typy souborů. |

### ❌ Zakázáno (a FOCUS to NEDĚLÁ)

| Zakázaná praktika | Důvod |
|---|---|
| Číst obsah e-mailů zaměstnance | § 316/2 ZP — porušilo by listovní tajemství |
| Ukládat keylogger záznam úhozů | § 316/2 + GDPR + § 182 TZ |
| Pořizovat screenshoty | § 84 NOZ + § 316/2 ZP |
| Otevírat soukromou e-mailovou schránku zaměstnance | § 316/2 ZP + § 182 TZ |
| Odposlech telefonátů a chatů | § 316/2 ZP + ZEK § 89 |
| Sledovat soukromé zařízení (BYOD) bez výslovného souhlasu | Vně §316 ZP — zařízení není „pracovní prostředek zaměstnavatele" |

> ✅ **FOCUS strukturálně nemůže nic z těchto „zakázaných" praktik**, protože
> agent prostě tyto údaje **nesbírá**. Jediný způsob, jak by k nim
> bylo možné technicky dospět, je úprava zdrojového kódu — což je porušení
> licence FOCUS i právních předpisů a hrozí trestní odpovědnost autora změny.

---

## 4. Postup zaměstnavatele PŘED nasazením FOCUS

### Krok 1: Posouzení nutnosti (balanční test)

Vyhodnoťte, zda monitoring přiměřeně vyvažuje:
- **Oprávněný zájem zaměstnavatele** (efektivita, ochrana majetku, řízení rizik)
- **Zájem na soukromí zaměstnance**

➡ Šablona: [`03-balancni-test.md`](03-balancni-test.md)

### Krok 2: Posouzení vlivu na ochranu osobních údajů (DPIA)

Doporučeno pro monitoring zaměstnanců (čl. 35 GDPR). Není striktně povinné,
ale ÚOOÚ ho zpravidla u systematického monitoringu vyžaduje.

➡ Šablona: [`02-dpia-podklad.md`](02-dpia-podklad.md)

### Krok 3: Záznam o činnostech zpracování (RRPP, čl. 30 GDPR)

**Nahrazuje** starou registraci u ÚOOÚ podle § 16 zákona 101/2000 Sb.,
která byla zrušena s GDPR. Záznam vede správce **interně** a předkládá ho
ÚOOÚ jen na vyžádání.

➡ Šablona: [`06-rrpp-vzor.md`](06-rrpp-vzor.md)

### Krok 4: Pověřenec pro ochranu osobních údajů (DPO)

Povinný (čl. 37 GDPR), pokud:
- jste orgán veřejné moci, NEBO
- vaše hlavní činnost je **pravidelné a systematické monitorování subjektů
  ve velkém rozsahu**, NEBO
- zpracováváte ve velkém rozsahu **zvláštní kategorie údajů**.

**Pro běžnou firmu monitorující 50–500 zaměstnanců**: většinou není povinný,
ale doporučujeme určit kontaktní osobu pro ochranu osobních údajů.

### Krok 5: Písemné poučení zaměstnanců (§ 316/3 ZP + čl. 13 GDPR)

**Nejkritičtější krok.** Bez něj je monitoring nezákonný.

➡ Šablona: [`01-informace-zamestnancum.md`](01-informace-zamestnancum.md)

**Co musí poučení obsahovat:**
1. Identifikace správce (IČO, sídlo, kontakt)
2. Co se sbírá (přesně, ne jen „pracovní aktivita")
3. Účel zpracování
4. Právní základ (oprávněný zájem)
5. Doba uchování
6. Komu se data předávají (vedoucí, HR, případně SaaS poskytovatel)
7. Práva subjektu údajů (čl. 15–22 GDPR) + jak je uplatnit
8. Kontakt na DPO / odpovědnou osobu

**Forma:**
- Doporučeno písemně, s podpisem zaměstnance o převzetí.
- Alternativně intranet + e-mail s potvrzením doručení.
- **Před** prvním spuštěním FOCUS agenta na jeho PC.

### Krok 6: Privacy Policy + DPA (pokud SaaS)

- **Privacy Policy** pro zaměstnance i web — [`05-privacy-policy.md`](05-privacy-policy.md)
- **DPA (Data Processing Agreement)** pokud používáte FOCUS jako SaaS od
  externího poskytovatele — [`04-dpa-vzor.md`](04-dpa-vzor.md)

### Krok 7: Pracovní smlouva / pracovní řád

Začleňte (pro nově nastupující zaměstnance):

> *„Zaměstnanec bere na vědomí, že zaměstnavatel v souladu s § 316 zákoníku
> práce kontroluje přiměřené využívání svěřených pracovních prostředků
> (zejména služebního počítače) prostřednictvím nástroje FOCUS. Rozsah
> a způsob kontroly upravuje samostatný dokument „Informace o monitoringu
> využití firemních zařízení", který je nedílnou součástí této smlouvy /
> pracovního řádu / vnitřní směrnice č. ___."*

> ⚠️ **NEVKLÁDEJTE do smlouvy ustanovení typu „zaměstnanec souhlasí se
> zpracováním osobních údajů":** souhlas zaměstnance není platným titulem.
> Stačí informační doložka.

---

## 5. Postup zaměstnavatele PŘI provozu FOCUS

### 5.1 Co dělat při žádosti subjektu údajů (SAR)

**Lhůty (čl. 12 GDPR):**
- Odpověď do **1 měsíce** od žádosti.
- Lze prodloužit o 2 měsíce u složitějších žádostí (s vysvětlením).
- Bezplatně (kromě zjevně neoprávněných nebo opakujících se žádostí).

**Postup u nejčastějších žádostí:**

| Právo | Endpoint v FOCUS | Postup |
|---|---|---|
| Čl. 15 — přístup k vlastním datům | `GET /api/v1/self/report` nebo admin export | Pošlete zaměstnanci odkaz na self-service portál, nebo mu vygenerujte export ze Správa → Zaměstnanci → 📥 |
| Čl. 17 — výmaz | `DELETE /api/v1/admin/users/:id?confirm=DELETE` | Admin v UI: Správa → Zaměstnanci → ❌. Smaže intervaly, agregáty, absence; profil pseudonymizuje. Audit přístupů zůstává (forenzní záznam). |
| Čl. 20 — přenositelnost | `GET /api/v1/self/export` (employee) nebo admin export | JSON dump kompletních dat |
| Čl. 21 — námitka | Manuálně přes DPO | Pokud uznáno, admin deaktivuje zařízení (`active=false`); data zůstanou do uplynutí retence |

### 5.2 Retenční politika

Nastavujte v Nastavení → Soukromí a uchovávání dat. Defaultní hodnoty
podle DPIA a balančního testu:

| Údaj | Retence | Kde se mění |
|---|---|---|
| Surové intervaly (1minutové) | 35 dní | `RAW_RETENTION_DAYS` v `.env` nebo v UI |
| Hodinové agregáty | 540 dní (~18 měsíců) | `HOURLY_RETENTION_DAYS` |
| Audit přístupů adminů | 365 dní (~12 měsíců, doporučeno GDPR čl. 32) | `AUDIT_RETENTION_DAYS` |
| HW telemetrie (last snapshot) | 90 dní | aplikační logika |

Po uplynutí lhůty se data **automaticky** nevratně smažou denním cronem
v 03:30 (`scheduleRetentionPruning` v `monitoring/backend/src/jobs/retention.ts`).

### 5.3 Audit přístupů adminů (čl. 32 GDPR — transparentnost)

Každé otevření detailu zaměstnance, export jeho dat nebo výmaz se zapisuje
do tabulky `AccessAudit` se třemi klíči:
- `adminId` (immutable cuid — přežije přejmenování / smazání admin účtu)
- `adminIdentity` (snapshot username v okamžiku akce)
- `viewedUserId` + `action` + `detail` + `createdAt`

**Zaměstnanec si může (pokud admin zapne `selfAuditEnabled`) zobrazit, kdo
se na něj díval** — sekce „Kdo se na moje data díval" v self-service portálu.
Tím se plní povinnost transparentnosti dle čl. 32 GDPR.

### 5.4 Incident response (data breach)

Pokud dojde k úniku osobních údajů:
1. Postupujte podle [`07-incident-response.md`](07-incident-response.md).
2. Hlášení ÚOOÚ do **72 hodin** od zjištění (čl. 33 GDPR).
3. Při vysokém riziku informujte dotčené zaměstnance (čl. 34 GDPR).

---

## 6. Sankce při porušení

| Porušení | Sankce |
|---|---|
| Monitoring bez poučení (§ 316/3 ZP) | Pokuta inspektorátu práce do 1 mil. Kč + náhrada újmy zaměstnanci |
| Porušení GDPR (chybí RRPP, nesplněná práva subjektu, breach bez hlášení) | Pokuta ÚOOÚ až **20 mil. EUR / 4 % celosvětového obratu** (cokoli je vyšší) |
| Neoprávněné nakládání s osobními údaji (§ 180 TZ) | Odnětí svobody až 3 roky nebo zákaz činnosti |
| Porušení tajemství zpráv (§ 182 TZ) | Odnětí svobody až 6 měsíců (do 5 let při zveřejnění) |

---

## 7. Checklist pro správce před prvním spuštěním FOCUS

- [ ] **Balanční test** je vyplněn a podepsán (`03-balancni-test.md`)
- [ ] **DPIA** je vyplněna a uložena (`02-dpia-podklad.md`)
- [ ] **Záznam o činnostech zpracování (RRPP)** je v interní evidenci (`06-rrpp-vzor.md`)
- [ ] Je určen **DPO** (pokud povinný) nebo kontaktní osoba pro OÚ
- [ ] **Písemné poučení zaměstnanců** je rozesláno / podepsáno (`01-informace-zamestnancum.md`)
- [ ] **Privacy Policy** je publikována (intranet nebo web) (`05-privacy-policy.md`)
- [ ] **DPA s poskytovatelem** (pokud SaaS) je podepsaná (`04-dpa-vzor.md`)
- [ ] V pracovním řádu / směrnici je **informační doložka** o monitoringu
- [ ] Je nastavena **retenční politika** v FOCUS (Nastavení → Soukromí)
- [ ] Je nastaveno **odhalení titulku okna (CAPTURETITLE)** podle uvážení DPIA
- [ ] Je proveden **Bezpečnostní self-audit** v Nastavení → 0 problémů, max. 1–2 upozornění
- [ ] Je nastaven **alespoň 1 admin účet** s vlastním silným heslem (ne defaultní)
- [ ] Je dohodnut postup **incident response** (`07-incident-response.md`)
- [ ] Je naplánována **kontrola dokumentace 1× ročně** (advokát / DPO)

---

## 8. Co dělat, pokud se zaměstnanec stěžuje

### Pokud podá interní stížnost:

1. Předejte ji **DPO / pověřence pro ochranu osobních údajů**.
2. Zkontrolujte v `AccessAudit` log, **kdo a kdy se** na jeho data díval.
3. Vyhodnoťte, zda byly přístupy oprávněné (pracovní důvod).
4. Pokud ne — disciplinární řízení s konkrétním adminem + dodatečná opatření
   (např. zrušení role).
5. Informujte zaměstnance o výsledku do 30 dní.

### Pokud podá stížnost u ÚOOÚ:

ÚOOÚ má pravomoc:
- Vyžádat si dokumentaci (RRPP, balanční test, DPIA, poučení).
- Provést kontrolu na místě.
- Uložit pokutu (čl. 83 GDPR — viz tabulka výše).

**Příprava** = mít všechny dokumenty z kapitoly „Checklist" připravené.

---

## 9. Roční revize manuálu

Tento manuál revidujte **alespoň 1× ročně** a vždy při:
- Změně legislativy (sledovat: ZP, GDPR, zákon 110/2019 Sb., NOZ).
- Změně způsobu monitoringu (např. zapnutí `CAPTURETITLE`).
- Změně poskytovatele FOCUS (z on-prem na SaaS nebo naopak).
- Po data breach incidentu — vyhodnocení post-mortem.

Datum poslední revize: **[DOPLŇTE]**
Odpovědná osoba: **[DOPLŇTE: jméno DPO / advokáta]**

---

## 10. Kontakty a odkazy

### Externí

- **ÚOOÚ (Úřad pro ochranu osobních údajů)**
  https://www.uoou.cz · posta@uoou.cz · +420 234 665 111
- **NÚKIB (Národní úřad pro kybernetickou bezpečnost)**
  https://www.nukib.cz · cert@nukib.cz · +420 541 110 762
- **Inspektorát práce**
  https://www.suip.cz

### Interní (váš správce)

- DPO / pověřenec: **[DOPLŇTE]**
- IT správce FOCUS: **[DOPLŇTE]**
- HR / odpovědný vedoucí: **[DOPLŇTE]**
- Právní zastoupení: **[DOPLŇTE]**

---

*Tento manuál nahrazuje neaktuální materiály, které vycházely ze zákona
č. 101/2000 Sb., občanského zákoníku č. 40/1964 Sb. a směrnice 95/46/EC —
všechny tyto předpisy byly v letech 2014 a 2018 zrušeny a nahrazeny.
Manuál je platný k legislativě roku 2026.*
