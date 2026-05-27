# Plán reakce na bezpečnostní incident (Incident Response Plan)

*(Vzor pro Správce nasazujícího FOCUS. Vyplnit, schválit, mít vytištěné
mimo IT systémy. Viz `00-DISCLAIMER.md`.)*

---

## 1. Účel a působnost

Tento plán určuje, co dělat při zjištění:

- **úniku osobních údajů** zaměstnanců (data breach),
- neoprávněného přístupu k FOCUS dashboardu nebo databázi,
- ztráty / krádeže firemního PC s nainstalovaným agentem,
- ransomware útoku na FOCUS server,
- vážné chyby v aplikaci ohrožující integritu dat.

## 2. Tým a kontakty

| Role | Jméno | Telefon | E-mail | Záskok |
|---|---|---|---|---|
| **Incident Commander** | [DOPLŇTE] | | | |
| **DPO / GDPR koordinátor** | [DOPLŇTE] | | | |
| **IT lead** | [DOPLŇTE] | | | |
| **Právní oddělení** | [DOPLŇTE] | | | |
| **Komunikace / PR** | [DOPLŇTE] | | | |
| **Vedení firmy (eskalace)** | [DOPLŇTE] | | | |

## 3. Závažnost incidentu

| Úroveň | Definice | SLA reakce |
|---|---|---|
| **P1 – Kritický** | Únik dat 100+ zaměstnanců, ransomware, kompromitace produkčního serveru | 15 min |
| **P2 – Vysoký** | Únik dat 1–99 zaměstnanců, neoprávněný přístup ADMINa | 60 min |
| **P3 – Střední** | Chyba aplikace bez úniku dat, ale s rizikem | 4 hod |
| **P4 – Nízký** | Suspicious activity bez prokázané škody | 1 den |

## 4. Postup (Runbook)

### KROK 1 – Detekce a triáž (0 – 30 min)

- [ ] Kdo nahlásil? (interní / e-mail / monitoring alert / klient)
- [ ] Co se stalo? Stručný popis.
- [ ] Kolik dat / zaměstnanců se týká?
- [ ] Pokračuje incident, nebo už skončil?
- [ ] Určit závažnost P1–P4.
- [ ] Svolat Incident Commandera.

### KROK 2 – Zastavení útoku (0 – 60 min pro P1/P2)

Podle typu:

**A) Únik dat / ransomware:**
- [ ] Odpojit FOCUS server od sítě (síťový izolace, **NIKOLI** vypnout VM
      – ztratíme forenzní stopy v RAM).
- [ ] Otočit (rotate) všechny secrets: INGEST_TOKEN, ADMIN_PASSWORD,
      DATABASE_URL hesla, cookie secret, SMTP_PASS.
- [ ] Zneplatnit všechny session tokeny (restart serveru po rotaci secret).
- [ ] U cloud DB: zmrazit snapshot pro forenzní analýzu.

**B) Neoprávněný přístup admin účtu:**
- [ ] Zablokovat admin účet (`active=false`).
- [ ] V `AccessAudit` najít všechny pohledy/exporty od kompromitovaného účtu.
- [ ] Rotovat heslo, vynucení MFA u všech adminů.

**C) Ztráta / krádež PC s agentem:**
- [ ] V dashboardu deaktivovat zařízení (`active=false`).
- [ ] Odvolat per-device enrollment token toho PC.
- [ ] Nahlásit Policii ČR (zařízení i případně ztracená data).
- [ ] Pokud je PC s BitLockerem → riziko nízké.
- [ ] Pokud bez BitLockeru → P2/P3 incident.

### KROK 3 – Vyšetřování (1 – 24 hod)

- [ ] Sebrat logy:
  - `journalctl -u focus-backend` / `docker logs focus-backend`
  - PostgreSQL audit log
  - reverse-proxy access log
  - `AccessAudit` tabulka (poslední 90 dní)
- [ ] Identifikovat:
  - Vstupní vektor (jak útočník dostal přístup?)
  - Rozsah dat (kolik záznamů viděl / stáhl?)
  - Časové okno (od kdy do kdy?)
