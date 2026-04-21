# Nasazení pro MKT tým

Tento návod popisuje, jak postavit produkční instanci pro **5–10 členů
marketingového týmu**. Cílová doba: **cca 45 minut** první setup, **5 minut** pro
přidání dalšího operátora.

## Co dostaneš

- TLS (HTTPS) s automatickým Let's Encrypt certifikátem
- Přihlášení vlastním username + heslem pro každého člena týmu
- Každá akce v audit logu přesně k uživateli (ne k "admin")
- IP allowlist — přístup jen z firemní sítě / VPN
- Rate-limit proti brute-force

---

## 1. Server

Doporučení: Linux VPS (Ubuntu 22.04 LTS nebo Debian 12), 1 vCPU + 2 GB RAM
stačí pro MKT tým. Potřebuješ `root` / `sudo`.

```bash
# Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs git caddy

# Nezapomeň otevřít porty
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # Let's Encrypt challenge
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
```

## 2. Aplikace

```bash
# Umísti kam máš standard (/opt, /srv, /home/deploy…)
sudo mkdir -p /opt/albixon-moderator
sudo chown $USER /opt/albixon-moderator
cd /opt/albixon-moderator
git clone <tvuj-repo-url> .
git checkout claude/meta-comment-moderator-IXbw7   # nebo main po mergi

npm install
npm --workspace backend run prisma:generate
npm --workspace backend run prisma:deploy
npm --workspace backend run seed
npm --workspace backend run build
npm --workspace frontend run build
```

## 3. `.env` pro produkci

Zkopíruj šablonu a vyplň:

```bash
cp .env.example .env
nano .env
```

**Minimální produkční `.env`:**

```bash
NODE_ENV=production
PORT=3001

# 64hex šifrovací klíč (jednou, BACKUP ho — bez něj nepřečteš Meta tokeny)
TOKEN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Multi-user login. Každý člen týmu má svůj řádek.
# Hesla generuj např. přes `openssl rand -base64 24`.
DASHBOARD_USERS=honza:<silné-heslo-1>,petra:<silné-heslo-2>,karel:<silné-heslo-3>

# DB + session
DATABASE_URL=file:/opt/albixon-moderator/prod.db
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Meta
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
META_REDIRECT_URI=https://moderator.albixon.cz/auth/callback

# Síťové restrikce (firemní VPN rozsah)
ALLOWED_IPS=10.0.0.0/8,192.168.1.0/24
CORS_EXTRA_ORIGIN=https://moderator.albixon.cz
TRUST_PROXY=loopback

# Notifikace (volitelné ale doporučené)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

**Důležité:** v produkci aplikace **odmítne nabootovat** se slabým heslem
(méně než 12 znaků, v blacklistu, stejné jako username).

## 4. systemd služba

```bash
sudo tee /etc/systemd/system/albixon-moderator.service > /dev/null <<'EOF'
[Unit]
Description=ALBIXON Moderator komentářů
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/albixon-moderator
EnvironmentFile=/opt/albixon-moderator/.env
ExecStart=/usr/bin/node backend/dist/index.js
Restart=on-failure
RestartSec=5s

# Security hardening (systemd)
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/albixon-moderator
PrivateTmp=true
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now albixon-moderator
sudo systemctl status albixon-moderator
```

Sleduj log:
```bash
sudo journalctl -u albixon-moderator -f
```

## 5. Caddy (TLS + reverse proxy)

```bash
sudo cp /opt/albixon-moderator/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # nahraď moderator.albixon.cz skutečnou doménou + email
sudo systemctl reload caddy
```

Caddy si sám vyžádá cert z Let's Encrypt během prvních sekund po reloadu.

## 6. Backup

SQLite + evidence snapshoty jsou **právní důkazy**. Zálohuj denně:

```bash
sudo tee /etc/cron.daily/moderator-backup > /dev/null <<'EOF'
#!/bin/bash
set -e
TS=$(date +%F)
DEST=/var/backups/moderator
mkdir -p "$DEST"

