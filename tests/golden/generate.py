# Regenerates tests/golden/cases/*.json:  python3 tests/golden/generate.py
# Expected values are computed here INDEPENDENTLY of the TypeScript engine (plain Python Decimal),
# so the golden cases are a second opinion, not a copy of the engine's answers.
import json, os
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_UP

ROOT = os.path.dirname(os.path.abspath(__file__))  # tests/golden
OUT = f"{ROOT}/cases"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))

REAL = {int(r[0]): D(r[1]) for r in json.load(open(f"{ROOT}/charts/iocl-20kl.json"))["rows"]}

def real_litres(cm):
    cm = D(cm); lo = int(cm); f = cm - lo
    return REAL[lo] if f == 0 else REAL[lo] + (REAL[lo + 1] - REAL[lo]) * f

def lin(cm): return D(cm) * 100  # test chart: 1 cm = 100 L

def q(x, n=2): return str(D(x).quantize(D(1).scaleb(-n), rounding=ROUND_HALF_UP))

def write(name, case):
    with open(f"{OUT}/{name}.json", "w") as fh:
        json.dump(case, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

# ─── helpers to build a day ──────────────────────────────────────────────
def tank(pid, chart="linear-100"): return {"id": f"{pid}-1", "label": f"{pid}-1", "product": pid, "chart": chart}
def nozzle(pid, n, opening, closing, in_use=True, **kw):
    z = {"nozzleId": f"{pid}-{n}", "label": f"{pid}-{n}", "product": pid, "tankId": f"{pid}-1", "inUse": in_use}
    if opening is not None: z["opening"] = opening
    if closing is not None: z["closing"] = closing
    z.update(kw); return z
def shift(code, nozzles, cash_total=None, notes=None, opening_cash="0", payments=(), slips=(), tests=()):
    s = {"code": code, "nozzles": list(nozzles), "tests": list(tests), "openingCash": opening_cash,
         "otherPayments": list(payments), "creditSlips": list(slips)}
    if cash_total is not None: s["cash"] = {"total": cash_total}
    if notes is not None: s["cash"] = notes
    return s
def day(tanks, tank_days, shifts, prices=None, tankers=(), expenses=(), payments=(), confirmed=True, date="2026-10-01", **kw):
    d = {"businessDate": date, "priceConfirmed": confirmed,
         "prices": prices or [{"product": "MS", "perLitre": "101.00", "startsOn": "2026-09-01"},
                              {"product": "HSD", "perLitre": "90.00", "startsOn": "2026-09-01"}],
         "tanks": tanks, "tankDays": tank_days, "tankers": list(tankers), "shifts": shifts,
         "expenses": list(expenses), "customerPayments": list(payments)}
    d.update(kw); return d
def pr(tank_sold, meters_net):
    diff = D(meters_net) - D(tank_sold)
    pct = None if D(tank_sold) == 0 else diff / D(tank_sold) * 100
    return diff, pct

# ─── 1. Dip chart readings (real pilot chart) ────────────────────────────
write("dip-01-real-chart-readings", {
    "kind": "dip", "source": "PRD acceptance 1 + pilot chart",
    "description": "Dip cm to litres on the real 20 KL chart, reading straight across between rows. Outside 0-210 cm = no litres (H3).",
    "chart": "iocl-20kl",
    "readings": [
        {"dipCm": "0", "litres": "0.00"}, {"dipCm": "1", "litres": "11.97"},
        {"dipCm": "123.0", "litres": "13163.73"}, {"dipCm": "123.4", "litres": "13215.37"},
        {"dipCm": "128.5", "litres": q(real_litres("128.5"))}, {"dipCm": "209.9", "litres": q(real_litres("209.9"))},
        {"dipCm": "210.0", "litres": "21628.93"}, {"dipCm": "210.1", "litres": None}, {"dipCm": "-0.1", "litres": None},
    ]})

write("dip-02-chart-upload-checks", {
    "kind": "chart", "source": "PRD F1 dip chart upload",
    "description": "Chart checks before saving: 0 cm row added if missing, exact duplicate rows dropped, a dip repeated with different litres or litres going down is refused with the row number.",
    "charts": [
        {"name": "missing zero row", "rows": [["1", "10"], ["2", "25"]], "ok": True, "rowsAfter": 3, "capacityLitres": "25"},
        {"name": "exact duplicate row", "rows": [["0", "0"], ["1", "10"], ["1", "10"], ["2", "25"]], "ok": True, "rowsAfter": 3, "capacityLitres": "25"},
        {"name": "same dip twice", "rows": [["0", "0"], ["46", "3730"], ["46", "3840"]], "ok": False, "problemRows": [3]},
        {"name": "litres go down", "rows": [["0", "0"], ["1", "10"], ["2", "9"]], "ok": False, "problemRows": [3]},
        {"name": "not a number", "rows": [["0", "0"], ["1", "ten"]], "ok": False, "problemRows": [2]},
    ]})

# ─── 2. Price for a date (PRD 8) ─────────────────────────────────────────
write("price-01-start-date", {
    "kind": "price", "source": "PRD acceptance 8",
    "description": "The price for a day is the latest price whose start date is on or before that day.",
    "prices": [{"product": "MS", "perLitre": "100.00", "startsOn": "2026-09-01"},
               {"product": "MS", "perLitre": "101.00", "startsOn": "2026-10-01"},
               {"product": "HSD", "perLitre": "90.00", "startsOn": "2026-09-01"}],
    "lookups": [{"product": "MS", "date": "2026-09-30", "perLitre": "100.00"},
                {"product": "MS", "date": "2026-10-01", "perLitre": "101.00"},
                {"product": "MS", "date": "2026-12-31", "perLitre": "101.00"},
                {"product": "MS", "date": "2026-08-31", "perLitre": None},
                {"product": "HSD", "date": "2026-10-01", "perLitre": "90.00"}]})

# ─── 3. Credit slips (15 Sep rates) ──────────────────────────────────────
rate = D("101.74")
def up(x): return str((D(x) / rate).quantize(D("0.01"), rounding=ROUND_UP))
def hu(x): return str((D(x) / rate).quantize(D("0.01"), rounding=ROUND_HALF_UP))
write("slip-01-rupees-or-litres", {
    "kind": "slip", "source": "Notebook 15 Sep 2026 + decision D27",
    "description": "Rupee fill: litres = rupees ÷ rate, rounded UP to 2 decimals (as on the real slips). Litre fill: rupees = litres × rate.",
    "rate": "101.74",
    "slips": [
        {"entry": {"by": "rupees", "rupees": "14000"}, "litres": up(14000), "rupees": "14000.00"},
        {"entry": {"by": "rupees", "rupees": "13000"}, "litres": up(13000), "rupees": "13000.00"},
        {"entry": {"by": "rupees", "rupees": "12000"}, "litres": up(12000), "rupees": "12000.00"},
        {"entry": {"by": "rupees", "rupees": "10000"}, "litres": up(10000), "rupees": "10000.00"},
        {"entry": {"by": "rupees", "rupees": "15000"}, "litres": up(15000), "rupees": "15000.00"},
        {"entry": {"by": "litres", "litres": "420"}, "litres": "420.00", "rupees": "42730.80"},
        {"entry": {"by": "litres", "litres": "1600"}, "litres": "1600.00", "rupees": "162784.00"},
        {"entry": {"by": "rupees", "rupees": "15000"}, "rules": {"creditSlip": {"litreDecimals": 2, "litreRounding": "halfUp"}},
         "litres": hu(15000), "rupees": "15000.00"},
    ]})
assert up(15000) == "147.44" and up(14000) == "137.61" and hu(15000) == "147.43"

# ─── 4. Tanker (PRD 6) ───────────────────────────────────────────────────
write("tanker-01-prd-totals", {
    "kind": "tanker", "source": "PRD acceptance 6",
    "description": "HSD ordered 10,000 L, short 50 L, ₹85.00/L, margin ₹3.00/L.",
    "receipt": {"id": "T1", "vehicleNo": "OD02CD9087", "lines": [
        {"product": "HSD", "tankId": "HSD-1", "orderedLitres": "10000", "shortLitres": "50", "pricePerLitre": "85.00", "marginPerLitre": "3.00"}]},
    "expected": {"receivedNetLitres": "9950.00", "totalAmount": "850000.00", "totalShortAmount": "4250.00",
                 "toPay": "845750.00", "totalMargin": "29850.00"}})

# ─── 5. Full days ────────────────────────────────────────────────────────
# PRD 2 + 3: HSD tank 12,000 + 9,950 − 13,955 = 7,995; meters 8,005 − 10 test = 7,995 → Matched.
hsd_should = D("7995") * D("90.00")
write("day-01-prd-hsd-matched", {
    "kind": "day", "source": "PRD acceptance 2 and 3",
    "description": "HSD opening dip 12,000 L + received 9,950 L (10,000 ordered, 50 short) − closing 13,955 L = 7,995 L sold as per tank. Meters 8,005 − 10 test = 7,995. Difference 0: Matched. The 50 L short (0.5%) raises S6.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "120.00", "closingDipCm": "139.55"}],
                 [shift("A", [nozzle("HSD", "A", "100000.00", "108005.00")], cash_total=str(hsd_should),
                        tests=[{"nozzleId": "HSD-A", "litres": "10"}])],
                 tankers=[{"id": "T1", "vehicleNo": "OD02CD9087", "lines": [
                     {"product": "HSD", "tankId": "HSD-1", "orderedLitres": "10000", "shortLitres": "50"}]}]),
    "expected": {"products": {"HSD": {"soldAsPerTank": "7995.00", "meterLitres": "8005.00", "testLitres": "10.00",
                                      "soldAsPerMeters": "7995.00", "difference": "0.00", "differencePercent": "0.00", "withinLimit": True}},
                 "shifts": {"A": {"shouldHave": "719550.00", "received": "719550.00", "difference": "0.00", "withinLimit": True}},
                 "hardErrors": [], "flags": ["S6"], "isMatched": True}})

