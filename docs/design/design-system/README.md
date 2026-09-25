Use PumpHisaab for a mobile-first (Android + responsive web) app where Indian petrol pump managers and owners enter one business day of fuel, cash and stock data and see, immediately, whether it all matches. The interface is quiet: white space, one teal accent, big numbers, and colour reserved for state.

## Content fundamentals

- Write plain, short, action-oriented English: "Closing can't be less than opening", "HSD short by 42 L. Add a reason to continue." Say what happened, then what to do. No jargon ("Stock variance detected"), no codes, no blame.
- Hinglish belongs to the brand only: the tagline "Sara hisaab ek jagah", and occasionally an empty state or a success toast. Everything a user must act on is English.
- Buttons are verbs: "Save & next section", "Add reason", "Lock day". Sentence case everywhere, no exclamation marks, no emoji.
- Every red or amber state names the next step. A disabled button says why ("Fix 1 error to submit").

## Visual foundations

- **Colour.** `color-primary` (deep teal) is the only accent: primary buttons, active tab, focus, selected chips. `color-saffron` is logo-only, never in UI. Semantic colours are reserved for meaning: `color-success` Matched, `color-warning` Excess / soft alert, `color-danger` Short / hard error. Product tints (`color-hsd`, `color-ms` with their `-tint`) appear only in small tags, price chips and row accents.
- **Text on ground.** Numbers and body use `color-text-primary` on `color-bg`, `color-surface` or `color-auto-field-bg`. Labels use `color-text-secondary`. `color-text-muted` is for hints and placeholders only; never for values, errors or actions. Key numbers and alerts hold 7:1 (AAA) in light; every pair is at least 4.5:1 in both themes. Text on a solid fill uses its `color-on-*` token.
- **Never rely on colour alone.** Variance always shows a sign, an icon and a word (Short / Excess / Matched). Status pills and calendar cells pair colour with icon and outline.
- **Inputs vs autos.** Anything the user types sits on `color-bg` with a 1.5px `color-border-strong` edge. Anything the app calculates sits on `color-auto-field-bg` with a lock icon and an "auto" tag and can never be edited.
- **Theme.** Follows the device (light / dark) by default; Profile offers Light / Dark / Auto. Both themes ship every token.
- **Type.** Inter, tabular figures for every number. Use `display` for big totals, `title` for screen titles, `heading` for card titles, `body` for text, `label` for field labels, `number-input` for typed and auto totals, `number-inline` for numbers in rows. Nothing the user must read or tap goes below 16px; `caption` (12) is for non-critical hints only.
- **Spacing and shape.** 4/8 grid: 16px gutters and card padding. `radius-sm` (8) inputs, chips, tags; `radius-md` (12) cards, buttons, banners; `radius-lg` (16) bottom sheets; `radius-full` pills and switches. Tap targets are at least 48px (`tap-min`); primary buttons are 56px, medium buttons 44px with a padded hit area.
- **Elevation.** 1px borders, not shadows. Only the sticky action bar (`shadow-sticky`) and bottom sheets / toasts / select lists (`shadow-sheet`) cast one. No gradients, no decorative illustration inside the app.
- **Layout.** Mobile 390 wide is primary. Entry screens on web stay 480px wide, centred. Primary action lives in a sticky bar at the bottom. On web >= 1024px the bottom nav becomes the 88px left rail.

## Iconography

Lucide outline icons, 1.5px stroke, 20px inline and 24px navigation. Icons sit beside words for status. Do not use emoji or filled icons.

## Number and text formatting

See the "Formatting rules" section. In short: `₹1,50,490.00` in inputs, `₹1,50,490` in summaries, `48,210.50 L`, `123.5 cm`, `01 Oct 2026`, `OD05AB1234`; loss is `−₹1,250` / `−42 L` in red with a true minus, excess is `+₹300` in amber, zero is a green "Matched". Stock variance is displayed as Nozzle L minus Tank L so a leak is negative, like cash.

## Components

Every component has a live preview in light and dark and a README with its states and rules. The key component is `NozzleRow` (64px, 8 rows fit on a 390px screen). Build screens only from these components; if something is missing, add a component here first.
