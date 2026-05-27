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

## 5b. Velikost dat a HDD plánování

Velikost DB závisí hlavně na počtu uživatelů a retenci. Spočítané odhady
po optimalizacích (windowTitle truncate, denní VACUUM, default retention):

| Počet zaměstnanců | Raw retention | Velikost / měsíc | Velikost / rok |
|---|---|---|---|
| 100 | 30 dnů | ~150 MB | ~2 GB |
| 500 | 30 dnů | ~750 MB | ~10 GB |
| 1000 | 30 dnů | ~1.5 GB | ~20 GB |
| 1000 | 14 dnů | ~700 MB | ~9 GB |
| 1000 | 7 dnů | ~350 MB | ~4 GB |
| 2000 | 14 dnů | ~1.4 GB | ~17 GB |

Klíčové parametry pro úspory:

1. **`RAW_RETENTION_DAYS`** (env, default 30) – kolik dnů držet raw intervaly.
   Po smazání zůstávají DailyStat agregáty (skóre, work/idle min) 540 dnů.
2. **windowTitle truncate** – server-side ořezává na 120 znaků (úspora ~30 %).
3. **VACUUM po pruningu** – SQLite uvolní místo zpět OS (PG má autovacuum).
4. **`HOURLY_RETENTION_DAYS`** (default 540) – agregáty starší než ~18 měs.

### Pro firmy nad 1000 uživatelů: PostgreSQL nutný

SQLite je single-file a má praktický limit ~50-100 GB při zachování výkonu.
Nad 500 zaměstnanců přejít na PostgreSQL:

- Automatická TOAST komprese pro velké text. sloupce (compress titulů ~4×)
- Paralelní queries, lepší index strategy (BRIN index na intervalStart)
- `autovacuum` nemá problém s 100M řádků
- Volume na vyhrazeném disku SSD (15-30 ms latence na 95 % queries)

### Verifikace velikosti DB

```bash
# SQLite (demo container):
docker compose -f docker-compose.demo.yml exec demo \
  sh -c 'ls -lh /data/demo.db'

# PostgreSQL (production):
docker compose exec db \
  psql -U focus -c "SELECT pg_size_pretty(pg_database_size('focus'));"
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

### Healthcheck
- `GET https://focus.firma.cz/api/v1/health` → `{"status":"ok"}`
- Uptime monitor (Uptime Kuma, Statuscake) na tento endpoint.

### Prometheus metriky
Backend vystavuje metriky v Prometheus text formátu na `/api/v1/metrics`
(public, bez auth – obsahuje jen agregáty, ne osobní data).

```yaml
# /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'focus'
    metrics_path: '/api/v1/metrics'
    scrape_interval: 30s
    static_configs:
      - targets: ['focus.firma.cz:443']
    scheme: https
```

Dostupné metriky:
- `focus_http_requests_total` – count všech HTTP requestů (counter)
- `focus_http_errors_total` – HTTP responses ≥ 400 (counter)
- `focus_ingest_success_total` / `focus_ingest_rejected_total` – ingest stats
- `focus_login_success_total` / `focus_login_failed_total` – brute-force detekce
- `focus_access_audit_events_total` – počet auditních zápisů
- `focus_devices_active` – zařízení s ingest v posledních 60 min (gauge)
- `focus_users_total` – počet aktivních monitorovaných uživatelů (gauge)
- `focus_http_response_time_ms` – histogram latence

### Doporučené alerty (Grafana Alerting / Prometheus)
| Alert | Podmínka | Severita |
|---|---|---|
| Backend down | `up == 0` 2 min | critical |
| Žádný ingest | `rate(focus_ingest_success_total[10m]) == 0` 30 min v pracovní době | warning |
| Brute force | `rate(focus_login_failed_total[5m]) > 5/min` | critical |
| Vysoké chybovosti | `rate(focus_http_errors_total[5m]) / rate(focus_http_requests_total[5m]) > 0.05` | warning |
| Málo zařízení online | `focus_devices_active < očekávaný_počet * 0.5` v pracovní době | warning |

### Logy
- Docker: `docker compose logs -f backend`
- Systemd: `journalctl -u focus-backend -f`
- Doporučená rotace: `/etc/logrotate.d/focus` (Docker rotuje sám podle `--log-opt max-size`).

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
