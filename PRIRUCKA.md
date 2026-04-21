# Příručka pro operátory

**Komu je určená:** členové marketingového týmu, kteří budou denně moderovat
komentáře na Facebook/Instagram profilech ALBIXON a BRILIX. Žádné technické
znalosti nutné.

**Délka čtení:** 15 minut. Pak budeš umět aplikaci ovládat líp než většina.

---

## 1. První přihlášení

1. Otevři odkaz, který ti poslal admin (např. `https://viktor.albixon.cz`).
2. Prohlížeč se tě zeptá na **jméno a heslo** (to co ti dal admin).
3. Přihlaš se. Uvidíš hlavní obrazovku — **Frontu komentářů**.

V pravém horním rohu vidíš svoje přihlašovací jméno a **roli**:

| Badge | Role | Co smíš |
|---|---|---|
| 🔴 admin | nejvyšší | Všechno včetně mazání, nastavení, účtů |
| 🟡 moderator | střední | Skrýt / Ponechat / Odpovědět, ale ne Smazat |
| ⚪ viewer | read-only | Jen prohlížet, nic neprovést |

Pokud si myslíš, že máš špatnou roli, ozvi se adminovi.

---

## 2. Co znamenají AI kategorie

Aplikace **každý nový komentář pošle přes Claude AI**, která ho zařadí do jedné
z 6 kategorií. Tvoje práce je rozhodnout, co s tím. AI je **návrh, ne rozhodnutí** —
ty máš vždy poslední slovo.

### 🟢 Positive (pozitivní)

> „Super bazén! Máme ho 3 roky a jsme naprosto spokojení. Doporučuji."

**Co dělat:** **Ponechat**. Případně lajkni na FB/IG přímo z mobilu. AI
confidence u těchhle bývá > 95 %.

### ⚪ Neutral (neutrální)

> „Kolik stojí zastřešení pro 8×4 m bazén?"

