# Upozornění k právním šablonám

Dokumenty v této složce jsou **vzory / podklady**, nikoli hotové právní
dokumenty a **nejsou právním poradenstvím**. Jsou připravené tak, aby
odpovídaly tomu, co systém FOCUS technicky sbírá (pouze agregované metriky,
žádný obsah – viz [`../NAVRH.md`](../NAVRH.md)).

**Před nasazením musí dokumenty posoudit a schválit váš:**
- právník / advokát se specializací na pracovní právo a GDPR,
- pověřenec pro ochranu osobních údajů (DPO), je-li jmenován.

Místa k doplnění jsou označena `[DOPLŇTE: …]`.

Šablony vycházejí z aktuální legislativy ČR a EU:
- **Zákon č. 262/2006 Sb., zákoník práce** (zejm. § 316 odst. 1–3)
- **Nařízení EU 2016/679 (GDPR)** — účinné od 25. 5. 2018
- **Zákon č. 110/2019 Sb., o zpracování osobních údajů** — nahradil zrušený zákon 101/2000 Sb.
- **Zákon č. 89/2012 Sb., občanský zákoník (NOZ)** — § 81–90 (ochrana osobnosti)
- **Zákon č. 127/2005 Sb., o elektronických komunikacích** (§ 89)
- **Zákon č. 40/2009 Sb., trestní zákoník** (§ 180, § 182)
- **Listina základních práv a svobod** (čl. 10, čl. 13)

> ⚠️ **Zastaralá referenční literatura, kterou tyto šablony NÁHRADILY:**
> – Zákon č. 101/2000 Sb. o ochraně osobních údajů → **zrušen 24. 4. 2019**
> – Občanský zákoník č. 40/1964 Sb. → **zrušen 1. 1. 2014**
> – Směrnice 95/46/EC → **zrušena GDPR (25. 5. 2018)**
> – Registrace u ÚOOÚ podle § 16 ZOOÚ → **zrušeno**, nahrazeno čl. 30 GDPR (interní záznam o činnostech)

## Přehled dokumentů

| # | Dokument | Pro koho |
|---|---|---|
| 01 | [Informace pro zaměstnance](01-informace-zamestnancum.md) | Zaměstnanec — povinné poučení podle § 316/3 ZP a čl. 13 GDPR |
| 02 | [Podklad pro DPIA](02-dpia-podklad.md) | DPO / správce — posouzení vlivu na ochranu osobních údajů (čl. 35 GDPR) |
| 03 | [Balanční test](03-balancni-test.md) | DPO / správce — vyvážení oprávněného zájmu a soukromí (čl. 6/1/f GDPR) |
| 04 | [DPA (Data Processing Agreement)](04-dpa-vzor.md) | Pokud používáte FOCUS jako SaaS — smlouva o zpracování |
| 05 | [Privacy Policy / Zásady ochrany OÚ](05-privacy-policy.md) | Zveřejnění zaměstnancům / na intranet |
| 06 | [Záznam o činnostech zpracování (RRPP)](06-rrpp-vzor.md) | Interní záznam podle čl. 30 GDPR |
| 07 | [Plán reakce na bezpečnostní incident](07-incident-response.md) | Runbook pro data breach |
| 08 | **[Právní manuál FOCUS](08-pravni-manual.md)** | **Souhrnný manuál — začněte tady** |

**Doporučené pořadí čtení:**
1. `08-pravni-manual.md` — orientace v celém právním rámci
2. `02-dpia-podklad.md` + `03-balancni-test.md` — vyplnit pro váš konkrétní případ
3. `01-informace-zamestnancum.md` — distribuovat zaměstnancům
4. `05-privacy-policy.md` — zveřejnit
5. `06-rrpp-vzor.md` — uložit do interní evidence
6. `04-dpa-vzor.md` — pouze pokud SaaS
7. `07-incident-response.md` — vytisknout a uložit mimo IT systémy
