# Troubleshooting

Řešení běžných problémů — rozdělené podle toho, koho se týkají.

---

## Pro operátory (MKT tým)

### „Nemohu se přihlásit"

**1. Uvidíš nekonečný dialog na heslo:**
- Ověř, že kopíruješ heslo přesně (bez mezer na konci)
- Na iOS Safari často propadne autofill s chybným heslem — zkus **Soukromé okno**
- Zkus jiný prohlížeč (Chrome, Firefox)
- Pokud to stále nejde, ozvi se adminovi — mohla se rotovat hesla

**2. Vidíš 429 „rate_limited":**
- Asi jsi / někdo jiný zkusil špatné heslo 30× za 15 minut. Počkej 15 minut.
- Pokud to není tvoje vina, admin uvidí brute-force pokusy v audit logu →
  dá vědět IT.

**3. Vidíš 403 „ip_not_allowed":**
- Jsi mimo firemní síť / VPN. Připoj se na VPN a zkus znovu.

### „Vidím tlačítko Smazat, ale když kliknu, nic se nestane / chyba 403"

Máš roli **moderator**, ne **admin**. Můžeš jen **Skrýt** a **Ponechat**.
Pokud je potřeba smazat, napiš adminovi.

### „Klepl/a jsem na Odpovědět a dostala chybu 403"

Admin má vypnuté **odpovědi** (kill switch). Nic se nepublikovalo. Ozvi se
mu, ať ověří, jestli chce odpovědi zapnout, nebo jestli máš komentář
předat jinak.

### „AI klasifikace je úplně špatně"

- Klikni **↻ (Překlasifikovat)** u řádku — aplikace zavolá silnější model
  (Sonnet) a možná odpoví jinak
- Pokud stále špatně, **přenech to druhé klasifikaci** — klikni na svůj
  vlastní názor (Skrýt/Smazat/Ponechat) a napiš adminovi, že AI má chybu
  v této kategorii (admin může upravit prompt)

### „Neukazuje mi graf ve Statistikách"

- Pokud jsi zrovna začal/a používat aplikaci, nemáš ještě historii
- Pokud víš, že by tam data měla být, zkus obnovit stránku
- Přetrvává to víc než 10 minut → ozvi se adminovi

### „Dostávám spoustu Slack notifikací, nestíhám"