# PRD 4: MS 1,490 L at ₹101.00 = ₹1,50,490; cash notes ₹90,000 + Paytm ₹50,000 + POS ₹5,490 + credit ₹5,000.
notes = {"byNotes": [{"noteValue": "500", "count": "150"}, {"noteValue": "200", "count": "50"}, {"noteValue": "100", "count": "40"}], "coins": "1000"}
ms_day = lambda cash, expenses=(): day([tank("MS")], [{"tankId": "MS-1", "openingDipCm": "100.00", "closingDipCm": "85.10"}],
    [shift("A", [nozzle("MS", "A", "50000.00", "51490.00")], notes=cash,
           payments=[{"type": "Paytm", "amount": "50000"}, {"type": "Card", "amount": "5490"}],
           slips=[{"slipNo": "4471", "customer": "Mahanadi Coalfields", "vehicleNo": "OD05AB1234", "product": "MS", "entry": {"by": "rupees", "rupees": "5000"}}])],
    expenses=expenses)
write("day-02-prd-ms-money", {
    "kind": "day", "source": "PRD acceptance 4",
    "description": "MS 1,490 L × ₹101.00 = Should have ₹1,50,490.00. Cash by notes 150×500 + 50×200 + 40×100 + coins ₹1,000 = ₹90,000; + Paytm ₹50,000 + Card ₹5,490 + credit ₹5,000 = Received ₹1,50,490. Difference 0.",
    "input": ms_day(notes),
    "expected": {"products": {"MS": {"soldAsPerTank": "1490.00", "soldAsPerMeters": "1490.00", "difference": "0.00", "withinLimit": True}},
                 "shifts": {"A": {"shouldHave": "150490.00", "received": "150490.00", "difference": "0.00", "withinLimit": True,
                                  "cashCounted": "90000.00", "creditSlips": "5000.00"}},
                 "hardErrors": [], "flags": [], "isMatched": True}})

