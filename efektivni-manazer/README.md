# Efektivní manažer

Lokální webová aplikace pro **automatický tracking úkolů z emailu**. Připojí se
k Tvému Outlook / IMAP účtu, pomocí Claude API analyzuje vlákna a rozdělí je na:

- **Delegované úkoly** (já → někdo) – sleduje, jestli druhá strana potvrdila
  přijetí, dala termín, dodržela ho.
- **Moje úkoly** (někdo → já) – detekuje, když jsem jediný adresát nebo zmíněn
  v textu (`@jméno`, oslovení), a vyžaduje moji odpověď.

SLA engine podle pravidel generuje notifikace v dashboardu („pingnout",
„vyžádat termín", „po termínu" atd.). „Pingnutí" se generuje jako **draft**,
který si zkontroluješ a odešleš ručně.

## Stack

| Vrstva | Technologie |
|---|---|
| Backend API | Python 3.12, FastAPI, SQLAlchemy |
| Worker | APScheduler (sync mailu + SLA tick) |
| Mail | IMAP (primární) + Microsoft Graph (stub, čeká na admin consent) |
| LLM | Claude Sonnet 4.6 (extrakce) + Opus 4.7 (drafty na vyžádání) |
| DB | PostgreSQL 16 |
| Frontend | Next.js 15, Tailwind, shadcn-style komponenty |
| Auth | Lokální heslo (Argon2id), session cookie |
| Deploy | Docker Compose, jeden příkaz |

## Porty

- Web UI: **http://localhost:8090**
- API:    **http://localhost:8091**
- Postgres: jen v interní docker síti

## Rychlý start

```bash
cd efektivni-manazer
cp .env.example .env
# vyplň ANTHROPIC_API_KEY, EFEKTIVNI_MASTER_PASSWORD, EFEKTIVNI_ENCRYPTION_KEY
docker compose up -d --build
# otevři http://localhost:8090
```

Při prvním přihlášení nastavíš IMAP credentials přes UI (`Nastavení`).

## Co je hotové (v0 skeleton)

- [x] Docker Compose: api, worker, web, postgres
- [x] DB schéma + migrace (threads, messages, tasks, rules, notifications)
- [x] FastAPI: routery `/auth`, `/tasks`, `/threads`, `/rules`, `/notifications`, `/settings`
- [x] Mail provider abstrakce, IMAP implementace, Graph stub
- [x] LLM extraktor (Claude Sonnet 4.6) s JSON schématem výstupu
- [x] SLA rule engine s defaultní sadou pravidel
- [x] Web: login, dashboard, detail úkolu, nastavení, pravidla
- [x] Šifrování IMAP credentials v DB (Fernet)

## Co přidat dál (v1+)

- [ ] Microsoft Graph OAuth flow (čeká na admin consent v tenantu)
- [ ] Generování draftu odpovědi pomocí Opus 4.7 (UI placeholder hotový)
- [ ] Denní email digest
- [ ] Web push notifikace
- [ ] Statistiky per protějšek (kdo dluží, průměrná doba odpovědi)
- [ ] Exclusion listy v UI (newslettery, automaty)

## Struktura

```
efektivni-manazer/
├── docker-compose.yml
├── .env.example
├── api/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/                  # migrace DB
│   ├── prompts/                  # verzované LLM prompty
│   └── app/
│       ├── main.py               # FastAPI app
│       ├── config.py             # nastavení z env
│       ├── db.py                 # SQLAlchemy session
│       ├── models.py             # ORM modely
│       ├── schemas.py            # Pydantic
│       ├── auth.py               # login / session
│       ├── routers/              # HTTP routery
│       ├── services/
│       │   ├── mail/             # IMAP + Graph
│       │   ├── llm.py            # Claude extraktor
│       │   ├── classifier.py     # orchestrace mail→úkoly
│       │   ├── sla.py            # SLA rule engine
│       │   └── crypto.py         # Fernet šifrování credentials
│       └── workers/run.py        # APScheduler entrypoint
└── web/
    ├── Dockerfile
    ├── package.json
    └── app/                      # Next.js App Router
        ├── page.tsx              # dashboard
        ├── tasks/[id]/page.tsx   # detail úkolu
        ├── rules/page.tsx        # editor SLA pravidel
        ├── settings/page.tsx     # IMAP credentials, prac. doba
        └── login/page.tsx
```

## Bezpečnost

- IMAP credentials jsou šifrované Fernet klíčem v `.env` (`EFEKTIVNI_ENCRYPTION_KEY`)
- UI je chráněno master heslem (Argon2id hash v DB)
- Postgres není exponovaný mimo docker síť
- Web UI a API doporučeno bindovat na `127.0.0.1` (default v compose)
- Žádná telemetrie kromě volání Anthropic API