- Admin může zúžit **kritická klíčová slova** (Admin → sekce „Kritická klíčová slova")
- Nebo zvýšit threshold pro `brand_attack` — AI bude méně citlivá na hraniční
  případy
- Dočasně lze ztlumit Slack kanál, ale nedoporučuje se (může unikat
  opravdu kritický komentář)

### „Vidím všechny komentáře, ale nemůžu s ničím nic dělat"

Máš roli **viewer** (read-only). Pokud bys měla být operátor, ozvi se adminovi.

---

## Pro admina

### Server nestartuje v `production` módu

Typické hlášky v logu:

**1.** `DASHBOARD_USERS has no admin` — alespoň jeden uživatel musí mít
`:admin` příponu. Uprav `.env`:
```
DASHBOARD_USERS=honza:SilneHeslo123!:admin,petra:SilneHeslo456!:moderator
```

**2.** `Weak dashboard passwords: honza (common/default, only 4 chars)` —
jedno z hesel je příliš slabé. Pravidla:
- ≥ 12 znaků
- Není v blacklistu (`demo`, `admin`, `password`, `test`, `123456`, …)
- Není stejné jako username

**3.** `TOKEN_ENCRYPTION_KEY must be 64 hex chars` — vygeneruj nový:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Varování:** pokud měníš ten klíč u existujícího nasazení, všechny
uložené Meta tokeny se stanou nečitelnými → musíš projít OAuth znovu.

### `/health/ready` hlásí ✗ u některých položek

| Check | Co dělat, když je červené |
|---|---|
| **db** | SQLite/Postgres nedostupné. Zkontroluj `DATABASE_URL`, práva na složku, `prisma migrate deploy` |
| **anthropicKey** | Nastav `ANTHROPIC_API_KEY` v `.env` a restartuj |
| **metaAppConfig** | Nastav `META_APP_ID` + `META_APP_SECRET` v `.env` a restartuj |
| **tokenEncryption** | Viz výše — vygeneruj 64hex klíč |
| **accounts** | Přihlaš alespoň jednu stránku přes OAuth (`Účty → Připojit přes Meta`) |

### Meta OAuth flow nefunguje

**„redirect_uri_mismatch":**
- V Meta App dashboardu musí být `META_REDIRECT_URI` uvedený přesně
  stejně, včetně protokolu (`https://…`) a koncového `/auth/callback`
- Zkontroluj, že **doména** se shoduje (`moderator.albixon.cz` vs.
  `moderator.albixon.com`)

**„app not approved" / „scope not permitted":**
- V Meta App dashboardu jsi v **Development módu**. Scopes jako
  `pages_manage_engagement` fungují jen pro uživatele s rolí v App
  Roles. Přidej si sebe do **App Roles → Testers**.
- Pro produkci je potřeba projít **Meta App Review**.

**OAuth se zdárně vrátí, ale `Účty` zůstává prázdné:**
- Zkontroluj, že propojuješ účet, který má **role stránky** (Admin /
  Editor) na ALBIXON / BRILIX FB stránce
- Instagram **Business/Creator** účet musí být v Meta Business Manageru
  propojený s FB stránkou, ke které máš přístup

### Polling běží, ale nové komentáře se neobjevují

1. Admin → **Spustit polling teď** → dívej se do logu
2. V logu hledej `graph api error`:
   - `190 Invalid OAuth` → token expiroval, projdi OAuth znovu
   - `4 Application request limit reached` → rate-limit, počkej hodinu
   - `Host not in allowlist` → běží v sandboxu bez internetu (jen test prostředí)

### Token tracker nezaznamenává spotřebu

- Ověř, že `ANTHROPIC_API_KEY` je správně nastaven (bez uvozovek, bez
  koncových mezer)
- Spusť CLI klasifikaci: `npm run classify -- "test"` — pokud to projde
  bez warning „offline mode", API key funguje
- Pokud `recordUsage failed` v logu → pravděpodobně DB migrace neproběhla;
  spusť `npm --workspace backend run prisma:deploy`

### Slack notifikace nechodí

- Ověř `SLACK_WEBHOOK_URL` kompletní URL (`https://hooks.slack.com/services/T…/B…/…`)
- **Admin → Test notifikace** tlačítko
- Zkontroluj, že webhook není zapauzovaný v Slack app settings

### Email notifikace nechodí

- Pokud nemáš `SMTP_HOST` nastaveno, emaily jsou **log-only stub**
  (uvidíš v logu místo ve schránce). To je by-design.
- Když SMTP je nastaveno, ale email nepřijde:
  - Zkontroluj `SMTP_FROM` — spousta providerů odmítá mail s
    neschválenou from adresou
  - Gmail: potřebuješ **App Password**, ne běžné heslo
  - Firemní SMTP: ověř, že je povolené relay z IP serveru
  - Podívej se do logu na `email send failed`

### Token expiry alert volá adminovi ale nic nefunguje

Meta Page Access Token platí ~60 dnů. Když se blíží expirace:

1. Admin → **Účty** → najdi stránku s červeným „za X dní"
2. **Odpojit** ji
3. **Připojit přes Meta** znovu (projdi OAuth flow)

Nový token je 60 dnů čerstvý. Neztratíš historii komentářů ani akcí —
jen se rotuje klíč.

### „Sandbox kills processes" / server padá

To se týká **jen** běhu v omezeném sandboxu (např. Claude Code CI). Na
reálném Linuxu serveru (systemd service dle `deploy/DEPLOYMENT.md`) se to
neděje. Pokud se to přesto stane:

- `sudo systemctl status albixon-moderator` — co říká systemd
- `sudo journalctl -u albixon-moderator --since "10 minutes ago"`
- Typické příčiny: OOM (2GB+ RAM je minimum), DB lock (přepnout na
  Postgres), disk full

### Databáze narostla / zpomaluje se

- `ls -lh prod.db` → velikost
- Pokud > 1 GB, spusť **Admin → Spustit retenci** (defaultně 730 dní)
- Anonymizuje staré komentáře, ponechá audit trail
- Pro dlouhodobé nasazení zvaž **VACUUM**:
  ```bash
  systemctl stop albixon-moderator
  sqlite3 prod.db "VACUUM;"
  systemctl start albixon-moderator
  ```

### CI workflow padá na GitHubu

Typicky:
- **prisma migrate deploy** chybí `DATABASE_URL` → zkontroluj `env:` sekci
  v `.github/workflows/ci.yml`
- **smoke-boot** timeout → server startuje pomaleji v CI, zvyš `sleep 3` na `sleep 5`
- **vitest** padá na `rate-limit` testech → jsou záměrně 3s/test kvůli
  exponential backoff, je to normální

---

## Obecná diagnostika

### Rychlá kontrola „funguje všechno?"

Na serveru:
```bash
curl -s http://localhost:3001/health && echo "✓ liveness"
curl -s http://localhost:3001/health/ready | jq .ok
sudo journalctl -u albixon-moderator -n 20 --no-pager
```

Přes Caddy:
```bash
curl -I https://moderator.albixon.cz
# Musíš vidět HTTP/2 200 a Strict-Transport-Security hlavičku
```

### Zálohy — jak ověřit, že se opravdu dělají

```bash
ls -lh /var/backups/moderator/ | tail -5
# Poslední záznam by měl být dnešní
```

Test restore:
```bash
cp /var/backups/moderator/prod-2026-04-20.db /tmp/test-restore.db
sqlite3 /tmp/test-restore.db "SELECT COUNT(*) FROM Comment"
```

Pokud vrátí číslo, záloha je v pořádku.

---

## Kam eskalovat, když toto selže

1. Zkontroluj **GitHub Issues** v repu — možná tvůj problém už někdo řešil
2. Projdi `CHANGELOG.md` — neprošla nějaká breaking změna?
3. Ozvi se autorovi nebo adminovi s:
   - Přesný čas problému
   - Chybová hláška (copy-paste)
   - Relevantní řádky z `journalctl` (ne celý log)
   - Co jsi zkusil/a