notes2 = json.loads(json.dumps(notes)); notes2["coins"] = "700"
write("day-03-prd-drawer-expense", {
    "kind": "day", "source": "PRD acceptance 5",
    "description": "Same as the MS money day, but ₹300 Tiffin was paid from Shift A's drawer (so only ₹89,700 is counted) and ₹18,000 salary was paid by the owner. The Tiffin is added back to Shift A's Received; the salary is not. Difference stays 0.",
    "input": ms_day(notes2, expenses=[{"id": "E1", "type": "Tiffin", "rupees": "300", "paidFrom": "SHIFT_A"},
                                      {"id": "E2", "type": "Salary", "rupees": "18000", "paidFrom": "OWNER"}]),
    "expected": {"shifts": {"A": {"shouldHave": "150490.00", "received": "150490.00", "difference": "0.00",
                                  "cashCounted": "89700.00", "drawerExpenses": "300.00"}},
                 "hardErrors": [], "flags": [], "isMatched": True}})

def hsd_simple(tank_open, tank_close, meters, cash=None, **kw):
    sold = D(meters)
    return day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": tank_open, "closingDipCm": tank_close}],
               [shift("A", [nozzle("HSD", "A", "200000.00", str(D("200000.00") + sold))],
                      cash_total=cash if cash is not None else str(sold * D("90.00")))], **kw)

diff, pct = pr("8000", "7958")
write("day-04-prd-stock-short", {
    "kind": "day", "source": "PRD acceptance 7",
    "description": "Sold as per tank 8,000 L, meters 7,958 L: Difference −42 L (−0.53%), beyond 0.5%, raises S1. Screen shows −42 L (−0.53%) in red.",
    "input": hsd_simple("100.00", "20.00", "7958"),
    "expected": {"products": {"HSD": {"soldAsPerTank": "8000.00", "soldAsPerMeters": "7958.00", "difference": q(diff), "differencePercent": q(pct), "withinLimit": False}},
                 "hardErrors": [], "flags": ["S1"], "isMatched": False}})
assert q(pct) == "-0.53"

write("day-05-s1-exactly-at-limit", {
    "kind": "day", "source": "Rule: 'beyond' means strictly more",
    "description": "Difference −40 L on 8,000 L is exactly 0.5%: still OK, no flag, Matched.",
    "input": hsd_simple("100.00", "20.00", "7960"),
    "expected": {"products": {"HSD": {"difference": "-40.00", "differencePercent": "-0.50", "withinLimit": True}},
                 "hardErrors": [], "flags": [], "isMatched": True}})

# S2 boundaries: two MS shifts, A short exactly ₹100, B short ₹100.01
two = day([tank("MS")], [{"tankId": "MS-1", "openingDipCm": "100.00", "closingDipCm": "80.00"}],
          [shift("A", [nozzle("MS", "A", "1000.00", "2000.00")], cash_total=str(D("1000") * D("101") - 100)),
           shift("B", [nozzle("MS", "A", "2000.00", "3000.00")], cash_total=str(D("1000") * D("101") - D("100.01")))])
write("day-06-s2-money-limit", {
    "kind": "day", "source": "Rule: money limit ₹100 per shift",
    "description": "Shift A short exactly ₹100 (OK). Shift B short ₹100.01 (flag S2). Fuel matched.",
    "input": two,
    "expected": {"shifts": {"A": {"shouldHave": "101000.00", "difference": "-100.00", "withinLimit": True},
                            "B": {"shouldHave": "101000.00", "difference": "-100.01", "withinLimit": False}},
                 "hardErrors": [], "flags": ["S2"], "isMatched": False}})

