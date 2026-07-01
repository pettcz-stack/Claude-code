# Realitní cenová mapa

Denně stahuje realitní inzeráty (zatím **Sreality**, připraveno i pro
Reality.idnes), ukládá je do databáze včetně **historie cen**, a tvoří
**cenovou mapu** — kde a za kolik za m² se inzerují jednotlivé typy
nemovitostí. Sleduje zlevňování a dobu na trhu a odhaduje „prodáno" podle
zmizení inzerátu.

> ⚠️ **Nabídkové ≠ prodejní ceny.** Tahle aplikace pracuje s **inzerovanými**
> (nabídkovými) cenami. To, co vidíš na mapě, je za kolik se _chce prodat_, ne
> za kolik se _reálně prodalo_. V ČR se běžně prodává pod inzercí. Skutečné
> realizované ceny eviduje jen **Katastr nemovitostí (ČÚZK)** — jeho napojení
> je v roadmapě (viz níže). „Odhad prodeje" v této verzi = poslední nabídková
> cena v okamžiku, kdy inzerát zmizel.

## Co umí (MVP)

- **Collector** pro Sreality přes jejich veřejné JSON API (byty/domy/pozemky,
  prodej i pronájem), šetrně s prodlevou mezi requesty.
- **Ingest pipeline** — normalizace (dispozice, plocha, typ, cena/m²),
  upsert podle stabilního ID, **historie cen** (každá změna = nový záznam).
- **Detekce „zmizel"** — inzerát nespatřený N dní → `removed` + uložení
  poslední ceny a doby na trhu (odhad prodeje/stažení).
- **Cenová mapa** — REST API + jednoduchý frontend (Leaflet): medián a průměr
  Kč/m² podle města, barevné body podle ceny, velikost podle počtu inzerátů.
- **Přehled** — počty aktivních/odebraných, rozpad podle typu, posledních pár běhů.

## Architektura

```
collectors/  →  ingest/  →  SQLite (Prisma)  →  analytics/  →  api/  →  public/ (mapa)
 sreality        normalize    Listing             priceMap       REST     Leaflet
 idnes (stub)    dedup        PriceHistory         stats
                 status       CollectRun
```

Čistá logika (`src/core/`) je oddělená od DB i sítě, takže je testovatelná
samostatně (`npm test`).

## Rychlý start

```bash
npm install
cp .env.example .env          # výchozí hodnoty stačí pro lokální běh (SQLite)
npm run prisma:generate
npm run prisma:migrate        # vytvoří prisma/dev.db

# A) demo bez scrapingu — naseeduj ukázková data:
npm run ingest:fixture

# B) nebo reálný sběr ze Sreality:
npm run collect               # přidej --dry-run pro běh bez zápisu

# server + mapa:
npm run dev                   # http://localhost:3000
```

### Testy

```bash
npm test        # jednotkové testy normalizace a statistik (bez sítě a DB)
```

## API

| Metoda | Cesta | Popis |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/stats/overview` | Počty, rozpad podle typu, poslední běhy |
| GET | `/api/price-map?dealType=&propertyType=` | Body mapy s mediánem Kč/m² podle města |
| GET | `/api/sold-estimates?limit=` | Zmizelé inzeráty = odhady prodeje + doba na trhu |
| GET | `/api/listings?status=&dealType=&propertyType=&city=&limit=` | Seznam inzerátů |
| GET | `/api/listings/:id` | Detail inzerátu + historie cen |

## Denní spuštění (cron)

```cron
# každý den ve 4:00
0 4 * * * cd /cesta/k/app && /usr/bin/npm run collect >> /var/log/reality.log 2>&1
```

## Právní upozornění

- **ToS portálů.** Sreality i Reality.idnes scraping ve svých podmínkách
  typicky omezují. Sreality JSON API je veřejné (pohání jejich web), ale není
  oficiálně určené pro hromadný odběr. Používej **šetrně** (nízká frekvence,
  rozumný `User-Agent`, respekt k zátěži). Pro bezrizikový komerční provoz zvaž
  placené datové API. Toto není právní rada.
- **GDPR.** Inzeráty obsahují kontakty makléřů (osobní údaje). Neukládej víc,
  než potřebuješ, a měj právní základ.

## Roadmapa

- **Reality.idnes collector** — HTML scraping (cheerio); rozhraní `RawListing`
  je připravené, stačí dodat `collectIdnes()`.
- **Katastr nemovitostí (ČÚZK)** — import realizovaných cen pro kalibraci
  „nabídková → prodejní". Tohle je pro developing klíčové.
- **PostgreSQL + PostGIS** — geo-dotazy, hexbin/heatmapy, agregace po PSČ/MČ
  místo po názvu města. (Změň `provider` v `prisma/schema.prisma` a `DATABASE_URL`.)
- **Geokódování** — doplnění GPS u inzerátů bez souřadnic (např. Nominatim).
- **Cross-portal deduplikace** — `dedupKey` už existuje; nasadit slučování
  stejné nemovitosti z víc portálů, ať statistika nenadhodnocuje objem.
- **Časové řady trhu** — vývoj mediánu Kč/m² v čase, index zlevňování.

## Licence

Soukromý projekt. Není určen k veřejné distribuci.
