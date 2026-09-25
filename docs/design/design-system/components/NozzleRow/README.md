The key entry component. One **64px** row per nozzle, 4 columns worth of data in three grid cells (78px | 1fr | 92px, 8px gaps) so **8 nozzles + 2 group headers fit in about 590px on a 390px screen**.

- **Left:** product `tag` (HSD/MS tint) + nozzle letter, and the **opening** in `caption` `text-muted` underneath ("Open 48,210.50"). Opening is locked; an "edit" action requires a reason, after which the row shows an amber **edited** tag.
- **Middle:** big **Closing** input, 48px tall, `number-input` 24/32, right-aligned. This is the only field the user types.
- **Right:** **Sales L** in an `auto-field-bg` cell, `number-inline`. Shows `—` until closing is valid.

**Error (H1):** row gets `danger-subtle` fill, closing field 2px `danger`, message below "Closing can't be less than opening" at 16px. Sales stays `—`.

Group with a `surface` header row: "HSD · ₹90.00/L". Keep the numeric keypad open and move focus to the next Closing on "Next".