# Hard checks
write("day-07-h1-closing-below-opening", {
    "kind": "day", "source": "PRD acceptance 10 / H1",
    "description": "HSD-B closing 31,265.50 below opening 31,455.50: red error, its sale shows nothing.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "100.00"}],
                 [shift("B", [nozzle("HSD", "A", "48210.00", "48890.00"), nozzle("HSD", "B", "31455.50", "31265.50")])]),
    "expected": {"hardErrors": ["H1"], "flags": [], "isMatched": False}})

write("day-08-h2-meter-change", {
    "kind": "day", "source": "PRD acceptance 9 / H2",
    "description": "MS-A opening 19,850.00 but Shift A closed at 19,884.00, not approved: blocks submit. MS-B had an approved meter change: fine.",
    "input": day([tank("MS")], [{"tankId": "MS-1", "openingDipCm": "100.00"}],
                 [shift("B", [nozzle("MS", "A", "19850.00", "20204.00", previousClosing="19884.00"),
                              nozzle("MS", "B", "100.00", "365.00", previousClosing="22140.50", meterChangeApproved=True)])]),
    "expected": {"hardErrors": ["H2"], "isMatched": False}})

write("day-09-h3-dip-outside-chart", {
    "kind": "day", "source": "H3",
    "description": "Closing dip typed as 1714 instead of 171.4: outside the 0-210 cm chart. Tank vs meters can't be worked out.",
    "input": day([tank("HSD", "iocl-20kl")], [{"tankId": "HSD-1", "openingDipCm": "128.5", "closingDipCm": "1714"}],
                 [shift("A", [nozzle("HSD", "A", "1000.00", "1100.00")], cash_total="9000")]),
    "expected": {"products": {}, "hardErrors": ["H3"], "isMatched": False}})

write("day-10-h5-h6-negative-and-unconfirmed", {
    "kind": "day", "source": "H5, H6",
    "description": "Price not confirmed (no money worked out) and a negative expense.",
    "input": day([tank("MS")], [{"tankId": "MS-1", "openingDipCm": "100.00", "closingDipCm": "99.00"}],
                 [shift("A", [nozzle("MS", "A", "1000.00", "1100.00")], cash_total="10100")],
                 expenses=[{"id": "E1", "type": "Tiffin", "rupees": "-160", "paidFrom": "SHIFT_A"}], confirmed=False),
    "expected": {"shifts": {}, "hardErrors": ["H5", "H6"], "isMatched": False}})

slip = lambda no, cust, rupees: {"slipNo": no, "customer": cust, "vehicleNo": "OD35H9941", "product": "HSD", "entry": {"by": "rupees", "rupees": rupees}}
write("day-11-h7-duplicate-slip", {
    "kind": "day", "source": "PRD acceptance 11 / H7",
    "description": "Slip 4471 typed twice today, and slip 4400 was already used on an earlier day.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "100.00"}],
                 [shift("B", [nozzle("HSD", "A", "1000.00", "2000.00")],
                        slips=[slip("4471", "Mahanadi Coalfields", "9000"), slip("4471", "Sahu Transport", "900"), slip("4400", "Sahu Transport", "900")])],
                 earlierSlipNumbers=["4400"]),
    "expected": {"hardErrors": ["H7", "H7"], "isMatched": False}})

write("day-12-h8-test-over-sale", {
    "kind": "day", "source": "H8",
    "description": "HSD-A sold 5 L this shift but 10 L were entered as tested.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "100.00"}],
                 [shift("A", [nozzle("HSD", "A", "1000.00", "1005.00")], tests=[{"nozzleId": "HSD-A", "litres": "10"}])]),
    "expected": {"hardErrors": ["H8"], "isMatched": False}})

write("day-13-h9-credit-over-meters", {
    "kind": "day", "source": "H9",
    "description": "Meters sold 100 L of HSD in the shift, but credit slips add up to 110 L.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "100.00"}],
                 [shift("A", [nozzle("HSD", "A", "1000.00", "1100.00")],
                        slips=[{"slipNo": "4490", "customer": "M.G.M. Minerals", "vehicleNo": "OD19U1828", "product": "HSD", "entry": {"by": "litres", "litres": "110"}}])]),
    "expected": {"hardErrors": ["H9"], "isMatched": False}})

# Soft checks
ms_gap_today = D("7071") - real_litres("55.2")
hsd_open = real_litres("59.8")
write("day-14-s3-book-gap-moved", {
    "kind": "day", "source": "Decision D22 (S3 redefined)",
    "description": "IOCL book stock minus opening dip. MS gap 2,534.22 L today vs 2,534.00 yesterday: moved 0.22 L, OK. HSD gap moved by 100 L, beyond 0.5% of 5,074.74 L (25.37 L): S3.",
    "input": day([tank("MS", "iocl-20kl"), tank("HSD", "iocl-20kl")],
                 [{"tankId": "MS-1", "openingDipCm": "55.2", "bookStockLitres": "7071", "yesterdayBookGapLitres": "2534"},
                  {"tankId": "HSD-1", "openingDipCm": "59.8", "bookStockLitres": str(hsd_open + 4528 + 100), "yesterdayBookGapLitres": "4528"}],
                 [shift("A", [nozzle("MS", "A", None, None), nozzle("HSD", "A", None, None)])]),
    "expected": {"flags": ["S3"], "isMatched": False}})

