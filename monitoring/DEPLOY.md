# FOCUS – produkční nasazení

Tento průvodce popisuje, jak nasadit FOCUS na vlastním serveru (on-prem)
v ČR / EU pro 10 – 1000 firemních PC. Pro instalaci agenta na klienty
viz `installer/deploy-gpo.md`.

---

## 1. Hardwarové požadavky

| Velikost firmy | RAM | CPU | Disk | Postgres |
|---|---|---|---|---|
| Pilot < 50 PC | 2 GB | 2 vCPU | 20 GB | SQLite stačí |
| 50 – 200 PC | 4 GB | 2 vCPU | 50 GB | PostgreSQL 15+ |
| 200 – 1000 PC | 8 GB | 4 vCPU | 200 GB | PostgreSQL 15+ |
| 1000+ PC | dedikovaný DB stroj, separate web | | | PostgreSQL na samostatném VM |

OS: Ubuntu 22.04 LTS nebo Debian 12 nebo RHEL/Rocky 9.

## 2. Bezpečnostní předpoklady (POVINNÉ)

- [ ] **HTTPS** s platným certifikátem (Let's Encrypt přes Caddy / nginx,
      nebo komerční CA). Agent odmítne `http://` URL kromě localhostu.
- [ ] **Firewall**: jediný otevřený port 443 (a 80 pro Let's Encrypt
      challenge). Postgres pouze na localhostu nebo na privátní podsíti.
- [ ] **Šifrování diskového svazku** (LUKS nebo cloud-native).
- [ ] **Automatické zálohy** (viz §6).
- [ ] **OS pravidelně patchovaný** (`unattended-upgrades`).
- [ ] **Žádné GUI / RDP / SSH s password** – jen klíče.

## 3. Konfigurace `.env`

Zkopíruj `monitoring/backend/.env.example` na `.env` a vyplň:

```bash
# Náhodný 32-byte token pro autentizaci agentů (POVINNÉ)
INGEST_TOKEN=$(openssl rand -hex 32)

# Náhodné heslo admina (≥ 10 znaků, ne "admin", "heslo", "password")
ADMIN_USER=focusadmin
ADMIN_PASSWORD=$(openssl rand -base64 24)

# Postgres URL (NE SQLite v produkci)
DATABASE_URL="postgresql://focus:$(openssl rand -base64 16)@127.0.0.1:5432/focus?schema=public"

# Produkční režim – server odmítne start s placeholder hodnotami
NODE_ENV=production

# Retence dat (dny). Po této době se smaže AUTOMATICKY.
RAW_RETENTION_DAYS=35
HOURLY_RETENTION_DAYS=540
AUDIT_RETENTION_DAYS=365

# Demo data ZAKÁZÁNO v produkci (default false).
ENABLE_DEMO_DATA=false
```

**Po prvním startu změň admin heslo** v UI / DB – generování z `.env`
probíhá jen, když je tabulka `AdminUser` prázdná.

## 4. Docker Compose (doporučeno)

```yaml
# docker-compose.production.yml (vzor)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: focus
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: focus
    volumes:
      - focus-db:/var/lib/postgresql/data
    restart: unless-stopped
    networks: [internal]

  backend:
    image: ghcr.io/[DOPLŇTE]/focus-backend:0.2.1
    env_file: .env
    ports:
      - "127.0.0.1:4000:4000"
    depends_on: [postgres]
    restart: unless-stopped
    networks: [internal]

  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on: [backend]
    restart: unless-stopped
    networks: [internal]

volumes:
  focus-db:
  caddy-data:
  caddy-config:

networks:
  internal:
```

```caddyfile
focus.firma.cz {
  reverse_proxy backend:4000
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }
}
```

Pro Postgres heslo:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
```

Start:

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
```

## 5. Bez Dockeru (systemd)

