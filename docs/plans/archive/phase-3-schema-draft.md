# Phase 3 draft: what the database must store

Taken from what the calculation engine (`src/calc/types.ts`) needs. This is a draft for the Phase 3 plan; nothing is created yet. Every table gets `id`, `pump_id` (except `pumps`), `created_by/at`, `updated_by/at`, a row version, RLS and the audit trigger (CLAUDE.md hard rule 5). Money and litres are `numeric`.

## Changes from the PRD table list (from the real notebook day)
| Change | Why |
|---|---|
| `pumps.rules jsonb` replaces `tolerances jsonb`, same shape as `src/calc/rules.ts` | One place for every limit, per pump |
| `dip_charts` get a version; a new upload makes a new version, old ones are never edited | Old days never change when a chart is replaced (D17) |
| `tank_readings.book_stock_l` (IOCL "Op. Stock") and the chart version used | S3 compares the day-to-day change in the book-vs-dip gap (D22) |
| `shifts.opening_cash` | Cash counted includes what was in the drawer at the start (D24) |
| `nozzles.in_use` | Nozzles 1 and 2 are not in use (D30) |
| `credit_sales.entry_by` (RUPEES / LITRES) with both `rupees` and `litres` stored | Round-rupee fills (D27) |
| New `customer_payments` (customer, rupees, payment type, shift) | Dues and advances kept out of fuel sales (D29) |
| `payment_types` seeded: Cash, Paytm, Card, XtraPower, Bank transfer, Credit | D25 |
| `expense_categories` seeded with the 10 types in D33 | D33 |
| `tanker_receipts.invoice_no` | On the real challan |
| New `owner_notes` | Canvas decision D3 |
| New `schema_migrations_applied` ledger | Check the live database matches the repo (D16) |

## Tables the engine reads
- **Setup:** `pumps`, `tanks` (label, product, chart), `dip_charts` + `dip_chart_rows`, `nozzles` (label, product, tank, in_use), `fuel_prices` (product, per_litre, starts_on), `shift_templates`, `payment_types`, `cash_denominations`, `expense_categories` (default type, daily cap), `credit_customers`, `staff`
- **Per day:** `business_days` (date, status, price confirmed by/at, no tanker, no expenses), `tank_readings` (opening/closing dip cm, book stock), `tanker_receipts` + `receipt_lines` (ordered, short, price, margin, dips before/after), `expenses` (type, rupees, paid from)
- **Per shift:** `shifts` (code, opening cash, sales done at), `shift_attendants`, `nozzle_readings` (opening, closing, meter change status), `nozzle_tests` (nozzle, litres), `cash_counts` (note, count) + coins, `shift_payments` (type, amount), `credit_sales`, `customer_payments`
- **Results and follow-up:** `flags` (code, severity, numbers, message, status), `unlock_requests`, `owner_notes`, `audit_log`

## Views that mirror the engine (Phase 3/4, same golden cases)
`v_tank_litres` (dip → litres), `v_shift_match` (Should have / Received / Difference), `v_day_match` (per fuel tank vs meters, is_matched). Each is tested against `tests/golden/cases/*.json` in CI.