write("day-15-s4-nozzle-sales", {
    "kind": "day", "source": "S4",
    "description": "HSD-A sold nothing all day (flag). HSD-B sold 250 L vs a 100 L average over 3 days, more than 2× (flag). HSD-C sold 250 L but has only 2 days of history, so no spike check. HSD-D is not in use: no flag.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "100.00"}],
                 [shift("A", [nozzle("HSD", "A", "1000.00", "1000.00"), nozzle("HSD", "B", "1000.00", "1250.00"),
                              nozzle("HSD", "C", "1000.00", "1250.00"), nozzle("HSD", "D", None, None, in_use=False)])],
                 nozzleHistory={"HSD-B": ["100", "100", "100"], "HSD-C": ["100", "100"]}),
    "expected": {"flags": ["S4", "S4"], "isMatched": False}})

rise = real_litres("119.8") - real_litres("59.8")
write("day-16-s6-tanker-dip-check", {
    "kind": "day", "source": "S6",
    "description": f"Tanker 14,000 L ordered, 28 L short (0.2%, OK). Dip rose from 59.8 to 119.8 cm = {q(rise)} L, but the challan says 13,972 L received: differs by more than 0.5%, S6.",
    "input": day([tank("HSD", "iocl-20kl")], [{"tankId": "HSD-1", "openingDipCm": "59.8"}],
                 [shift("A", [nozzle("HSD", "A", None, None)])],
                 tankers=[{"id": "T1", "vehicleNo": "OD02CD9087", "invoiceNo": "7018875672", "lines": [
                     {"product": "HSD", "tankId": "HSD-1", "orderedLitres": "14000", "shortLitres": "28", "dipBeforeCm": "59.8", "dipAfterCm": "119.8"}]}]),
    "expected": {"tankers": {"T1": {"receivedNetLitres": "13972.00", "dipRiseLitres": q(rise)}}, "flags": ["S6"], "isMatched": False}})

write("day-17-s7-opening-dip", {
    "kind": "day", "source": "S7",
    "description": "MS opening 129.1 cm vs last night's 128.5 cm: 0.6 cm, beyond 0.5 cm (flag). HSD 128.9 vs 128.5: 0.4 cm (OK).",
    "input": day([tank("MS", "iocl-20kl"), tank("HSD", "iocl-20kl")],
                 [{"tankId": "MS-1", "openingDipCm": "129.1", "yesterdayClosingDipCm": "128.5"},
                  {"tankId": "HSD-1", "openingDipCm": "128.9", "yesterdayClosingDipCm": "128.5"}],
                 [shift("A", [nozzle("MS", "A", None, None)])]),
    "expected": {"flags": ["S7"], "isMatched": False}})

write("day-18-s9-expense-cap", {
    "kind": "day", "source": "S9",
    "description": "Owner capped Bakshis at ₹300 a day; ₹500 was spent: flag.",
    "rules": {"expenseDailyCaps": {"Bakshis": "300"}},
    "input": day([tank("MS")], [{"tankId": "MS-1", "openingDipCm": "100.00"}], [shift("A", [nozzle("MS", "A", None, None)])],
                 expenses=[{"id": "E1", "type": "Bakshis", "rupees": "500", "paidFrom": "SHIFT_B"}]),
    "expected": {"flags": ["S9"], "isMatched": False}})

# R1: HSD −4.30% (beyond 4.20) → S1 + R1; MS −4.30% (within 4.75) → S1 only
r1 = day([tank("MS"), tank("HSD")],
         [{"tankId": "MS-1", "openingDipCm": "100.00", "closingDipCm": "90.00"},
          {"tankId": "HSD-1", "openingDipCm": "100.00", "closingDipCm": "90.00"}],
         [shift("A", [nozzle("MS", "A", "0.00", "957.00"), nozzle("HSD", "A", "0.00", "957.00")],
                cash_total=str(D("957") * D("101") + D("957") * D("90")))])
write("day-19-r1-compliance", {
    "kind": "day", "source": "Decision D19 (R1)",
    "description": "Both fuels: 1,000 L left the tank, meters 957 L: −4.30%. HSD limit 4% + 0.20% = 4.20%: R1. MS limit 4% + 0.75% = 4.75%: no R1. Both raise S1.",
    "input": r1,
    "expected": {"products": {"MS": {"differencePercent": "-4.30"}, "HSD": {"differencePercent": "-4.30"}},
                 "flags": ["S1", "S1", "R1"], "isMatched": False}})

write("day-20-nothing-left-tank", {
    "kind": "day", "source": "Rule: no % when nothing left the tank",
    "description": "Dip didn't move (0 L sold as per tank) but meters show 5 L: % can't be worked out, S1 is raised.",
    "input": hsd_simple("100.00", "100.00", "5"),
    "expected": {"products": {"HSD": {"soldAsPerTank": "0.00", "difference": "5.00", "differencePercent": None, "withinLimit": False}},
                 "flags": ["S1"], "isMatched": False}})

