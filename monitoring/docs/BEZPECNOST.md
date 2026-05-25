# Bezpečnostní audit a opatření

Kritický pohled na řešení podle běžných standardů (OWASP) a co bylo upraveno.

## Co bylo zjištěno a opraveno (v kódu)

| Oblast | Zjištění | Opatření |
|---|---|---|
| **Autentizace dashboardu** | Basic auth + scrypt na **každém** požadavku → DoS vektor, pomalé | **Session tokeny**: scrypt jen 1× při přihlášení, dál levný Bearer token (12 h platnost) |
| **Brute-force loginu** | žádné omezení pokusů | **Rate limit** na `/login` (20 / 15 min/IP) |
| **Zneužití ingestu** | bez omezení četnosti | **Rate limit** na `/ingest` (1000 / min/IP) |
| **Porovnání tokenu agenta** | `!==` (timing) | **konstantní-časové** porovnání (`timingSafeEqual`) |
| **CORS** | `cors()` povoloval **všechny** originy | CORS jen pro explicitně nastavený `CORS_ORIGIN`; jinak vypnuto (SPA je same-origin) |
| **Bezpečnostní hlavičky** | CSP úplně vypnuta | **konzervativní CSP** (`default-src 'self'`, bez inline skriptů) + helmet (HSTS, nosniff, frameguard) |
| **Únik chyb** | async chyby mohly spadnout/odhalit detaily | `express-async-errors` + **generická chybová odpověď** (žádný stack ven) |
| **Slabá výchozí tajemství** | default `admin`/`dev-token` | v **produkci** start **odmítnut** se slabými hesly/tokeny (`assertProductionSecrets`) |
| **Validace vstupu** | — | vstupy validovány přes **zod**; DB přístup přes Prisma (bez SQL injection) |
| **Hesla v DB** | — | **scrypt** se solí (jednosměrně) |
| **Auditovatelnost** | — | log každého náhledu/exportu dat (kdo, kdy, čí) |

## Bezpečnostní testy (automatické, `npm test`)

- chráněné endpointy bez tokenu → 401,
- špatné heslo → 401, neplatný/chybějící ingest token → 401,
- neplatný payload → 400,
- **řízení rolí**: VIEWER nesmí měnit kategorie (403), ADMIN smí (200),
- idempotence ingestu, správnost agregace, export `.xlsx`.

Celkem 16 testů, všechny procházejí.

## Závislosti

- **Backend: 0 zranitelností** (`npm audit`).
- **Frontend:** moderate nález v `esbuild`/`vite` se týká **jen vývojového serveru**
  (`npm run dev`), ne produkčního buildu, který servíruje backend. V produkci se
  Vite dev server nepoužívá, takže reálné riziko je nulové. Upgrade na Vite 8 je
  breaking – odložen.

## Co musí zajistit nasazení (mimo kód)

1. **HTTPS/TLS** na backendu (platný certifikát), bez HTTP. HSTS se pak uplatní.
2. **Šifrování úložiště** serveru (BitLocker/LUKS) nebo TDE PostgreSQL → data v klidu.
3. Silné `ADMIN_PASSWORD` a `INGEST_TOKEN`, nastavit `CORS_ORIGIN` jen je-li potřeba.
4. Síťové omezení (API/dashboard jen z firemní sítě/VPN), firewall.
5. Pravidelná revize **auditního logu** a rolí; aktualizace závislostí.
6. Code-signing agenta i MSI a allowlist v AV/EDR (viz `DOKUMENTACE.md`).

## Zbývající doporučení (roadmap)

- **Per-device tokeny** (místo sdíleného ingest tokenu), uložené hashovaně.
- **2FA** pro admin přihlášení.
- Sdílené úložiště session tokenů (Redis) při více instancích backendu.
- Verzované DB migrace pro PostgreSQL (nyní `db push` v Dockeru).
