# Smlouva o zpracování osobních údajů (Data Processing Agreement / DPA)

*(Vzor pro SaaS nasazení FOCUS, kdy poskytovatel zpracovává osobní údaje
zaměstnanců zákazníka. Při on-prem nasazení u zákazníka — kde poskytovatel
NEMÁ přístup k datům — DPA většinou není potřeba; postačí licence + EULA.
Viz `00-DISCLAIMER.md`. Posuďte s právníkem/DPO.)*

---

## Smluvní strany

**Správce** (dále jen „Správce"):
- Obchodní firma: [DOPLŇTE: název odběratele FOCUS]
- IČO: [DOPLŇTE]
- Sídlo: [DOPLŇTE]
- Zástupce / DPO: [DOPLŇTE]

**Zpracovatel** (dále jen „Zpracovatel"):
- Obchodní firma: [DOPLŇTE: poskytovatel FOCUS, např. „FOCUS SaaS s.r.o."]
- IČO: [DOPLŇTE]
- Sídlo: [DOPLŇTE]
- Kontaktní osoba pro ochranu osobních údajů: [DOPLŇTE]

---

## 1. Předmět a účel zpracování

Zpracovatel pro Správce provozuje cloudovou službu **FOCUS** sloužící k
monitoringu využití firemních počítačů zaměstnanců Správce (dále jen
„Služba"). Účelem zpracování je:

- ověření přiměřeného využívání pracovní doby a svěřených pracovních
  prostředků (§ 316 odst. 1 zákoníku práce),
- ochrana majetku, bezpečnosti a organizace práce,
- HW telemetrie pro IT (předcházení výpadkům, plánování obnovy).

## 2. Kategorie subjektů údajů a osobních údajů

**Subjekty údajů:** zaměstnanci a kontraktoři Správce používající firemní PC.

**Kategorie údajů (vázané na zaměstnance přes Windows SID):**

| Údaj | Účel | Doba uchování |
|---|---|---|
| Jméno, oddělení, hodinová mzda (volitelné) | Identifikace, výpočet ceny neproduktivního času | po celou dobu zaměstnání + 30 dní |
| Aktivní / nečinný čas (po minutách → hodinách) | Doložení odpracované doby | 35 dní syrová, 540 dní agregovaná |
| Název aktivní aplikace | Klasifikace práce vs. mimopracovní činnosti | totožně |
| Titulek aktivního okna *(pokud zapnuto)* | Jemnější klasifikace | totožně |
| Počet úhozů a kliků (NIKDY ne obsah) | Tempo práce / detekce nečinnosti | totožně |
| Hostname, MAC, lokální IP počítače | Identifikace zařízení, mapování pracoviště | po dobu existence zařízení |
| HW telemetrie (CPU, RAM, baterie, disky, BIOS, antivirus) | IT preventivní údržba | 90 dní |
| Audit přístupů (kdo z adminů kdy nahlédl na čí data) | Doložení transparentnosti dle GDPR čl. 32 | 365 dní |

**FOCUS NIKDY nezaznamenává:** obsah úhozů (keylogger), screenshoty, obsah
mikrofonu/kamery, obsah souborů ani schránky, navštívené URL mimo název okna,
soukromou komunikaci.

## 3. Doba trvání zpracování

Tato smlouva nabývá účinnosti dnem podpisu obou stran a trvá po dobu trvání
licence / předplatného Služby. Po ukončení smlouvy Zpracovatel:

- na pokyn Správce předá kompletní dump dat ve formátu JSON (čl. 20 GDPR),
- ve lhůtě **30 dnů** od ukončení smlouvy nevratně smaže všechna osobní data
  ze své infrastruktury (včetně záloh, které následně rotují / přepíšou se
  do **90 dnů**); na žádost poskytne písemné potvrzení o smazání.

## 4. Práva a povinnosti Zpracovatele

Zpracovatel se zavazuje:

a) zpracovávat osobní údaje pouze na základě doložených pokynů Správce
   (v rozsahu této smlouvy a EULA);
b) zajistit, že osoby s přístupem k datům jsou vázány mlčenlivostí
   (smluvně nebo zákonem);
c) přijmout technická a organizační opatření dle čl. 32 GDPR (šifrování
   v přenosu i klidu, řízení přístupů, audit log, pravidelné zálohy,
   penetrační testování min. 1× ročně);
d) **bez zbytečného odkladu (max. 24 hodin)** informovat Správce o:
   - jakémkoli porušení zabezpečení osobních údajů (data breach),
   - závazné žádosti orgánu veřejné moci o vydání dat (s výjimkou, kdy
     by samotná informace porušila zákon);
e) pomáhat Správci plnit povinnosti vůči subjektům údajů
   (žádosti dle čl. 15–22 GDPR) — Služba FOCUS k tomu nabízí endpointy
   `GET /api/v1/admin/users/:id/export` a
   `DELETE /api/v1/admin/users/:id`;
f) na žádost Správce poskytnout přístup pro audit (1× ročně),
   včetně doložení dokumentace ISMS, výsledku posledního pentestu
   a zápisu o činnostech zpracování;
g) **využívat dalšího zpracovatele (subprocessora) pouze s předchozím
   písemným souhlasem Správce.** Aktuální seznam subprocessorů viz
   příloha A. Změna se oznamuje min. 30 dní předem.

## 5. Lokalita zpracování

Veškeré zpracování probíhá v rámci Evropské unie nebo Evropského
hospodářského prostoru. Konkrétně:

- Produkční prostředí: [DOPLŇTE: např. „AWS Frankfurt eu-central-1"]
- Zálohy: [DOPLŇTE: např. „Backblaze B2 EU"]
- Žádné předávání mimo EU/EHP bez předchozího souhlasu Správce a bez
  Standardních smluvních doložek (SCC).

## 6. Technická a organizační opatření

Zpracovatel garantuje minimálně:

- TLS 1.2+ pro veškerou komunikaci agent ↔ server, server ↔ klient
- HttpOnly + SameSite=Strict cookie pro admin session
- HMAC-SHA256 pro self-service tokeny s 12h platností
- Šifrování diskových svazků (LUKS / cloud-native)
- Per-device enrollment tokeny (žádný sdílený sekret)
- Role-based access control, immutable audit log
- Denní inkrementální zálohy, retence 30 dní, šifrované
- Logování přístupů adminů na úrovni řádků (kdo viděl koho)
- Pravidelné nezávislé penetrační testy (min. 1× ročně)

## 7. Odpovědnost a sankce

Při prokázaném porušení této smlouvy nebo GDPR Zpracovatelem nese
Zpracovatel odpovědnost za vzniklou škodu, včetně pokut uložených
ÚOOÚ Správci v rozsahu, v jakém pokuta vznikla z porušení Zpracovatele.

## 8. Závěrečná ustanovení

- Tato smlouva se řídí právem České republiky.
- Případné spory řeší obecné soudy ČR.
- Smlouva se uzavírá ve dvou stejnopisech, po jednom pro každou stranu.

V _________________ dne _______________

Za Správce: _________________________

Za Zpracovatele: ____________________

---

## Příloha A – Subprocessoři

Aktuální seznam dalších zpracovatelů, kterých Zpracovatel využívá:

| Subprocessor | Účel | Lokalita | Odkaz na DPA |
|---|---|---|---|
| [DOPLŇTE např. AWS] | hosting | eu-central-1 (Frankfurt) | https://aws.amazon.com/agreement/ |
| [DOPLŇTE např. Sentry] | error tracking | eu | https://sentry.io/legal/dpa/ |

Aktuální seznam vždy na: [DOPLŇTE: URL k subprocessor listu]