# SQLite online backup (safe while running thanks to WAL mode)
sqlite3 /opt/albixon-moderator/prod.db ".backup '$DEST/prod-$TS.db'"

# Retain 30 days
find "$DEST" -name "prod-*.db" -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/moderator-backup
```

**Druhý off-site backup** (doporučeno) přes rsync / rclone do S3/Glacier.

## 7. Ověření

```bash
# Z PC uvnitř VPN:
curl -u honza:<heslo> https://moderator.albixon.cz/health/ready
```

Otevři `https://moderator.albixon.cz/` v prohlížeči → přihlášovací dialog →
dashboard.

## 8. První propojení s Meta

1. V aplikaci **Admin → Kontrola připravenosti** musí být ✅ u `anthropicKey` a `metaAppConfig`.
2. **Účty → Připojit přes Meta** → projede OAuth → vybere všechny stránky, ke kterým má admin přístup.
3. **Admin → Odpovědi: VYPNUTÉ** (ponech vypnuté; zapneš až budete nastavení).
4. **Admin → Kritická klíčová slova** — nastav co má okamžitě alertovat (např. `podvod, žaloba, vrácení peněz, soud`).
5. **Tokeny → Hranice v USD** — nastav budget alert (doporučeno $5–10 první měsíc).

## 9. Onboarding dalšího operátora

Přidání:
```bash
# Na serveru
sudo nano /opt/albixon-moderator/.env
# Do DASHBOARD_USERS přidej ",jmeno:<silné-heslo>"
sudo systemctl restart albixon-moderator
```

Odebrání (zaměstnanec odchází):
```bash
# Vymaž z DASHBOARD_USERS a restartuj
sudo systemctl restart albixon-moderator
# (Audit log jeho historických akcí zůstává pod jeho username.)
```

## 10. Monitoring

Kontroluj:

```bash
curl -s -u honza:<heslo> https://moderator.albixon.cz/health/ready | jq
curl -s https://moderator.albixon.cz/metrics | grep albixon_   # Prometheus
sudo journalctl -u albixon-moderator --since today | jq        # JSON logs
```

Nastav alert v tvém monitoringu na:
- `albixon_queue_pending > 50` (backlog)
- `albixon_last_action_age_seconds > 3600` (dashboard se nepoužívá > 1 hodina)
- HTTP 5xx response rate

---

## Bezpečnostní checklist před spuštěním pro tým

- [ ] `NODE_ENV=production` je v `.env`
- [ ] Každý člen MKT má unikátní silné heslo (≥16 znaků)
- [ ] `ALLOWED_IPS` pokrývá jen firemní VPN/office rozsahy
- [ ] TLS certifikát funguje (`curl -I https://moderator.albixon.cz`)
- [ ] `TOKEN_ENCRYPTION_KEY` máš zálohovaný mimo server
- [ ] Denní backup testován (obnovení z `prod-YYYY-MM-DD.db` funguje)
- [ ] `reply_enabled` je defaultně **VYPNUTÉ** (Admin → Odpovědi)
- [ ] Kritická klíčová slova nastavena
- [ ] Threshold pro token alert nastavený
- [ ] `Slack webhook` dostává test notifikaci (Admin → Test notifikace)
- [ ] 1-2 operátoři proškoleni, zbytek týmu v read-only režimu (zatím)

## Známé zbývající limity

- Per-user role (junior vs. admin) — každý přihlášený může vše. Řešení v Fázi 4.
- Session expirace — basic auth je v prohlížeči cached navždy. Doporučení:
  zavřít prohlížeč na konci směny, sdílené PC neexistuje.
- SMTP notifikace — jen Slack je reálný, email stub. Pokud někdo nepoužívá
  Slack, nakonfiguruj nodemailer transport v `services/notify.ts`.
- Meta App Review — production Graph scopes vyžadují Meta schválení.
  Pro dev/staging použij role "Tester" v Meta App Dashboard.