write("day-21-in-progress", {
    "kind": "day", "source": "Day not finished",
    "description": "No closing dip and no cash counted yet: no fuel or money result, no errors, not Matched yet.",
    "input": day([tank("HSD")], [{"tankId": "HSD-1", "openingDipCm": "100.00"}],
                 [shift("A", [nozzle("HSD", "A", "1000.00", "1500.00")])]),
    "expected": {"products": {}, "shifts": {}, "hardErrors": [], "flags": [], "isMatched": False}})

# Canvas sample day (01 Oct): HSD −42 L, Shift B −₹1,250, Shift C +₹300
p = {"MS": D("101.00"), "HSD": D("90.00")}
split = {"A": {"HSD": D("3000"), "MS": D("989")}, "B": {"HSD": D("3180"), "MS": D("1150")}, "C": {"HSD": D("1897"), "MS": D("773")}}
offset = {"A": D("0"), "B": D("-1250"), "C": D("300")}
shifts, reading = [], {"HSD": D("48000.00"), "MS": D("19000.00")}
exp_shifts = {}
for code in "ABC":
    nz = []
    for f in ("HSD", "MS"):
        o = reading[f]; c = o + split[code][f]; reading[f] = c
        nz.append(nozzle(f, "A", str(o), str(c)))
    should = split[code]["HSD"] * p["HSD"] + split[code]["MS"] * p["MS"]
    shifts.append(shift(code, nz, cash_total=str(should + offset[code])))
    exp_shifts[code] = {"shouldHave": q(should), "difference": q(offset[code]), "withinLimit": offset[code] == 0}
hsd_diff, hsd_pct = pr("8119", "8077")
write("day-22-canvas-sample", {
    "kind": "day", "source": "Design canvas sample day (01 Oct 2026)",
    "description": "HSD: 14,820 + 11,980 − 18,681 = 8,119 L vs meters 8,077: −42 L (−0.52%), S1. MS 8,235 + 3,980 − 9,303 = 2,912 = meters: Matched. Shift A matched, B short ₹1,250, C excess ₹300 (both S2). MS tanker 20 L short of 4,000 (0.5%): S6.",
    "input": day([tank("MS"), tank("HSD")],
                 [{"tankId": "HSD-1", "openingDipCm": "148.20", "closingDipCm": "186.81"},
                  {"tankId": "MS-1", "openingDipCm": "82.35", "closingDipCm": "93.03"}],
                 shifts,
                 tankers=[{"id": "T1", "vehicleNo": "OD02CD9087", "lines": [
                     {"product": "HSD", "tankId": "HSD-1", "orderedLitres": "12000", "shortLitres": "20"},
                     {"product": "MS", "tankId": "MS-1", "orderedLitres": "4000", "shortLitres": "20"}]}]),
    "expected": {"products": {"HSD": {"soldAsPerTank": "8119.00", "soldAsPerMeters": "8077.00", "difference": q(hsd_diff), "differencePercent": q(hsd_pct), "withinLimit": False},
                              "MS": {"soldAsPerTank": "2912.00", "soldAsPerMeters": "2912.00", "difference": "0.00", "withinLimit": True}},
                 "shifts": exp_shifts, "hardErrors": [], "flags": ["S1", "S2", "S2", "S6"], "isMatched": False}})

# ─── 6. The real notebook day, 15 Sep 2026 ───────────────────────────────
ms_price, hsd_price = D("110.07"), D("101.74")
rupee_slips = [  # (slip, customer, vehicle, rupees)
    ("4461", "S.V.T. Logistics", "OD29N6315", "14000"), ("4482", "S.V.T. Logistics", "OD05AR8799", "10000"),
    ("4463", "Maa Bhawani Roadlines", "OD35H9941", "14000"), ("4464", "Maa Bhawani Roadlines", "OD35H7857", "13000"),
    ("4465", "Maa Bhawani Roadlines", "OD35H7859", "13000"), ("4467", "Maa Bhawani Roadlines", "OD25G0271", "12000"),
    ("4468", "Maa Bhawani Roadlines", "OD35H9982", "14000"), ("4469", "Maa Bhawani Roadlines", "OD26U2099", "14000"),
    ("4470", "Maa Bhawani Roadlines", "OD35G8487", "12000"), ("4471", "Maa Bhawani Roadlines", "OD35H0018", "12000"),
    ("4472", "Maa Bhawani Roadlines", "OD35H0618", "10000"), ("4473", "Maa Bhawani Roadlines", "OD19AB1783", "14000"),
    ("4474", "Maa Bhawani Roadlines", "OD25H0618", "10000"), ("4475", "Maa Bhawani Roadlines", "OD35H6481", "12000"),
    ("4476", "Maa Bhawani Roadlines", "CG04MK2077", "12000"), ("4477", "Maa Bhawani Roadlines", "OD15K2647", "14000"),
    ("4478", "Maa Bhawani Roadlines", "OD19AC3885", "15000"), ("4479", "Maa Bhawani Roadlines", "OD19Z5005", "13000"),
    ("4480", "Maa Bhawani Roadlines", "OD19AD1005", "13000"), ("4481", "Maa Bhawani Roadlines", "OD19AC3939", "14000"),
    ("4483", "Maa Bhawani Roadlines", "OD19AC4005", "13000"), ("4484", "Maa Bhawani Roadlines", "OD19AD3939", "14000"),
    ("4485", "Maa Bhawani Roadlines", "OD35G8759", "12000"), ("4486", "Maa Bhawani Roadlines", "OD35G8411", "12000"),
    ("4487", "Maa Bhawani Roadlines", "OD35J0465", "15000"), ("4488", "Maa Bhawani Roadlines", "OD35G8449", "12000"),
    ("4490", "Maa Bhawani Roadlines", "OD19W1911", "12000"),
]
litre_slips = [("4142", "Bijay Ku Sahoo", "OD19Z3404", "420"), ("782", "M.G.M. Minerals Ltd", "OD19U1828", "1600")]
slips = [{"slipNo": s, "customer": c, "vehicleNo": v, "product": "HSD", "entry": {"by": "rupees", "rupees": r}} for s, c, v, r in rupee_slips]
slips += [{"slipNo": s, "customer": c, "vehicleNo": v, "product": "HSD", "entry": {"by": "litres", "litres": l}} for s, c, v, l in litre_slips]
credit_rupees = sum(D(r) for *_, r in rupee_slips) + sum((D(l) * hsd_price).quantize(D("0.01"), ROUND_HALF_UP) for *_, l in litre_slips)
credit_litres = sum((D(r) / hsd_price).quantize(D("0.01"), ROUND_UP) for *_, r in rupee_slips) + sum(D(l) for *_, l in litre_slips)
assert credit_rupees == D("550514.80"), credit_rupees
assert credit_litres == D("5411.08"), credit_litres  # matches the notebook's 5,411.08 (rounding up)

