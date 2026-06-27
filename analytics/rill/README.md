# AviCare — Rill Design-Time Project

> **Design-time only.** This project is NOT deployed, NOT in the production
> path, and NOT a CI gate. It connects to the local dev Postgres and serves
> as **living documentation** of the KPI metric definitions that are ported
> to Spring Boot in Phases 1-3 of the dashboard implementation (Spec B).

---

## What this project is

The AviCare dashboard (Spec B) serves KPI data from Spring Boot endpoints,
not from Rill at runtime. This Rill project exists for two purposes:

1. **Visual validation** of SQL aggregations before they are ported to Java
   — you can run `rill start`, open the dashboards, and verify that the
   numbers look correct on real dev data.

2. **Living documentation** of metric definitions — each metrics view maps
   1-to-1 to the aggregation methods that live in `CommercialFacade`,
   `LivestockFacade`, and `InventoryFacade` in the backend.

---

## Project layout

```
analytics/rill/
  rill.yaml                        # project config; default OLAP = DuckDB
  .env                             # credentials (git-ignored — see below)
  .gitignore

  connectors/
    postgres.yaml                  # dev Postgres connector (DSN via .env)

  models/
    commercial.yaml                # revenue + invoice + outstanding rows
    commercial_worklist.yaml       # orders-to-deliver + invoices-to-collect
    elevage.yaml                   # production unit snapshot (GMQ, mortality)
    elevage_daily.yaml             # daily mortality + feed time-series
    stocks.yaml                    # stock snapshot + low-stock flag
    stock_movements_out.yaml       # OUT movements time-series

  metrics/
    commercial_kpis.yaml           # CA, encours, impayés, top clients
    elevage_kpis.yaml              # bandes, effectif, mortalité, GMQ, ponte
    elevage_daily_kpis.yaml        # daily series for period filtering
    stocks_kpis.yaml               # stock bas, valeur du stock
    stocks_consumption_kpis.yaml   # consommation période, top articles
```

Each non-materialized model runs as a SQL query on DuckDB (via the Postgres
connector as the input source). Rill's default DuckDB OLAP engine caches the
results locally for fast dashboard rendering.

---

## Prerequisites

- **Rill CLI** v0.87.7 or later:
  ```bash
  curl -s https://cdn.rilldata.com/install.sh | bash
  ```
  Or via Homebrew: `brew install rilldata/tap/rill`

- **Dev Postgres** running on `localhost:5434` with the AviCare schema
  (started via `docker-compose up -d postgres` from the repo root or
  `make dev-up`).

---

## Setup

1. Copy the env template and fill in credentials (already have defaults for
   the local dev stack):
   ```bash
   cp analytics/rill/.env.example analytics/rill/.env
   # .env is git-ignored — never commit it
   ```

   The required variable:
   ```
   avicare_postgres_dsn=postgres://avicare:<DEV_DB_PASSWORD>@localhost:5434/avicare?sslmode=disable
   ```

2. Start Rill from the project directory:
   ```bash
   cd analytics/rill
   rill start
   # or: rill start --no-open   (headless, no browser)
   ```

3. Open the browser at `http://localhost:9009` (or the URL printed in the
   terminal). You will see the five dashboards under **Explore**:
   - Commercial — KPI
   - Élevage — KPI
   - Élevage — Séries journalières
   - Stocks — KPI
   - Stocks — Consommation

---

## Validating with a specific farm

Because data is multi-tenant by `farm_id`, filter on a known dev farm ID
using the dimension filter in the Explore UI (sidebar → Farm → select an ID).

For scripted validation (no browser):
```bash
cd analytics/rill
rill start --no-open &
sleep 15
curl -s http://localhost:9009/v1/instances/default/resources | \
  python3 -m json.tool | grep -E '"name"|"reconcileError"'
kill %1
```

All `reconcileError` values should be `null` or absent.

---

## Mapping to backend aggregations

| Metrics view | Spring Boot method (target Phase) |
|---|---|
| `commercial_kpis` — `total_revenue_xof` | `CommercialFacade.revenueByPeriod(farmId, range)` — Phase 1 |
| `commercial_kpis` — `total_outstanding_xof` | `CommercialFacade.outstandingTotal(farmId)` — Phase 1 |
| `commercial_kpis` — `total_overdue_xof` | `CommercialFacade.overdueTotal(farmId)` — Phase 1 |
| `elevage_kpis` — `active_batch_count` | `LivestockFacade.activeBatchCount(farmId)` — Phase 2 |
| `elevage_daily_kpis` — `total_mortality` | `LivestockFacade.mortalityCount(farmId, range)` — Phase 2 |
| `elevage_kpis` — `avg_gmq_g_per_day` | `LivestockFacade.avgGmq(farmId)` — Phase 2 |
| `elevage_kpis` — `avg_laying_rate_pct` | `LivestockFacade.eggRate(farmId, range)` — Phase 2 |
| `stocks_kpis` — `low_stock_count` | `InventoryFacade.lowStockCount(farmId)` — Phase 3 |
| `stocks_kpis` — `total_stock_value_xof` | `InventoryFacade.stockValue(farmId)` — Phase 3 |
| `stocks_consumption_kpis` — `total_quantity_out` | `InventoryFacade.consumptionByPeriod(farmId, range)` — Phase 3 |

---

## What is NOT in this project

- No Rill Cloud deployment
- No scheduled refreshes (cron) — data is queried live from dev Postgres
- No security policies (dev tool, single-developer use)
- No canvas dashboards — Explore views are sufficient for metric validation
- No CI gate — this project is never run in GitHub Actions
