# Záznam o činnostech zpracování (RRPP) – FOCUS

*(Vzor záznamu dle čl. 30 GDPR. Vyplní Správce, ukládá interně, na žádost
předkládá ÚOOÚ. Viz `00-DISCLAIMER.md`.)*

---

## 1. Identifikace správce

- **Správce:** [DOPLŇTE: zaměstnavatel, IČO, sídlo]
- **Pověřenec pro ochranu osobních údajů (DPO):** [DOPLŇTE: jméno + kontakt]
- **Kontaktní osoba pro RRPP:** [DOPLŇTE]

## 2. Účely zpracování

| # | Účel | Právní základ |
|---|---|---|
| A1 | Kontrola přiměřeného využití firemních PC | § 316 ZP + čl. 6 odst. 1 písm. f) GDPR |
| A2 | IT preventivní údržba (HW telemetrie) | čl. 6 odst. 1 písm. f) GDPR |
| A3 | Hodnocení a koučování zaměstnanců | čl. 6 odst. 1 písm. f) GDPR |

## 3. Kategorie subjektů údajů a osobních údajů

**Subjekty:** zaměstnanci a kontraktoři používající firemní PC s nainstalovaným
FOCUS agentem.

**Kategorie údajů:**

| Kategorie | Pole | Citlivost |
|---|---|---|
| Identifikační | jméno, Windows SID, oddělení, e-mail | běžné |
| Pracovní | hodinová mzda *(volitelné, pouze pro výpočet ceny neproduktivního času)* | citlivé HR |
| Behaviorální | počet úhozů, počet kliků, foreground aplikace, *titulek okna* | běžné (titulek může být citlivý) |
| Technické | hostname, MAC, lokální IP, agent verze | běžné |
| HW telemetrie | CPU, RAM, baterie, disky, BIOS, antivirus | technické |
| Audit | log přístupů adminů k jednotlivým záznamům | běžné |

## 4. Příjemci údajů

| Příjemce | Účel přístupu | Rozsah |
|---|---|---|
| Vedoucí zaměstnanec (role ADMIN) | A1, A3 | Vlastní oddělení (filtr) |
| HR (role ADMIN) | A1, A3, mzdy | Celá firma |
| IT správce (role VIEWER) | A2 | Technická data + agregáty (bez mzdy) |
| DPO | Audit, žádosti subjektů | Vše |
| [DOPLŇTE: poskytovatel SaaS, pokud používáte] | A1+A2+A3 (dle DPA) | Vše |

## 5. Předávání mimo EU/EHP

**Žádné**, pokud není v této sekci uvedeno jinak. Konkrétně: [DOPLŇTE].

## 6. Lhůty pro výmaz

| Údaj | Lhůta | Mechanismus |
|---|---|---|
| Surové intervaly aktivity | 35 dní | Automatická úloha (denně 03:30) |
| Hodinové agregáty | 540 dní | Automatická úloha |
| Denní statistiky | 540 dní | Automatická úloha |
| HW telemetrie (snapshot) | 90 dní | Automatická úloha |
| Audit přístupů | 365 dní | Automatická úloha |
| Identifikační údaje (jméno, SID) | Po dobu pracovního poměru + 30 dní | Manuální (HR) |

## 7. Technická a organizační opatření (TOM)

- **Šifrování v přenosu:** TLS 1.2+ (agent ↔ server, klient ↔ server).
- **Šifrování v klidu:** [DOPLŇTE: BitLocker / LUKS / cloud-native].
- **Přístupová oprávnění:** RBAC (ADMIN / VIEWER), Windows AD integrace.
- **Audit přístupů:** každý view/export/delete je trvale zaznamenán
  (tabulka `AccessAudit`).
- **Zálohy:** denní inkrementální, šifrované, retence 30 dní, [DOPLŇTE: lokalita].
- **Backup test:** 1× za 3 měsíce nahodilý obnova ze zálohy.
- **Penetrační test:** [DOPLŇTE: 1× ročně / dle smlouvy s dodavatelem].
- **Vendor management:** subprocessoři pouze s DPA, viz Příloha A.
- **Incident response:** plán [DOPLŇTE odkaz na `07-incident-response.md`].

## 8. Posouzení vlivu na ochranu osobních údajů (DPIA)

DPIA byla provedena dne [DOPLŇTE: datum] a uložena v dokumentu
`02-dpia-podklad.md`. Závěr: **monitorování firemních PC pomocí FOCUS
představuje rizikové zpracování (čl. 35 GDPR), ale s implementovanými
TOM je riziko akceptovatelné.**

Klíčová rozhodnutí z DPIA:

- ❌ **Sběr titulku okna je vypnut by default** (CAPTURETITLE=0).
  Zapnutí vyžaduje samostatné rozhodnutí + vyrozumění zaměstnance.
- ✅ **Sběr probíhá pouze v pracovní době v rámci firemního PC**, nikoli
  na soukromých zařízeních.
- ✅ **Self-service portál pro zaměstnance** umožňuje pohled na vlastní data
  i přehled, kdo se na ně díval.

## 9. Datum poslední aktualizace

[DOPLŇTE: datum a osoba]

---

### Příloha A – Subprocessoři

| Subprocessor | Účel | Lokalita | DPA |
|---|---|---|---|
| [DOPLŇTE: AWS / Azure / on-prem = N/A] | Hosting databáze | eu-central-1 | https://aws.amazon.com/agreement/ |
| [DOPLŇTE: Sentry] | Error tracking | EU | https://sentry.io/legal/dpa/ |
| [DOPLŇTE: e-mail SMTP] | Odesílání reportů | EU | … |
