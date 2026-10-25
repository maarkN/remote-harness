# AGENTS.md

Instructions for coding agents working in this repository.

The project instructions live in [`CLAUDE.md`](./CLAUDE.md) (in Portuguese): structure, commands, conventions, security rules, theme and the OpenSpec workflow. Read it first and follow it; this file only points to it so that it isn't duplicated.

Also read:

- [`GLOSSARY.md`](./GLOSSARY.md): the domain language. Use its terms and avoid the ones under _Avoid_; add a term as soon as it is settled.
- [`docs/adr/`](./docs/adr/): architecture decisions. Read the ones that cover the area you change; to go against one, write a new ADR that supersedes it.
- [`apps/mobile/AGENTS.md`](./apps/mobile/AGENTS.md): Expo and React Native rules for the app.
- `openspec/`: numbered changes and specs, always in English (`openspec/config.yaml`).

Before declaring a task done: `pnpm check` (typecheck, tests and Biome; warnings fail).
