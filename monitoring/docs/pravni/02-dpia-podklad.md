# DPIA – posouzení vlivu na ochranu osobních údajů (podklad)

*(Vzor dle čl. 35 GDPR – posuďte s DPO/právníkem. Viz `00-DISCLAIMER.md`.)*

**Správce:** [DOPLŇTE]  **Zpracování:** Monitoring využití firemních zařízení (FOCUS)
**Zpracoval / datum:** [DOPLŇTE]  **DPO:** [DOPLŇTE]

## 1. Popis zpracování

| Položka | Popis |
|---|---|
| Účel | Kontrola využití pracovní doby a prostředků (§ 316 odst. 1 ZP) |
| Subjekty údajů | Zaměstnanci používající služební PC |
| Kategorie údajů | Aktivní/nečinný čas, název aktivní aplikace, **titulek aktivního okna** (pro klasifikaci práce/mimopráce, je-li zapnuto), **počty** úhozů a myších událostí, stav uzamčení; identifikátory zařízení a uživatele (SID, jméno) |
| Citlivé údaje (čl. 9) | **Cíleně se nezpracovávají.** Titulek okna může výjimečně osobní údaj obsahovat – řešeno minimalizací, poučením zaměstnanců a řízeným přístupem |
| Příjemci | Pověřené osoby [DOPLŇTE] |
| Doba uložení | Detail [DOPLŇTE], souhrny [DOPLŇTE] |
| Předání mimo EU | [DOPLŇTE: ne / ano + záruky] |

## 2. Nezbytnost a proporcionalita

- **Právní základ:** oprávněný zájem (čl. 6/1/f GDPR) + § 316/1 ZP.
- **Minimalizace:** sbírají se agregované metriky a titulek okna pro klasifikaci;
  **žádný obsah** (bez keyloggingu, screenshotů, e-mailů, mikrofonu/kamery).
- **Titulek okna:** sbírán pouze pro rozlišení typu činnosti (práce/mimopráce),
  ne obsah; lze vypnout (CaptureWindowTitle). Zaměstnanci jsou poučeni.
- **Transparentnost:** zaměstnanci předem informováni (dokument 01),
  agent zobrazuje viditelnou ikonu.
- **Méně invazivní alternativa:** vyhodnocena – sběr obsahu by byl
  nepřiměřený a v rozporu s § 316/2 ZP, proto vyloučen.

## 3. Rizika pro subjekty údajů a opatření

| Riziko | Míra | Opatření |
|---|---|---|
| Nadměrné sledování / profilování výkonu | Střední | Pouze agregáty, žádný obsah; data slouží k organizaci práce, ne k automatizovanému rozhodování |
| Neoprávněný přístup k údajům | Střední | Řízení rolí, **audit log přístupů**, šifrování přenosu (TLS) i úložiště |
| Únik tokenu agenta | Nízká–stř. | Token mimo veřejné skripty, plán per-device tokenů |
| Nepřesná interpretace nečinnosti | Střední | Plán napojení absencí (OKbase) a meetingů (Outlook) pro kontext |
| Nadměrná retence | Nízká | Automatické mazání dle politiky |

## 4. Závěr

Zbytkové riziko po opatřeních: [DOPLŇTE: nízké/střední].
Konzultace s DPO: [DOPLŇTE].  Nutnost konzultace s ÚOOÚ (čl. 36): [DOPLŇTE: ne/ano].

Schválil: [DOPLŇTE]  Datum revize: [DOPLŇTE]