- [ ] Forenzní snapshot DB pro důkaz (uložit na izolované úložiště).

### KROK 4 – Notifikace (P1/P2: do 72 hodin od zjištění)

**GDPR čl. 33 – Hlášení ÚOOÚ:**
- [ ] Pokud únik představuje riziko pro práva subjektů → ÚOOÚ
      do **72 hodin** od zjištění.
- [ ] Formulář: https://www.uoou.cz/oznameni-poruseni-zabezpeceni
- [ ] Co hlásit: rozsah, počet subjektů, typ údajů, opatření, kontakt na DPO.

**GDPR čl. 34 – Informování zaměstnanců:**
- [ ] Pokud únik představuje **vysoké** riziko → informovat dotčené zaměstnance.
- [ ] Forma: e-mail + osobně + intranet.
- [ ] Obsah: co uniklo, riziko, co děláme, co mají dělat oni.

**Interní:**
- [ ] Vedení firmy (do 4 hod).
- [ ] Compliance / právní (do 4 hod).
- [ ] Odborové organizace, je-li nutné (do 24 hod).

### KROK 5 – Náprava (1 – 30 dní)

- [ ] Patch aplikace, pokud byla zranitelnost.
- [ ] Obnovení DB ze zálohy, pokud ransomware (NIKDY neplatit výkupné bez
      konzultace s policií a kybernetickou agenturou NÚKIB).
- [ ] Změna procesů (MFA, snížení počtu adminů, segmentace sítě).
- [ ] Penetrační test po nápravě.

### KROK 6 – Post-mortem (do 30 dní po incidentu)

- [ ] Sepsat post-mortem dokument:
  - Časová osa události
  - Root cause
  - Co fungovalo
  - Co selhalo
  - Nápravná opatření (s deadliny a vlastníky)
- [ ] Prezentace pro vedení.
- [ ] Aktualizace tohoto plánu.

## 5. Komunikační šablony

### Pro zaměstnance (čl. 34 GDPR)

> Vážená kolegyně, vážený kolego,
>
> dne [DATUM] jsme zjistili bezpečnostní incident v systému FOCUS,
> který používáme ke kontrole využití firemních PC.
>
> **Co se stalo:** [stručný popis]
> **Které vaše údaje jsou dotčené:** [seznam]
> **Riziko pro vás:** [popis]
> **Co děláme:** [opatření]
> **Co můžete udělat vy:** [doporučení, např. změnit heslo, hlídat kreditku]
>
> Žádost o další informace nebo námitku směřujte na DPO:
> [E-MAIL DPO]
>
> S omluvou za vzniklé nepříjemnosti,
> [JMÉNO + FUNKCE]

### Pro ÚOOÚ (čl. 33)

Formulář na https://www.uoou.cz se vyplňuje online – obsahuje:
- popis porušení
- kategorie údajů a počty subjektů
- pravděpodobné důsledky
- přijatá nebo navržená opatření
- kontakt na DPO

## 6. Kontakty externí

- **ÚOOÚ:** posta@uoou.cz, +420 234 665 111
- **NÚKIB (CERT, ransomware):** cert@nukib.cz, +420 541 110 762
- **Policie ČR (kybernetická kriminalita):** 158
- **Datový auditor (pokud máte):** [DOPLŇTE]

## 7. Příloha – Záznam incidentu

Vyplnit pro každý incident:

```
ID incidentu:       [DOPLŇTE: INC-2026-001]
Datum a čas zjištění: [DOPLŇTE]
Datum a čas události: [DOPLŇTE]
Závažnost:           P1 / P2 / P3 / P4
Kategorie:           Únik dat / Ransomware / Kompromitace / Chyba / Jiné
Stručný popis:       [DOPLŇTE]
Incident Commander:  [DOPLŇTE]
Stav:                Open / Mitigated / Resolved / Closed
Hlášení ÚOOÚ:        Ano / Ne / Není potřeba (datum: ___)
Hlášení zaměstnancům: Ano / Ne / Není potřeba (datum: ___)
Post-mortem:         odkaz / N/A
```
