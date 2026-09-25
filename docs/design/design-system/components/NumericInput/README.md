Numeric input for every rupee, litre, cm and meter value. Right-align the number, put the unit inside the field (`₹` leads, `L` and `cm` trail) and use `number-input` (24/32 semibold, tabular).

**Consumer provides:** `label`, `value`, `unit`, optional `helper` (label style), `hint` (prefill, e.g. "Last closing 48,210.50", tap fills the field), `error`/`warning` message. Open the numeric keypad; format Indian grouping on blur.

**States:** default (`border-strong`), focused (2px `primary` + halo), filled, error (2px `danger`, message under field at 16px with icon), warning (2px `warning`), disabled (55% opacity, explain why in helper), AUTO (`auto-field-bg`, 1px `border`, lock icon, "auto" tag, never editable).

**Do:** error text says what to fix ("Closing can't be less than opening"). **Don't:** use grey fill on anything the user can type into.