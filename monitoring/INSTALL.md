# Instalace a nasazení

Tři režimy nasazení podle situace:

| Režim | Komu | Co potřebuješ |
|---|---|---|
| **A) Lokální vývoj** | Vývojář | Node.js 20+ |
| **B) Lokální demo (jeden kontejner)** | Prezentace zákazníkovi | Docker |
| **C) On-premise produkce (PostgreSQL)** | IT zákazníka | Docker Compose + DNS + TLS |

Vlastní agent (Windows MSI) se nasazuje samostatně přes Active Directory / GPO — viz [`installer/README.md`](installer/README.md).

---

## A) Lokální vývoj — jedním příkazem

```bash
./dev.sh
# Otevři http://localhost:8080
# Přihlášení: admin / admin
```

Co `dev.sh` udělá:
1. `npm install` v `backend/` a `frontend/` (pokud chybí).
2. Aplikuje Prisma migrace (SQLite v `backend/dev.db`).
3. Spustí `npm run seed` — vygeneruje **demo** uživatele, zařízení a aktivitu (~100 lidí, 30 dní zpět).
4. Sestaví frontend a spustí backend (slouží i statický web).

Volitelně:
```bash
PORT=3000 ./dev.sh                        # jiný port
ADMIN_USER=ja ADMIN_PASSWORD=tajne ./dev.sh
```

Pro **vývoj frontendu s hot-reload** (Vite dev server proti běžícímu backendu):
```bash
# Terminál 1
cd backend && npm run dev
# Terminál 2
cd frontend && npm run dev   # http://localhost:5173
```

---

## B) Demo v jednom kontejneru

```bash
docker compose -f docker-compose.demo.yml up --build
# Otevři http://localhost:8080  (admin/admin)
```

Vše (backend + frontend build + SQLite + seed) v jednom obraze postaveném
z [`Dockerfile.demo`](Dockerfile.demo). Hodí se na rychlé předvedení.

---

## C) On-premise produkce (PostgreSQL)

### 1. Příprava

```bash
cp .env.example backend/.env   # uprav podle níže uvedeného
```

Důležité proměnné (`backend/.env`):

| Proměnná | Význam | Příklad |
|---|---|---|
| `DATABASE_URL` | připojení k DB | `postgresql://focus:HESLO@db:5432/focus` |
| `INGEST_TOKEN` | sdílený token agentů (`Authorization: Bearer ...`) | **změň**, min. 32 znaků |
| `ADMIN_USER` / `ADMIN_PASSWORD` | první admin do dashboardu | `admin` / **silné** |
| `SESSION_SECRET` | tajemství pro session tokeny | **změň**, min. 32 znaků |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | volitelné, pro reporty + upozornění | dle vašeho SMTP |
| `REPORT_RECIPIENTS` | komu chodí denní/týdenní report | čárkou oddělené e-maily |
| `REPORT_CRON` | kdy posílat report | `0 7 * * 1-5` (po–pá v 7:00) |

Backend odmítne nastartovat v `NODE_ENV=production`, pokud najde slabá tajemství
(`admin`, `dev-token` apod.).

### 2. Spuštění

```bash
docker compose -f docker-compose.yml up -d --build
# Backend běží na portu z proměnné PORT (default 4000), frontend mu předřaď reverzní proxy s TLS.
```

Schéma databáze se aplikuje **automaticky** při startu (Prisma migrate / db push,
viz `backend/docker-entrypoint.sh`).

### 3. Reverzní proxy (Caddy / nginx / Traefik)

Před backend dej proxy s HTTPS certifikátem. Příklad pro Caddy:

```caddyfile
focus.firma.cz {
  reverse_proxy localhost:4000
}
```

### 4. První přihlášení

- Otevři `https://focus.firma.cz/`, přihlas se hodnotami z `ADMIN_USER` / `ADMIN_PASSWORD`.
- Změň heslo (v Nastavení → Účty — TODO; zatím přes env při startu).
- V **Správě → Sledovaní uživatelé** přiřaď oddělení.
- V **Nastavení → klasifikace → Pravidla podle oddělení** přidej výjimky (např. LinkedIn = práce pro HR).

---

## Nasazení Windows agenta (na klientské PC)

Detail v [`installer/README.md`](installer/README.md). Stručně:

1. **Build MSI** — automaticky přes GitHub Actions workflow „Agent (Windows build)",
   stáhnete artefakt `FocusAgent.msi`. Lokálně viz [`agent/README.md`](agent/README.md).
2. **GPO rollout** — viz [`installer/deploy-gpo.md`](installer/deploy-gpo.md).
3. **Test na 1 PC** — viz [`TEST-NA-JEDNOM-PC.md`](TEST-NA-JEDNOM-PC.md).

MSI očekává parametry `BACKENDURL` a `INGESTTOKEN` (musí sedět s `.env` na serveru).

---

## Kontrola po nasazení

- [ ] Backend běží: `curl https://focus.firma.cz/api/v1/health` → `{"ok":true}`.
- [ ] Dashboard otevřu a vidím přehled.
- [ ] Po nainstalování agenta na 1 testovací PC se do ~5 min objeví v dashboardu zařízení.
- [ ] Aktivita uživatele se objeví po ~10 minutách práce.
- [ ] V **Nastavení → Soukromí** zkontrolujte retenci a režim domain-only.
- [ ] **Před plošným nasazením**: zaměstnance informujte (viz [`docs/pravni/01-informace-zamestnancum.md`](docs/pravni/01-informace-zamestnancum.md)), uzavřete DPIA ([`docs/pravni/02-dpia-podklad.md`](docs/pravni/02-dpia-podklad.md)) a v případě potřeby s odbory/Betriebsratem.

## Řešení potíží

- **Agent se neobjeví v dashboardu:** zkontrolujte `BACKENDURL` (musí být dostupné z PC) a `INGESTTOKEN` (musí přesně sedět). Log: `%ProgramData%\WorkView\agent.log` (interní složka).
- **Antivirus blokuje agenta:** podepište MSI code-signing certifikátem (EV preferováno) a přidejte výjimku. Globální hooky klávesnice/myši bývají heuristicky hlídány.
- **PostgreSQL „connection refused":** zkontrolujte `DATABASE_URL` a že kontejner `db` běží (`docker compose ps`).
- **Backend hlásí slabé tajemství:** v produkci nastavte všechny tajemství dle `.env.example`.
