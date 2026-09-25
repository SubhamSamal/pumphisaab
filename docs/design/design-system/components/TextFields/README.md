Non-numeric fields, 48px tall, 18px text. Vehicle numbers are forced to uppercase and use slashed zeros (`font-feature-settings: "zero"`) so `0` never reads as `O`.

**Date field:** shows `01 Oct 2026`, calendar icon at the right, opens the native date picker; default today.

**Searchable select:** type to filter, matches highlighted in `primary`. The last option is always **"+ Add new "<typed text>""** in `primary-subtle`, so a new credit customer is one tap. Lists use `shadow-sheet`.