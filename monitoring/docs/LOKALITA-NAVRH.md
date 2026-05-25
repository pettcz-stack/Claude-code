# Návrh: rozpoznání pracoviště (lokality) zařízení

Cíl: u zaměstnance / zařízení vidět, **odkud se pracuje** — *pobočka Brno,
pobočka Praha, areál Hořovice, nebo „Mimo firmu"* — bez sledování přesné polohy
osoby a tak, aby **VPN nevypadala jako pobočka**, když je člověk na Home Office.

> Stav: **návrh k odsouhlasení**, neimplementováno.

---

## 1. Shrnutí doporučení

- **NE GPS.** Stolní PC ho nemají, u notebooků je nespolehlivý a přesná
  geolokace zaměstnance je dle §316 ZP a GDPR **citlivý a nepřiměřený údaj**.
- **ANO detekce podle sítě**, konkrétně podle **lokální (LAN) podsítě fyzického
  síťového adaptéru** — ne podle veřejné IP.
- Zobrazujeme jen **hrubou informaci**: konkrétní firemní provozovna, nebo
  „Mimo firmu". Žádná adresa, žádné souřadnice.

---

## 2. Proč lokální síť a ne veřejná IP (klíč k VPN)

| Metoda | V kanceláři | Doma + firemní VPN | Verdikt |
|---|---|---|---|
| Veřejná (egress) IP | IP pobočky | **IP centrály → falešně „pobočka"** | ✗ zmate VPN |
| **Lokální podsíť fyz. adaptéru** | `10.10.x.x` (Brno) | `192.168.x.x` (domácí router) | ✓ správně „Mimo firmu" |

VPN přidává jen *virtuální* adaptér s tunelem; **fyzický** adaptér má pořád
domácí síť. Když čteme podsíť/bránu fyzického adaptéru a virtuální/VPN adaptéry
ignorujeme, Home Office přes VPN se nikdy netváří jako provozovna.

---

## 3. Jak to funguje (systematicky)

1. **Agent** k dávce přiloží „síťový otisk" zařízení:
   - lokální IPv4 podsíť aktivního *fyzického* adaptéru (např. `10.10.0.0/16`),
   - MAC adresu výchozí brány (stabilní identifikátor dané LAN),
   - volitelně připojení typu (ethernet/wifi) a Wi-Fi SSID (jen pro rozlišení).
   - **Vynechá** virtuální/VPN/loopback adaptéry (TAP/TUN, „VPN", „Virtual",
     `WAN Miniport`, podsítě VPN poolu).
   - Jde o údaj o **síti zařízení**, ne o poloze osoby.
2. **Číselník provozoven** (administrace): seznam poboček + jejich síťové znaky:
   - `Brno → 10.10.0.0/16`
   - `Praha → 10.20.0.0/16`
   - `Hořovice (areál) → 10.30.0.0/16`
   - (volitelně seznam MAC bran pro jistotu)
3. **Server** otisk namapuje na provozovnu (shoda podsítě/brány). Když nic
   nesedí → **„Mimo firmu"** (Home Office / mimo síť).
4. **Dashboard** zobrazí lokalitu a rozpad času podle ní.

---

## 4. Datový model (návrh)

```
model Site {            // číselník provozoven
  id        String  @id @default(cuid())
  name      String          // "Brno", "Praha", "Areál Hořovice"
  subnets   String          // CSV CIDR, např. "10.10.0.0/16,10.11.0.0/16"
  gatewayMacs String?       // volitelně CSV MAC bran
  active    Boolean @default(true)
}

// ActivityInterval rozšířit o (vyhodnoceno serverem při ingestu):
//   siteId    String?   // null = Mimo firmu
//   netHint   String?   // surový otisk (podsíť) pro audit/ladění
```

Lokalita se vyhodnotí **při ingestu** (otisk → Site) a uloží k intervalu, aby
se dashboard nemusel dotazovat opakovaně. Lze i předpočítat do denních souhrnů
(`DailyStat` rozšířit o převažující lokalitu dne).

---

## 5. Dashboard / UX

- **Štítek u zaměstnance i zařízení**: 🏢 Brno · 🏢 Praha · 🏭 Hořovice · 🏠 Mimo firmu.
- **Detail zaměstnance**: rozpad „kde trávil pracovní čas" (např. Brno 70 %,
  Mimo firmu 30 %) — stejnou logikou jako kategorie/monitory.
- **Přehled firmy**: kolik lidí dnes pracuje na které provozovně / mimo firmu.
- **Provázání s Home Office**: „Mimo firmu" + HO den z OKbase = potvrzený
  Home Office; „Mimo firmu" bez HO dne = k prošetření (pracuje odjinud bez HO).
- Vysvětlivka: *„Lokalita se určuje podle firemní sítě, do které je PC
  připojené. VPN se nezapočítává jako pobočka."*

---

## 6. Právní pohled (GDPR / §316 ZP)

- Sledujeme **síť firemního zařízení**, ne polohu osoby → přiměřené účelu
  (organizace práce, bezpečnost, evidence Home Office).
- **Žádná přesná geolokace, žádné souřadnice, žádná adresa** mimo vlastní
  provozovny. Mimo firmu = jen „Mimo firmu".
- Údaj je **agregovaný a logovaný** stejně jako zbytek (auditní záznam přístupu).
- Nutné **doplnit do informace pro zaměstnance + DPIA** (že se eviduje
  provozovna podle firemní sítě). Vzory v `docs/monitoring/pravni/`.

---

## 7. Hraniční případy

- **Více adaptérů** (ethernet + wifi současně): ber aktivní s výchozí bránou;
  při shodě více preferuj ethernet.
- **VPN bez fyzické firemní sítě**: domácí podsíť → „Mimo firmu" (správně).
- **Pobočka bez vlastního rozsahu / sdílená VLAN**: rozliš podle brány MAC.
- **Nová/neznámá podsíť**: „Mimo firmu" + lze nabídnout adminovi „přiřadit k
  provozovně" (učení číselníku).
- **Mobilní data / cizí Wi-Fi**: „Mimo firmu".

---

## 8. Fáze implementace (až po odsouhlasení)

1. **Backend + administrace**: model `Site`, CRUD číselníku, mapování otisku,
   rozšíření ingest payloadu a `ActivityInterval`.
2. **Agent (C#)**: čtení podsítě/brány fyzického adaptéru (vynechání VPN),
   přidání do payloadu. (Buildí se v CI na Windows.)
3. **Dashboard**: štítky lokality, rozpad času podle provozovny, napojení na HO.
4. **Právní**: doplnit informaci zaměstnancům + DPIA.

Odhad: ~1–1,5 dne práce, agentní část je malá, hlavní je backend + UI.
