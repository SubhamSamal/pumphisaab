One card per day section on **Today**. 72px min height, title `heading`, subtitle `label` in `text-secondary`, status at the right, chevron last.

| State | Status marker | Meaning |
|---|---|---|
| Not started | red dot | Nothing entered. |
| In progress | amber dot | Some fields missing. Subtitle says what ("1 of 2 tanks entered"). |
| Done | green tick in a solid circle | Complete, no errors. |
| Has alerts | red count badge | Open alerts; subtitle names them. |
| Locked | lock icon, muted title, `surface` fill | Not available yet, or day is locked. Subtitle says when it opens. |

Subtitles always say the next step, never just the state.