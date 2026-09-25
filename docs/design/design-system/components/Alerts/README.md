Every red or amber state names **what happened** and **what to do next**.

- **Hard error (blocks):** red text with icon under the field, 16px, medium. Never a toast.
- **Soft warning:** amber banner, bold one-line title, one line of context, **Add reason** action. Allows save after a reason.
- **Compliance (R1):** same banner in red with a "View" action.
- **Reason sheet:** bottom sheet, 16px top radius, `shadow-sheet`, scrim. Title repeats the alert, multiline field (auto-focused), 2-4 quick-reason chips, **Confirm reason** (L) disabled until text is entered.