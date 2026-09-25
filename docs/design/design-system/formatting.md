# Formatting rules

| Thing | Format | Example |
|---|---|---|
| Rupees in inputs | Indian grouping, symbol, 2 decimals | `₹1,50,490.00` |
| Rupees in summaries | Indian grouping, symbol, no decimals | `₹1,50,490` |
| Litres | Up to 2 decimals, space, `L` | `48,210.50 L` |
| Dip | 1 decimal, space, `cm` | `123.5 cm` |
| Loss / short | True minus U+2212, `danger`, icon + "Short" | `−₹1,250`, `−42 L`, `−42 L (−0.52%)` |
| Excess | `+`, `warning`, icon + "Excess" | `+₹300` |
| Zero variance | `success`, tick + "Matched" | Matched |
| Dates | `DD Mon YYYY` | `01 Oct 2026` |
| Vehicle numbers | Uppercase, no spaces, slashed zero | `OD05AB1234` |

Rules: format numbers with one shared helper; use `tabular-nums` everywhere; a hyphen-minus is never used for a negative. Stock variance shown in the UI is Nozzle L minus Tank L (the PRD engine formula Tank minus Nozzle is flipped at display).

Microcopy: plain, short, action-oriented. "Closing can't be less than opening." "HSD short by 42 L. Add a reason to continue." "Shift C has ₹300 extra. Check collections or add a reason." Avoid "Stock variance detected", "Invalid input", error codes.
