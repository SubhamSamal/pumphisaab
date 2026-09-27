# PumpHisaab

Sara hisaab ek jagah. Daily entry and same-day matching for Indian petrol pumps.

- Rules for anyone (or any AI) working here: [CLAUDE.md](CLAUDE.md)
- Start here in a new session: [docs/HANDOFF.md](docs/HANDOFF.md)
- What we're building: [docs/PRD-PumpHisaab-v1.1.md](docs/PRD-PumpHisaab-v1.1.md)
- Plan and status: [docs/EXECUTION.md](docs/EXECUTION.md)
- Decisions log: [docs/decisions.md](docs/decisions.md)
- Learnings and KT (how the pump really works): [docs/learnings.md](docs/learnings.md)
- Design (visual source of truth): [docs/design/](docs/design/)

## Run it

```bash
npm install
npm start
```

`npm start` is for **Expo Go** (iPhone) and the web: scan the QR code with the iPhone Camera, or press `w`.
`npm run start:android-app` is for **our own Android development app** (installed from the EAS link).
The app needs a `.env` file with the Supabase URL and public key (see `.env.example`).
