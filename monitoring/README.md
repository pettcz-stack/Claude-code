# Device Monitor

**Férový přehled o efektivitě práce na firemních počítačích — v souladu s GDPR a §316 zákoníku práce.**

Device Monitor sbírá z firemních Windows zařízení **pouze agregované metriky**
(aktivní/nečinný čas, název aktivní aplikace, počet úhozů a pohybů myši) a
ukazuje je v jednom přehledném dashboardu — pro vedení, HR i samotné
zaměstnance. **Žádné screenshoty, žádný keylogging obsahu, žádný mikrofon
ani kamera.**

> ⚠️ **Soukromý projekt.** Tento repozitář je proprietární. Není určen pro
> veřejnou distribuci. Viz [`LICENSE`](LICENSE) a [`EULA.md`](EULA.md).

---

## 📚 Dokumentace — kde co najdeš

| Dokument | Komu | Co obsahuje |
|---|---|---|
| [README.md](README.md) ← tady jsi | Všichni | Přehled, struktura, rychlý start |
| [INSTALL.md](INSTALL.md) | IT / nasazení | Instalace serveru (Docker, on-prem) + GPO rollout agenta |
| [USAGE.md](USAGE.md) | Vedení / HR | Jak číst dashboard, klasifikace, výjimky podle oddělení |
| [SECURITY.md](SECURITY.md) | Bezpečnost / DPO | Bezpečnostní model, šifrování, role, GDPR |
| [CHANGELOG.md](CHANGELOG.md) | Vývoj | Historie verzí |
| [EULA.md](EULA.md) | Zákazníci | Koncová licenční smlouva (vzor – pro úpravu právníkem) |
| [docs/NAVRH.md](docs/NAVRH.md) | Architekti | Návrh systému (datový model, API, integrace) |
| [docs/DOKUMENTACE.md](docs/DOKUMENTACE.md) | Pokročilí | Detailní technická dokumentace |
| [docs/BEZPECNOST.md](docs/BEZPECNOST.md) | Bezpečnost | Hardening doporučení |
| [docs/STAV-A-NASAZENI.md](docs/STAV-A-NASAZENI.md) | Provoz | Co je hotové, co plánováno |
| [docs/NAPADY-BACKLOG.md](docs/NAPADY-BACKLOG.md) | Produkt | Roadmapa / backlog |
| [docs/pravni/](docs/pravni/) | Právní / DPO | Šablony: poučení zaměstnanců, DPIA, balanční test |
| [agent/README.md](agent/README.md) | Vývoj agenta | Windows agent (C#) — build a chování |
| [installer/README.md](installer/README.md) | IT | MSI instalátor + Active Directory GPO |
| [installer/PILOT-TEST.md](installer/PILOT-TEST.md) | IT | Pilotní test na 1–2 PC |
| [TEST-NA-JEDNOM-PC.md](TEST-NA-JEDNOM-PC.md) | IT / netechnik | Nejjednodušší test celé sestavy na 1 PC |

---

## Struktura repozitáře

```
backend/        Node.js + Prisma + Express API (ingest, agregace, dashboard data)
frontend/       React + Vite dashboard (admin, HR, vedení)
agent/          C# Windows agent (.NET 4.8) + watchdog služba
installer/      WiX MSI instalátor + skripty pro GPO rollout
docs/           Návrh, bezpečnost, právní šablony
.github/        CI workflowy (Linux backend/frontend + Windows agent/MSI)
docker-compose.yml         On-premise nasazení (PostgreSQL + backend + frontend)
docker-compose.demo.yml    Lokální demo (vše v jednom kontejneru, SQLite)
dev.sh                     Vývojový start (jeden port, automatický seed)
```

---

## Rychlý start — lokální vývoj

**Předpoklady:** Node.js 20+, na Windows pro build agenta i .NET SDK 8 + Framework 4.8 Dev Pack.

```bash
# Vše naráz (backend + frontend + demo data + admin/admin)
./dev.sh
# Otevři http://localhost:8080
```

Detailní možnosti viz [`INSTALL.md`](INSTALL.md).

---

## Co Device Monitor dělá

- ✅ **Skóre efektivity** týmu i jednotlivců — férové: dovolená/nemoc/svátky se nepočítají proti.
- ✅ **Práce vs. zábava** (sítě, sázení, hry…) rozpoznané automaticky podle aplikací + pravidel webů.
- ✅ **Per-oddělení výjimky** — např. LinkedIn = práce pro HR, zábava pro ostatní.
- ✅ **Home Office vs. kancelář**, lokality poboček (podle sítě), počet monitorů.
- ✅ **Cena neproduktivního času v Kč** — pro management.
- ✅ **Report přímo zaměstnanci** (volitelné) — focus sessions, nejproduktivnější hodina, trend tento týden vs minulý.
- ✅ **IT prediktivní HW monitoring** — SMART, baterie, RAM, BIOS, antivirus — IT vidí problém dřív než nastane.
- ✅ **Audit přístupů** — pro management; volitelně i pro zaměstnance (GDPR čl. 15).

## Co NEdělá (záměrně)

- ❌ Žádné screenshoty / obsah klávesnice / kamera / mikrofon.
- ❌ Žádné čtení obsahu souborů ani komunikace.
- ❌ Žádná GPS / sledování polohy mimo firmu.

---

## Architektura ve zkratce

```
[Windows PC]                       [Server]                        [Browser]
 ┌─────────────────┐                ┌────────────────┐              ┌──────────┐
 │ Agent (C#)      │  HTTPS         │ Backend        │  HTTPS       │ Dashboard│
 │ + Watchdog svc  │ ──ingest──▶   │ Node + Prisma  │  ◀──────────│ React    │
 │ %ProgramData%   │                │ PostgreSQL/    │              │ Vite     │
 └─────────────────┘                │ SQLite (demo)  │              └──────────┘
                                    └────────────────┘
```

Detaily v [`docs/NAVRH.md`](docs/NAVRH.md).

---

## CI / build

- **Linux backend + frontend:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — typecheck, lint, build, testy.
- **Windows agent + MSI:** [`.github/workflows/agent-build.yml`](.github/workflows/agent-build.yml) — staví agenta a MSI na Windows runneru, artefakt **`DeviceMonitorAgent.msi`**.

---

## Licence

Proprietární, viz [`LICENSE`](LICENSE) a [`EULA.md`](EULA.md). Distribuce mimo
oprávněné zákazníky není povolena.