ms_tank = real_litres("55.2") - real_litres("53.2")
hsd_tank = real_litres("59.8") + (D("14000") - 28) - real_litres("119.8")
ms_d, ms_p = pr(ms_tank, "224.80")
hsd_d, hsd_p = pr(hsd_tank, "6250.45")
should = D("224.80") * ms_price + D("6250.45") * hsd_price
# D47: dues paid by XtraPower are inside the XtraPower shift total, so they are taken off. Dues paid
# by bank transfer (HDFC ₹3 lakh + ₹3 lakh) come separately: not in any shift total, not taken off.
# That day the whole HDFC ₹6,00,000 was dues, so the shift's Bank transfer total for fuel is ₹0.
payments_in = D("365052") + D("600000")
received = (D("22919.99") - D("36013.04")) + D("55408.10") + D("2560") + D("1003216.67") + credit_rupees + D("27110") - payments_in
write("notebook-2026-09-15", {
    "kind": "day", "source": "Real notebook day: docs/data/notebook/Sept15-daily-report.pdf",
    "description": (
        "The real day of 15 Sep 2026, entered as one shift (the notebook keeps the day total; shift-wise numbers are in the shift notebook). "
        f"MS: 4,536.78 − 4,307.24 = {q(ms_tank)} L by tank vs 224.80 L by meters: {q(ms_d)} L ({q(ms_p)}%); notebook circled −5. "
        f"HSD: 5,074.74 + 13,972 (14,000 minus 28 L short) − 12,749.18 = {q(hsd_tank)} L vs 6,250.45 L: {q(hsd_d)} L ({q(hsd_p)}%); "
        "the notebook circled −75 because it added the full 14,000 L. Money: Should have ₹6,60,664.52; Received = cash in hand ₹22,919.99 − opening cash ₹36,013.04 "
        "+ Paytm ₹55,408.10 + card ₹2,560 + XtraPower ₹10,03,216.67 + credit ₹5,50,514.80 + drawer expenses ₹27,110 − XtraPower dues ₹9,65,052 = ₹6,60,664.52. The HDFC dues (₹6,00,000) came by bank, outside the shift (D47). "
        "Difference 0 because the notebook's cash in hand is the leftover figure, not a count. Nozzles 1 and 2 are not in use."
    ),
    "input": day([tank("MS", "iocl-20kl"), tank("HSD", "iocl-20kl")],
                 [{"tankId": "MS-1", "openingDipCm": "55.2", "closingDipCm": "53.2", "bookStockLitres": "7071"},
                  {"tankId": "HSD-1", "openingDipCm": "59.8", "closingDipCm": "119.8", "bookStockLitres": "9602"}],
                 [shift("A", [
                     nozzle("MS", "1", None, None, in_use=False), nozzle("MS", "2", None, None, in_use=False),
                     nozzle("MS", "3", "126942.71", "127165.97"), nozzle("MS", "4", "29804.03", "29815.57"),
                     nozzle("HSD", "1", None, None, in_use=False), nozzle("HSD", "2", None, None, in_use=False),
                     nozzle("HSD", "3", "567503.44", "570104.08"), nozzle("HSD", "4", "947934.58", "951594.39")],
                     cash_total="22919.99", opening_cash="36013.04",
                     payments=[{"type": "Paytm", "amount": "55408.10"}, {"type": "Card", "amount": "2560.00"},
                               {"type": "XtraPower", "amount": "1003216.67"}, {"type": "Bank transfer", "amount": "0.00"}],
                     slips=slips,
                     tests=[{"nozzleId": "MS-3", "litres": "10"}, {"nozzleId": "HSD-3", "litres": "10"}])],
                 prices=[{"product": "MS", "perLitre": "110.07", "startsOn": "2026-09-01"},
                         {"product": "HSD", "perLitre": "101.74", "startsOn": "2026-09-01"}],
                 date="2026-09-15",
                 tankers=[{"id": "T1", "vehicleNo": "IOCL Jatni", "invoiceNo": "7018875672", "lines": [
                     {"product": "HSD", "tankId": "HSD-1", "orderedLitres": "14000", "shortLitres": "28"}]}],
                 expenses=[{"id": f"E{i}", "type": t, "rupees": r, "paidFrom": "SHIFT_A"} for i, (t, r) in enumerate([
                     ("Tiffin", "160"), ("DG rent", "15000"), ("Staff advance", "100"), ("Staff food", "300"),
                     ("Tanker unloading", "350"), ("Tanker driver food", "200"), ("Cash advance to credit customer", "11000")])],
                 payments=[{"customer": "Bijay Ku Sahoo", "rupees": "300000", "method": "Bank transfer"},
                           {"customer": "Dord Logistics", "rupees": "365052", "method": "XtraPower", "shift": "A"},
                           {"customer": "United Infracorp Ltd", "rupees": "600000", "method": "XtraPower", "shift": "A"},
                           {"customer": "Maa Bhawani Roadlines", "rupees": "300000", "method": "Bank transfer"}]),
    "expected": {
        "products": {"MS": {"soldAsPerTank": q(ms_tank), "meterLitres": "234.80", "testLitres": "10.00", "soldAsPerMeters": "224.80",
                            "difference": q(ms_d), "differencePercent": q(ms_p), "withinLimit": False},
                     "HSD": {"soldAsPerTank": q(hsd_tank), "meterLitres": "6260.45", "testLitres": "10.00", "soldAsPerMeters": "6250.45",
                             "difference": q(hsd_d), "differencePercent": q(hsd_p), "withinLimit": False}},
        "shifts": {"A": {"shouldHave": q(should), "received": q(received), "difference": q(received - should), "withinLimit": True,
                         "creditSlips": "550514.80", "drawerExpenses": "27110.00", "customerPaymentsTakenOff": "965052.00"}},
        "hardErrors": [], "flags": ["S1", "S1"], "isMatched": False}})
