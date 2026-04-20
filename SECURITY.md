# Bezpečnostní přehled

Self-audit provedený při závěrečném harnování projektu (2026-04-20). Prošel jsem
kód proti OWASP Top 10 + několika Node-specifickým kategoriím. Níže jsou nálezy
rozdělené na **opravené** a **známé/přijaté**.

## Opraveno během auditu

### 🔴 CORS: reflected-origin + credentials (High)

**Bylo:** `cors({ origin: true, credentials: true })` — server odrazil jakýkoliv
Origin hlavičku a povolil cookies/basic-auth. Kdyby uživatel měl v prohlížeči
nacachovaný basic-auth, škodlivá stránka by mohla dělat autentikované požadavky
na jeho lokální dashboard (CSRF / credential theft).

**Opraveno:** explicitní allowlist `localhost:PORT` + `localhost:5173` (Vite dev).
Další origins se dají přidat přes `CORS_EXTRA_ORIGIN` v `.env` (čárkou oddělené).

Commit: `backend/src/index.ts` — `allowedOrigins` lookup v CORS middleware.

## Přijaté jako „známé limity"

### ⚠️ HTTP Basic Auth (ne session/OIDC)

**Proč:** Pro interní nástroj 1-2 operátory je basic auth dostatečný. Každý
operátor potřebuje vlastní session pokud chce per-user audit log.

**Mitigace:** `DASHBOARD_PASSWORD` musí být silné (min. 16 znaků). Ve veřejné
síti MUSÍ běžet za TLS reverse proxy.

**Plánovaná náhrada:** OIDC / session management v Fázi 4 (viz README).

### ⚠️ SMTP notifikace jsou stub

**Proč:** `services/notify.ts` jen loguje místo skutečného emailu. Pro demo OK,
produkce vyžaduje nodemailer + firemní SMTP relay.

### ⚠️ Rate-limit bucket in-memory

**Proč:** `meta/rate-limit.ts` má per-page token bucket v paměti procesu. Při
restartu se vynuluje. Pro multi-instance deployment nahradit Redis token bucket.

**Mitigace:** single-instance na localhost je OK. Incident v bucket = nanejvýš
jeden extra Graph API volání těsně po restartu.

### ⚠️ Žádný backend rate-limit (inbound)

**Proč:** Lokální nástroj s basic auth — operátor sám sebe neuDoSuje. Expozice
na veřejnou IP by vyžadovala middleware (např. `express-rate-limit`).

### ⚠️ `/metrics` endpoint nezaheslovaný

**Proč:** Standardní pattern pro Prometheus scrape. Očekává se síťová
politika / proxy pravidlo.

**Mitigace:** Dokumentováno v README („Prometheus scrape endpoint — omez síťovou
politikou"). Pro veřejný deployment obalit basic-auth nebo přesunout na
interní port.

## Prošlo auditem (žádný nález)

### ✅ Šifrování tokenů v klidu (Meta PAT)

- AES-256-GCM s random IV + auth tag (`crypto.ts`).
- Klíč načítán z env, neserializuje se.
- 64-char hex klíč validovaný při startu.
- Test pokrývá round-trip + unikátnost ciphertextu.

### ✅ Webhook podpisy (Meta → nás)

- HMAC-SHA256 ověření přes `timingSafeEqual` (constant-time).
- Neplatný podpis → 401, žádný side effect.
- Audit log nezapíše, než je podpis ověřen.
- Test: 4 integration testy pro GET verify + POST sig OK/fail.

### ✅ OAuth state parameter

- `crypto.randomBytes(16)` generovaný per-request.
- Uchovaný v in-memory Set, s 10-min TTL.
- Ověřovaný v callbacku, mismatch → 400.
- CSRF ochrana Meta OAuth flow v pořádku.

### ✅ Input validation

- Zod schemas v `rules`, `templates` routes pro POST/PATCH.
- Prisma binding parameters (žádné string konkatenace).
- React JSX escape defaults.
- 17 `.parse()` / `.safeParse()` použití napříč routes.

### ✅ Raw SQL

- Jediné `queryRawUnsafe` je `SELECT 1` v health check — žádný uživatelský
  vstup.
- Stats route bylo přepsané ze raw SQL na Prisma queryBuilder (stalo se
  v commitu `f7c5ff6` po nálezu bugu s `datetime()` funkcí).

### ✅ XSS

- React strictly escapes při renderu (`{text}`).
- Žádný `dangerouslySetInnerHTML`.
- Žádný server-rendered HTML s user contentem.

### ✅ Secret material v git

- `.gitignore` zahrnuje `.env`, `.env.local`, `*.db`.
- Žádný hardcoded secret v commitnutém kódu (`grep` pro `sk-ant`, `EAAG`,
  `AKIA`, `BEGIN PRIVATE` vrátil jen test fixtury).
- `TOKEN_ENCRYPTION_KEY` v `.env.example` prázdný.

### ✅ Open redirect

- Jediný `res.redirect` je v `/auth/start` → URL postavená z konstant
  (Meta OAuth dialog URL), není parametrizovaná uživatelem.

### ✅ Path traversal / file I/O

- Frontend servírován přes `express.static` z pevně dané cesty.
- Žádné user-controlled path.

### ✅ Server-Side Request Forgery

- Všechny outbound calls jdou na fixně nakonfigurované hosty (graph.facebook.com,
  api.anthropic.com, Slack webhook URL z env).
- Žádný endpoint nepřijímá URL od uživatele k fetch.

### ✅ Dependency freshness

- Prisma 5.22, React 18.3, Express 4.21, Anthropic SDK 0.30.
- Žádné známé kritické CVE v aktuální matici (proveden `npm audit` —
  5 moderate severity, všechny tranzitivní, bez fix bez major upgrade ESLint 8).

## Doporučení před produkčním nasazením

1. Změnit `DASHBOARD_PASSWORD` na silné (generator, min 20 znaků).
2. Nasadit za TLS reverse proxy (Caddy/nginx s HSTS).
3. Nahradit basic auth OIDC-em pokud je více než 2 operátoři (per-user audit).
4. Zapnout `CORS_EXTRA_ORIGIN` s přesnou produkční doménou (bez localhost).
5. Obalit `/metrics` network policy nebo basic-auth.
6. Nastavit `META_WEBHOOK_VERIFY_TOKEN` a `SESSION_SECRET` na nové náhodné
   hodnoty (ne z `.env.example`).
7. Pravidelné zálohování DB + rotace šifrovacího klíče (migrace stávajících
   tokenů).
8. Monitorovat `/health/ready` + `/metrics` v orchestrátoru.

## Hlášení bezpečnostních chyb

Interní nástroj — hlaste přes standardní interní ALBIXON security kanál. Pro
externí bezpečnostní výzkumníky není projekt v tuto chvíli otevřen.
