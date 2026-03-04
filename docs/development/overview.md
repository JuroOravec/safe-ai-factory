# Development

## Project layout

```
src/
├── orchestrator/   — Docker-based sandbox loop (modes: fail2pass, start, continue, assess)
├── blackbox/       — Black-box test catalog schema and scaffold generator
├── mastra/
│   ├── agents/     — Blackbox Planner, Catalog, PR Summarizer, Spec Arbiter
│   ├── tools/      — Shotgun codebase index tool
│   └── workflows/  — Blackbox design workflow (tests.md + tests.json)
├── validation/     — Deterministic constraint checks (run with pnpm validate)
├── commands/       — Unified CLI entrypoint
└── models.ts       — LLM model registry (OpenRouter)

scripts/commands/   — CLI command definitions (agents, check, validate)
openspec/           — Change proposals, Shotgun plans, and black-box tests
```
