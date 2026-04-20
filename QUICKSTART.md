# Rychlý start — macOS

**Cíl:** do 5 minut mít běžící dashboard s demo daty v prohlížeči.

## Předpoklady (jednou)

```bash
# Pokud ještě nemáš Node.js
brew install node@20 git
```

## První spuštění

```bash
git clone <repo-url> && cd Claude-code
npm run demo
```

Script:

1. Vytvoří `.env` a vygeneruje šifrovací klíč
2. Nainstaluje závislosti (~30 s)
3. Migruje SQLite DB
4. Nasadí demo data (3 účty, 9 klasifikovaných komentářů)
5. Zbilduje backend + frontend
6. Spustí server na `http://localhost:3001`

Otevři v prohlížeči:

- **URL:** http://localhost:3001
- **Uživatel:** `admin`
- **Heslo:** `demo`

Uvidíš frontu se spamy, vulgarismy, brand attack a oprávněnou kritikou — přesně
jak je na screenshotech v `docs/SCREENSHOTS.md`.

## Co to umí i bez Anthropic klíče?

Vše, co vidíš na screenshotech, **funguje v offline demo režimu** bez jakéhokoli
placeného API:

- ✅ Procházet komentáře, filtrovat, hledat
- ✅ Skrýt / Smazat / Ponechat (jen localně — Meta akce vyžadují OAuth)
- ✅ Detail drawer s historií klasifikací
- ✅ Klávesové zkratky (`?` zobrazí nápovědu)
- ✅ Statistiky, audit log, evidence snapshoty
- ✅ Reclassify tlačítko (použije česku keyword heuristiku)
- ✅ Navrhnout odpověď (vrátí stock českou zprávu)

## Kdy potřebuješ Anthropic API klíč?

Jen pokud chceš, aby **nové komentáře** klasifikovala skutečná Claude (s nuancí,
detekcí konkurence, atd.) místo keyword heuristiky. Zhruba 5 USD kreditu
v [console.anthropic.com](https://console.anthropic.com) stačí na tisíce
klasifikací (haiku-4-5 je levný).

Potom:

```bash
# Otevři .env v editoru a nahraď prázdný řádek
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Restart serveru a hotovo.

## Kdy potřebuješ Meta App?

Jen pokud chceš **stahovat skutečné komentáře z reálných FB/IG stránek**. Demo
data fungují bez toho. Pro reálný provoz:

1. developers.facebook.com → Create App → typ Business
2. Redirect URI: `http://localhost:3001/auth/callback`
3. Scopes: viz README.md sekce „Nastavení Meta aplikace"
4. Doplň `META_APP_ID` a `META_APP_SECRET` do `.env`
5. V dashboardu → Účty → **Připojit přes Meta**

## Sanity check

```bash
npm run doctor
```

Vypíše seznam kontrol (Node verze, závislosti, `.env`, DB, API klíče) a poradí
co doplnit.

## Další spuštění (už bez setupu)

```bash
npm start             # backend + vestavěný frontend
# nebo dev režim s hot-reloadem:
npm run dev           # backend na 3001, Vite dev server na 5173
```

## Časté problémy

### `EADDRINUSE: port 3001 already in use`

```bash
lsof -i :3001          # najdi PID
kill <PID>
```

### „Uživatel nenalezen" v prohlížeči po kliknutí na Meta OAuth

Normální — v demo režimu bez `META_APP_ID` OAuth flow neprojde. Přidej skutečné
Meta credentials do `.env`.

### Statistiky nezobrazují graf

Pokud nemáš žádné komentáře ze „posledních 7 dní", graf je prázdný. Spusť
`npx --prefix backend tsx scripts/seed-demo.ts` pro demo data.

### Testy neprochází

```bash
TOKEN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  npx --prefix backend vitest --dir backend/src run
```

## Co dál

- Úpravy klasifikátoru: `backend/src/classifier/prompt.ts`
- Úpravy pravidel auto-moderace: dashboard → Pravidla
- Úpravy šablon odpovědí: dashboard → Šablony
- Plná dokumentace: [`README.md`](README.md)
- Obrázky UI: [`docs/SCREENSHOTS.md`](docs/SCREENSHOTS.md)
