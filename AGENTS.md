# AGENTS.md

This repository uses Phaser, Vite, TypeScript, Express, `@google/genai`, and `@elevenlabs/elevenlabs-js`.

## Read first
- Product behavior: `docs/PROJECT_CONTEXT.md`
- Cross-component integration: `docs/INTEGRATION_CONTRACT.md`

## Rules
- Respect the assigned worktree and component ownership from the task prompt.
- Inspect relevant existing code before editing.
- Keep API keys server-side. Never put secrets in `VITE_` variables or commit `.env`.
- Run relevant checks and `npm run build` when appropriate.
- Do not expand to more rooms before the Bedroom vertical slice works.
- Report changed files, verification performed, and unresolved issues.

## Git policy
- The user owns all staging, commits, merges, and pushes.
- Do not run `git add`, `commit`, `push`, `merge`, `rebase`, `cherry-pick`, `tag`, `reset`, or switch branches unless the user explicitly asks in a later prompt.
- Leave changes uncommitted for review.
- Read-only `git status` and `git diff` are allowed.
