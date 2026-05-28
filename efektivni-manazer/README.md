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

## Připojení na O365 přes davmail (doporučeno)

Pokud Ti admin **nezpřístupnil IMAP** na O365 tenantu (typický korporátní stav),
součástí compose je gateway **davmail**, která se chová jako lokální IMAP server
a vůči O365 mluví přes EWS / Graph s Tvojí vlastní OAuth identitou. Žádný admin
consent, žádné App Password.

### První přihlášení (jednou)

V režimu `O365Manual` davmail nečeká OAuth callback na URL – místo toho
vypíše URL a chce, abys mu vrátil kód, který Microsoft přidá do redirect URL.

1. Pusť **jen davmail** v interaktivním režimu (přes `run`, ne `up -d`),
   abys měl k dispozici stdin:
   ```bash
   docker compose run --rm --service-ports davmail
   ```
2. Spusť pokus o IMAP login (z druhého terminálu), aby davmail začal OAuth flow:
   ```bash
   openssl s_client -starttls imap -connect localhost:1143 -crlf <<< "a login tvuj.email@firma.cz any"
   ```
   nebo prostě v Efektivním manažerovi v UI nastav IMAP a klikni „Uložit".
3. V terminálu kde běží davmail uvidíš:
   ```
   Open the following URL in a browser:
   https://login.microsoftonline.com/.../oauth2/v2.0/authorize?...
   Then paste the resulting URL or code:
   ```
4. URL otevři v prohlížeči, přihlas se firemním účtem. Microsoft Tě
   přesměruje na `http://localhost/?code=...` – stránka se nenačte, ale
   **celý URL** z adresního řádku zkopíruj a vlož zpátky do terminálu
   s davmailem. Enter.
5. davmail uloží refresh token do volume `efektivni-davmail`.
6. Ukonči interaktivní davmail (Ctrl+C) a startni už klasicky:
   ```bash
   docker compose up -d
   ```
   Další starty už OAuth nechtějí – token se obnovuje automaticky.

> **Tip pro pohodlnější setup:** alternativa je nainstalovat davmail
> přímo na hostitelský systém (`brew install davmail` na macOS,
> `apt install davmail` na Debian/Ubuntu) a pustit ho v GUI módu –
> OAuth popup pak proběhne v prohlížeči automaticky bez ručního pastu.
> V `Nastavení` pak místo `davmail:1143` zadáš `host.docker.internal:1143`.

### V `Nastavení → IMAP připojení` zadej:

| Pole | Hodnota |
|---|---|
| Host | `davmail` |
| Port | `1143` |
| SSL | **vypnout** |
| Username | tvuj.email@firma.cz |
| Heslo | cokoliv (davmail to ignoruje, autorizuje se OAuth tokenem) |
| Inbox folder | `INBOX` |
| Sent folder | `Sent` *(nebo `Odeslané` podle jazyka Outlooku)* |

### Caveat

Microsoft postupně vypíná EWS API (původně 1. 10. 2026, posunuto na 2027).
davmail už podporuje Graph backend – přechod bude jen otázka konfigurace.

## Připojení přes přímý IMAP (pokud admin povolil)

Pokud máš povolený IMAP přímo na O365 tenantu (otestuješ např. App Password +
přihlášení v Thunderbirdu), nepotřebuješ davmail. V `Nastavení → IMAP připojení`
zadej `outlook.office365.com:993` se SSL on. davmail kontejner můžeš nechat
zastavený (`docker compose stop davmail`).

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