**Co dělat:** **Ponechat**. Pokud je to dotaz, odpověz (zapnuté „Odpovědět" +
šablona „Dotaz na cenu"), nebo zvedni telefon obchoďákovi.

### 🔵 Legitimate criticism (oprávněná kritika)

> „Objednala jsem si od vás zastřešení v březnu, stále nic nepřišlo, podpora
> neodpovídá. Zklamání."

**Co dělat:** **NIKDY neskrývat a nemazat!** Tohle je hodnotná zpětná vazba.
Postup:

1. Klikni na **"Odpovědět"** (pokud je zapnuté)
2. Vyber šablonu **„Oprávněná kritika – obecná odpověď"** z dropdownu
3. Doplň detaily, odešli
4. **Předej kolegům z kustomer supportu**, aby to dořešili offline

### 🟡 Spam

> „Vyhraj iPhone 15 zdarma! http://free-win.example"

**Co dělat:** **Smazat** (admin) nebo **Skrýt** (moderator). Aplikace má
auto-delete pravidlo pro spam s confidence ≥ 90 %, takže spam se obvykle smaže
dřív, než ho vůbec uvidíš.

### 🟠 Vulgarity (vulgarismy)

> „Ty vole, za tyhle ceny ať jdou do háje…"

**Co dělat:** **Skrýt**. Aplikace to většinou skryje automaticky (threshold
85 %).

### 🔴 Brand attack (útok na značku) — POZOR!

> „ALBIXON je podvodnická firma, zakázky neplní a kradou zálohy! Raději
> Mountfield nebo Desjoyaux."

**Co dělat:**
1. **NESKRÝVEJ to automaticky!** Právní riziko v tom, že se tváříš, že se
   skrýváš před kritikou.
2. **Klikni na ikonu ℹ u komentáře** — zobrazí se detail s plnou historií AI
   reasoningu
3. **Přepošli to právnímu oddělení** (screenshot + stáhni si Evidence JSON
   z Audit → Evidence snapshots)
4. **Teprve podle doporučení právníků** rozhodni o smazání

U každého `brand_attack` dostane admin + ty sám/a automatickou **Slack / email
notifikaci** s přímým odkazem na příspěvek.

---

## 3. Jak pracovat s frontou

![Queue screenshot](screenshots/01-queue.png)

Fronta je **seřazená podle priority**:

1. Nahoře brand_attack (červené)
2. Pak vulgarismy (oranžové)
3. Spam (žluté)
4. Kritika (modré)
5. Dotazy / neutrální (šedé)
6. Pozitivní (zelené)

### Základní akce

U každého řádku máš podle role tlačítka:

- 🟠 **Skrýt** — komentář zmizí z veřejné nástěnky, ale zůstane v našem logu
- 🔴 **Smazat** — komentář je pryč (jen admin)
- ⚪ **Ponechat** — označí komentář jako „zkontrolováno, nechat tam"
- 🔵 **Odpovědět** — otevře okno pro napsání odpovědi (když je zapnuté)
- ↻ **Překlasifikovat** — řekne AI „zkus to znovu se silnějším modelem" (užitečné, když AI trefila špatně)
- ℹ **Detail** — pravý panel s plnou historií

### Hromadné akce

1. Zaklikni checkboxy vlevo u komentářů, které chceš zpracovat najednou
2. Nahoře se objeví pruh „Označeno: N"
3. Klikni **Skrýt vše / Smazat vše / Ponechat vše**

Typické použití: víkendový spam útok, 20 komentářů od stejného bota →
označit všechny → Smazat vše.

### Filtrování

Nahoře jsou filtry:
- **Stav** — zda ještě čeká, nebo už je zpracovaný
- **Platforma** — jen FB nebo jen IG
- **Kategorie** — filtrovat podle AI
- **Hledat** — fulltext přes text komentáře a jméno autora

---

## 4. Klávesové zkratky

Stiskni **`?`** kdekoli ve frontě — zobrazí se nápověda. Nejdůležitější:

| Zkratka | Co udělá |
|---|---|
| `j` / `k` | Další / předchozí komentář |
| `Enter` | Otevře detail aktuálního |
| `h` | **Skrýt** |
| `x` | **Smazat** (jen admin, s potvrzením) |
| `p` | **Ponechat** |
| `r` | **Odpovědět** (když je zapnuté) |
| `o` | Otevřít příspěvek na FB/IG v novém tabu |
| Mezerník | Označit / odznačit pro bulk |
| `?` | Nápověda |
| `Esc` | Zavřít okno |

Po pár dnech je rychlejší makat na klávesnici než myší.

---

## 5. Odpovídání (reply)

**Důležité pravidlo:** Aplikace **standardně NESMÍ** odpovídat na komentáře.
Admin musí explicitně zapnout tlačítkem v Admin stránce. Dokud je vypnuté:

- Tlačítko „Odpovědět" se nezobrazuje
- Klávesa `r` nefunguje
- API volání vrací chybu

Když je zapnuté, postup:

1. Klikni „Odpovědět" u řádku
2. Vyber šablonu z dropdownu (filtruje se podle AI kategorie)
3. Přepiš si text podle potřeby (dolaďuj podle situace)
4. **Nebo:** klikni **„Navrhnout odpověď (AI)"** — Claude vygeneruje návrh
   v tónu ALBIXON, podepsaný „Tým ALBIXON"
5. Odešli **„Odeslat odpověď"**

Odpověď se publikuje na FB/IG **okamžitě**, pod tvým uživatelským jménem
v aplikaci (nikoli pod tvým osobním FB účtem — všechno jde pod stránkou
ALBIXON / BRILIX).

### Best practices pro odpovědi

- **Nikdy nevymýšlej konkrétní čísla** (ceny, termíny, záruky). Odkaž na
  obchodní oddělení: „Pro konkrétní nabídku napište na info@albixon.cz"
- **Neomlouvej se za věci, které nejsou naše vina**. Omluva je implicitní
  přiznání odpovědnosti.
- **U kritiky přesuň do privátu**: „Mrzí nás to. Napište nám prosím do DM
  nebo na info@albixon.cz, pomůžeme to dořešit."
- **U pochvaly krátce poděkuj** — ne dlouhé marketingové řeči.
- Pamatuj: odpověď je veřejná a zůstane tam.

---

## 6. Kritické notifikace (Slack / email)

Admin nastavil **kritická klíčová slova** (např. „podvod, žaloba, policie,
soud"). Jakmile se takové slovo objeví v komentáři, **okamžitě přijde
notifikace** do Slacku nebo mailu — i když AI daný komentář zařadila
úplně jinam.

**Na kritické notifikace reaguj neprodleně:**

1. Klikni na odkaz v notifikaci
2. Přečti si celý komentář v detailu (Enter na řádku)
3. Screenshotuj celou stránku na FB/IG
4. Stáhni si **Evidence JSON** z Audit → Evidence snapshots (právní důkaz
   se SHA-256 hashem)
5. Přepošli celý balík právnímu oddělení
6. **Počkej na jejich rozhodnutí** před smazáním/odpovědí

---

## 7. Sledování nákladů (Tokeny)

Stránka **Tokeny** (v navigaci) ukazuje, kolik USD nás Claude API stojí:

- **Dnes / Tento měsíc / Celkem** — 3 karty nahoře
- **Progress bar** kolik z měsíčního limitu už je vyčerpáno (zelený → oranžový → červený)
- **Denní graf** spotřeby
- **Rozpis podle funkce** — kolik stojí klasifikace vs. návrhy odpovědí
- **Hranice v USD** — když ji překročíš, přijde notifikace (jednorázová za měsíc)

Typické hodnoty: za 2000 komentářů/měsíc to udělá ~$1.50–$3. Pokud vidíš, že
jdeš přes plán, ozvi se adminovi — může upravit prahy auto-moderace nebo
zvýšit alert threshold.

---

## 8. Audit log

Všechno, co se v aplikaci stane, se loguje do **Audit** stránky:
- Kdo se přihlásil, kdy, odkud (IP)
- Kdo co smazal/skryl/odpověděl
- Kdy a proč se auto-moderace spustila
- Kdy se tokeny vyčerpaly
- Kdy admin zapnul/vypnul odpovědi

**Evidence snapshots** (druhá záložka) jsou JSON snímky každého `brand_attack`
a `vulgarity` komentáře v momentě detekce — obsahují SHA-256 hash pro
**právní neměnitelnost**. Pokud vznikne spor, máme doklad o tom, co komentář
obsahoval v okamžiku, kdy ho AI zachytila, i kdyby ho potom autor smazal.

CSV export přes **„Export CSV"** otevřeš v Excelu (správně zobrazí českou
diakritiku).

---

## 9. Odhlášení

Vpravo nahoře klikni na **„odhlásit"** → potvrdíš → prohlížeč zapomene tvoje
heslo a stránka se obnoví s přihlašovacím dialogem.

**DŮLEŽITÉ na sdíleném počítači:** vždycky zavři prohlížeč na konci směny.
Basic auth je v cache, dokud prohlížeč neukončíš.

---

## 10. Kdy kontaktovat admina

- 🟠 **Token alert** přišel a mám podezření, že něco jede naprázdno (spam
  útok, smyčka v klasifikaci)
- 🟠 **Token token expiruje** — Meta Page Access Token se musí každých 60 dnů
  obnovit, admin to musí projít OAuth flow znova
- 🟠 **Chybí mi role** (nevidím tlačítko „Smazat", ale potřebuju ho)
- 🟠 **Klasifikace trefuje špatně** — admin může upravit AI prompt
- 🔴 **Útok na značku** — admin + právní oddělení
- 🔴 **Nefunguje OAuth** (nová stránka se nedá propojit)
- 🔴 **Všechno se zhroutilo** — admin musí zkontrolovat `/health/ready`

---

## 11. Rychlý checklist pro typický den

Ráno:
1. Přihlaš se
2. Podívej se na **Frontu** — kolik přibylo přes noc?
3. Začni od **brand_attack** nahoře (červené)
4. Projdi **vulgarity** a **spam** — většina už bude auto-moderovaná, jen
   zkontroluj false positives
5. U **oprávněné kritiky** zvaž odpověď nebo předání supportu
6. Po obědě zkus klávesové zkratky 😉

Na konci směny:
1. Projdi **Audit → Akce za dnešek** — máš přehled, co jsi udělal/a
2. Zavři prohlížeč

---

## 12. Co nikdy nedělat

- ❌ **Nepouštěj svoje heslo nikomu.** Ani kolegovi. Každý má vlastní.
- ❌ **Neskrývej oprávněnou kritiku** („legitimate_criticism"). Je to
  právní a reputační riziko.
- ❌ **Nezapínej „Odpovědi" bez dohody s adminem.** Aplikace pak může psát
  pod tvým uživatelským jménem na stránky firmy.
- ❌ **Nepanikař při kritickém alertu** — screenshotuj, stáhni evidence,
  předej právním. Neberou se rozhodnutí za horka.
- ❌ **Nemaž `brand_attack` bez konzultace.** I když je AI jistá na 99 %,
  smazání je právně citlivé.

---

## Máš otázku, která tu není?

Napiš adminovi. Pokud je to něco, co by mělo být v příručce, doplníme.