assert q(should) == "660664.52" and q(received) == "660664.52"

# D47 on its own: MS 100 L at ₹101 = ₹10,100 should have. Cash ₹5,100 + XtraPower ₹8,000 (of which
# ₹3,000 is a customer's old dues, taken off) = ₹10,100. A ₹50,000 bank-transfer dues payment has no
# shift: recorded, never taken off.
write("day-23-d47-dues-by-method", {
    "kind": "day", "source": "Decision D47",
    "description": "Dues paid by XtraPower are inside the shift's XtraPower total and are taken off; dues paid by bank transfer have no shift and are not taken off. Difference 0.",
    "input": day([tank("MS")], [{"tankId": "MS-1", "openingDipCm": "100", "closingDipCm": "99"}],
                 [shift("A", [nozzle("MS", "A", "5000.00", "5100.00")], cash_total="5100",
                        payments=[{"type": "XtraPower", "amount": "8000"}])],
                 payments=[{"customer": "Dord Logistics", "rupees": "3000", "method": "XtraPower", "shift": "A"},
                           {"customer": "Maa Bhawani Roadlines", "rupees": "50000", "method": "Bank transfer"}]),
    "expected": {"shifts": {"A": {"shouldHave": "10100.00", "received": "10100.00", "difference": "0.00", "customerPaymentsTakenOff": "3000.00"}},
                 "hardErrors": [], "flags": [], "isMatched": True}})
# ─── 7. Business date (shared by app and database) ───────────────────────
write("bizdate-01-business-day", {
    "kind": "businessDate", "source": "PRD F1 + acceptance 19, hard rule 9",
    "description": "A business day runs from the day start (06:00 IST) to the same time next day. Shift C at 02:00 belongs to the previous date.",
    "cases": [
        {"at": "2026-10-01T06:00:00+05:30", "dayStart": "06:00", "businessDate": "2026-10-01"},
        {"at": "2026-10-01T05:59:59+05:30", "dayStart": "06:00", "businessDate": "2026-09-30"},
        {"at": "2026-10-02T02:00:00+05:30", "dayStart": "06:00", "businessDate": "2026-10-01"},
        {"at": "2026-10-01T23:59:00+05:30", "dayStart": "06:00", "businessDate": "2026-10-01"},
        {"at": "2026-10-01T00:30:00Z", "dayStart": "06:00", "businessDate": "2026-10-01"},
        {"at": "2026-10-01T00:29:00Z", "dayStart": "06:00", "businessDate": "2026-09-30"},
        {"at": "2026-10-01T06:30:00+05:30", "dayStart": "07:00", "businessDate": "2026-09-30"},
        {"at": "2027-01-01T03:00:00+05:30", "dayStart": "06:00", "businessDate": "2026-12-31"},
    ]})

print("MS", q(ms_tank), q(ms_d), q(ms_p), "HSD", q(hsd_tank), q(hsd_d), q(hsd_p))
print("written", len(os.listdir(OUT)), "case files")