```ini
# /etc/systemd/system/focus-backend.service
[Unit]
Description=FOCUS backend
After=postgresql.service network.target
Requires=postgresql.service

[Service]
Type=simple
User=focus
Group=focus
WorkingDirectory=/opt/focus/backend
EnvironmentFile=/opt/focus/backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now focus-backend
journalctl -u focus-backend -f
```

## 6. Zálohy (POVINNÉ)

### Postgres

```bash
# /etc/cron.daily/focus-backup
#!/bin/bash
set -e
BACKUP_DIR=/var/backups/focus
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y-%m-%d)
docker compose -f /opt/focus/docker-compose.production.yml exec -T postgres \
  pg_dump -U focus focus | gzip > "$BACKUP_DIR/focus-$DATE.sql.gz"
# Retence: 30 dní lokálně, dlouhodobé do off-site
find "$BACKUP_DIR" -name 'focus-*.sql.gz' -mtime +30 -delete
# Off-site (např. Backblaze B2 v EU)
rclone copy "$BACKUP_DIR" b2:focus-backups/
```

```bash
chmod +x /etc/cron.daily/focus-backup
```

### Test obnovy (1× za 3 měsíce)

```bash
# Naimportuj zálohu do testovací DB a ověř, že počet záznamů sedí
docker compose exec postgres createdb -U focus focus_restore_test
zcat /var/backups/focus/focus-2026-05-26.sql.gz | docker compose exec -T postgres psql -U focus focus_restore_test
docker compose exec postgres psql -U focus focus_restore_test -c "SELECT COUNT(*) FROM \"MonitoredUser\";"
docker compose exec postgres dropdb -U focus focus_restore_test
```

## 7. Monitorování provozu

- Logy: `journalctl -u focus-backend` nebo `docker logs focus-backend`
- Healthcheck: `GET https://focus.firma.cz/api/v1/health` → `{"status":"ok"}`
- Doporučené metriky (vyžaduje Prometheus, viz roadmap):
  - response time `/api/v1/ingest`
  - active devices (= POST za poslední hodinu)
  - DB connection pool utilization
- Uptime monitor (Uptime Kuma, Statuscake) na `/api/v1/health`.

## 8. Aktualizace

```bash
# Stáhni novou verzi
cd /opt/focus
git pull

# Backup PŘED aktualizací
/etc/cron.daily/focus-backup

# Pull image + migrate + restart
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.production.yml up -d backend
```

Pokud migrace selže, **NEMAŽEME data** – restore ze zálohy a kontakt
podpora (viz `07-incident-response.md`).

## 9. Rollback

```bash
# Vrať předchozí verzi (předpokládá tagged image)
docker compose -f docker-compose.production.yml down
docker pull ghcr.io/[…]/focus-backend:0.2.0
docker compose -f docker-compose.production.yml up -d
# Pokud byla migrace, ale rollback potřebuje stará data:
zcat /var/backups/focus/focus-PRE-UPGRADE.sql.gz | \
  docker compose exec -T postgres psql -U focus focus
```

## 10. Checklist před produkčním startem

- [ ] `.env` má **náhodné** `INGEST_TOKEN` a `ADMIN_PASSWORD`
- [ ] `NODE_ENV=production`, `ENABLE_DEMO_DATA=false`
- [ ] PostgreSQL je v privátní síti / na localhostu
- [ ] HTTPS s platným certifikátem
- [ ] HSTS header v reverse proxy
- [ ] Firewall: 443 (a 80 pro ACME) + nic dalšího
- [ ] Šifrovaný diskový svazek
- [ ] Cron backup nastavený a otestovaný
- [ ] DPO / právník schválil **DPA, Privacy Policy, Poučení §316**
  (viz `docs/pravni/`)
- [ ] Zaměstnanci jsou písemně poučeni dle § 316 ZP
- [ ] Admin účet vytvořen, defaultní heslo změněno
- [ ] Healthcheck monitor běží
- [ ] Test obnovy zálohy proběhl úspěšně
- [ ] Incident response plán je vyplněn a vytištěn (mimo IT systém)
