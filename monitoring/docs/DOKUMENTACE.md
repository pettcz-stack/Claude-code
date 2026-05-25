# Monitoring efektivity práce na firemním PC — funkční a bezpečnostní dokumentace

> Dokument pro **právní posouzení** (právník/DPO) a pro IT. Popisuje, jak systém
> funguje, jaká data zpracovává, kam je odesílá, kde běží a jak je zabezpečen.
> Navazuje na návrh (`NAVRH.md`) a právní šablony (`pravni/`).

## 1. Účel

Sledování **efektivity využití firemních Windows počítačů** v souladu s § 316
odst. 1 zákoníku práce. Systém vyhodnocuje, kolik pracovní doby probíhá aktivní
práce, kolik nečinnost, v jakých aplikacích/kategoriích, a upozorňuje na pokusy
o obcházení monitoringu. **Nezpracovává obsah** činnosti.

## 2. Komponenty

| Komponenta | Kde běží | Role |
|---|---|---|
| **Agent** (`MA win 32.exe`, C#/.NET 4.8) | na firemním PC, v session uživatele | sbírá agregované metriky, odesílá je |
| **Backend / server** (Node.js + API) | **firemní server / privátní cloud** | příjem dat, agregace, řízení přístupu, API |
| **Databáze** (PostgreSQL) | tentýž server | uložení dat (časově omezené) |
| **Dashboard** (web) | servíruje backend | přihlášené prohlížení a export |

## 3. Co agent sbírá a co NE

**Sbírá (jen agregované metriky za interval, výchozí po minutě, odesílá se dávkově po 15 min, gzip):**
- aktivní vs. nečinný čas (nečinnost = 5 min bez vstupu/přepnutí okna),
- název aktivní **aplikace** (proces, např. `winword.exe`),
- **titulek aktivního okna** (volitelné; pro rozlišení práce/zábava, např. „Jira" vs „YouTube"),
- **počet** úhozů na klávesnici a **počet** pohybů/kliků myši (NE které klávesy),
- příznak uzamčení obrazovky.

**Nesbírá:** obsah psaného textu (žádný keylogger), screenshoty, obsah e-mailů/
zpráv/souborů, zvuk z mikrofonu, obraz z kamery, polohu mimo pracoviště.

## 4. Tok dat (kam a jak se odesílá)

```
[Agent na PC] ──HTTPS (TLS 1.2+), Bearer token──► [Firemní backend/API] ──► [DB]
                                                          │
                                          [Dashboard] ◄── čte z DB (po přihlášení)
```

1. Agent lokálně agreguje metriky (výchozí po minutě) a dávkově je každých ~15 minut
   odešle **šifrovaně přes HTTPS** na firemní backend. Tělo je **gzip** komprimované
   (~10× menší přenos). Při výpadku sítě nebo mimo firemní síť data drží v odolném
   lokálním bufferu (`%ProgramData%\Device Monitor\spool.ndjson`) a odešle je, až se připojí.
2. Backend data ověří (token zařízení), uloží do databáze a průběžně agreguje
   (hodinové souhrny, skóre, detekce praktik).
3. **Dashboard** je webové rozhraní servírované týmž backendem. Oprávněná osoba
   se přihlásí (jméno + heslo) a vidí jen agregovaná data; každý přístup k datům
   konkrétního zaměstnance se zaznamenává do auditu.

## 5. Hosting — kde to musí běžet (odpověď na častou otázku)

**Ano, je potřeba server**, kam agenti odesílají data a odkud čte dashboard.
Dashboard není samostatná služba „někde u dodavatele" — běží na vašem serveru.
Dvě varianty:

- **On-premise (doporučeno pro GDPR):** server uvnitř firemní sítě (nebo váš
  VPS/cloud v EU). Data **neopouští firmu**, plná kontrola. Vhodné, pokud jsou
  zaměstnanci ve firemní síti nebo na VPN.
- **Privátní cloud (EU):** váš server u poskytovatele v EU. Dostupné i pro home
  office mimo firemní síť. Data jsou u vás (váš účet, vaše šifrování), ne u třetí
  strany.

V obou případech jste **správcem údajů vy** (zaměstnavatel). Není zde žádný
sdílený/„veřejný" server provozovatele nástroje.

## 6. Zabezpečení a GDPR

### 6.1 Pojmy: „hashování" vs. šifrování (důležité upřesnění)
- **Hash** je *jednosměrný* — z hashe nelze získat původní hodnotu. Používá se
  tam, kde se hodnota nemusí číst, jen ověřovat → **hesla** (scrypt) a **tokeny**
  zařízení. To máme.
- **Naměřená data** (aktivita, kategorie) ale **musíte umět zobrazit**, proto je
  nelze „zahashovat". Chrání se **šifrováním** (obousměrné) + **řízením přístupu**.
  Tj. „nezjistitelná pro neoprávněné" = šifrování v přenosu + v klidu + autentizace
  + role + audit, **ne** hashování samotných dat.

### 6.2 Konkrétní opatření
| Vrstva | Opatření | Stav |
|---|---|---|
| Přenos (agent→server, prohlížeč→server) | **HTTPS / TLS 1.2+** (odposlech nemožný) | agent připraven (TLS 1.2); TLS certifikát nasadí IT |
| Autentizace agenta | Bearer token; v plánu **per-device token (hash v DB)** | sdílený token hotov; per-device token = roadmap |
| Přihlášení do dashboardu | jméno + heslo, **hesla hashována (scrypt)** | hotovo |
| Řízení přístupu | role **ADMIN / VIEWER**, jen pověřené osoby | hotovo |
| Auditovatelnost | **log každého náhledu/exportu** dat zaměstnance (kdo, kdy, čí) | hotovo |
| Data v klidu | **šifrování úložiště** (šifrovaný disk/volume, příp. PostgreSQL TDE) | zajišťuje nasazení (IT) |
| Minimalizace | jen agregáty, žádný obsah | hotovo |
| Retence | automatické mazání (detaily ~35 dní, souhrny ~12–24 měs.) | hotovo (konfigurovatelné) |
| Pseudonymizace | uživatel veden přes SID/ID; jména spravuje jen oprávněný | hotovo |

### 6.3 Co musí zajistit nasazení (IT) — aby byla ochrana úplná
1. Provoz backendu **jen přes HTTPS** (platný certifikát), bez HTTP.
2. **Šifrovaný disk/úložiště** serveru (BitLocker/LUKS) nebo TDE databáze.
3. Síťové omezení: API i dashboard dostupné jen z firemní sítě/VPN, firewall.
4. Silné heslo admina, omezení rolí, pravidelná revize auditu.
5. Distribuce **písemného poučení zaměstnanců** (transparentnost dle §316).

## 7. Odolnost proti vypnutí zaměstnancem

- Agent běží **tiše na pozadí** (bez okna a ikony), pod správou firemního PC.
- O jeho běh se stará **hlídací Windows služba `MAWin32`** (LocalSystem, auto-start):
  spouští agenta do session přihlášeného uživatele a po případném ukončení (i ručním
  ve Správci úloh) ho **do ~20 s znovu nahodí**. Má nastaven i **automatický restart
  při selhání**. Službu **nelze bez administrátorských práv zastavit ani zakázat**,
  takže běžný zaměstnanec monitoring fakticky neobejde. Služba sama nic nesbírá.
- **Právní podmínka:** tato tamper-resistance je na firemním zařízení přípustná
  pouze při **předchozím prokazatelném informování zaměstnanců** (poučení v `pravni/`).

## 8. Právní rámec

Zpracování stojí na **oprávněném zájmu** zaměstnavatele (čl. 6/1/f GDPR) a § 316
zákoníku práce. Podmínkou je **předchozí prokazatelné informování** zaměstnanců
a **přiměřenost** (jen agregovaná data, žádný obsah). Viz šablony:
- `pravni/01-informace-zamestnancum.md` (poučení),
- `pravni/02-dpia-podklad.md` (posouzení vlivu),
- `pravni/03-balancni-test.md` (test oprávněného zájmu).

> **Upozornění:** tento dokument není právní poradenství; před nasazením jej a
> uvedené šablony posuďte s právníkem a DPO.
