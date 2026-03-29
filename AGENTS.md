# Cursor agent navigation (app-store-scraper)

> **Source of truth:** [`.cursor/rules/`](.cursor/rules/) and [`.cursor/skills/`](.cursor/skills/). This file is a **hub** only. There is no **`CLAUDE.md`** in this package — use **[README.md](README.md)** for usage and **[docs/](docs/)** for deeper references.

## Rules

**Sync shared rules:** With **`mac-ai`** checked out as **`../mac-ai`** (same parent as this repo), run **`npm run cursor-rules:sync`** so **`.cursor/rules/`** gets symlinks to canonical **`mac-ai`** rules.

- **`alwaysApply: true` (from `mac-ai`):** `engineering-principles.mdc`, `documentation-maintenance.mdc`, `ai-guidelines.mdc`, `test-and-code-fixes.mdc`
- **`globs` (from `mac-ai`):** `typescript-standards.mdc`
- **`alwaysApply: true` (local):** [`.cursor/rules/project-standards.mdc`](.cursor/rules/project-standards.mdc) — scraper-specific stack, Zod, security, **`docs/`** conventions
- **Tests (`globs`, local):** [`.cursor/rules/testing.mdc`](.cursor/rules/testing.mdc) — Vitest patterns (test-vs-code: **`test-and-code-fixes.mdc`** after sync)

## Skills

- [`.cursor/skills/review-changes/SKILL.md`](.cursor/skills/review-changes/SKILL.md)
- [`.cursor/skills/typescript-conventions/SKILL.md`](.cursor/skills/typescript-conventions/SKILL.md)
- [`.cursor/skills/pragmatic-rating/SKILL.md`](.cursor/skills/pragmatic-rating/SKILL.md)

## See also

- **[README.md](README.md)** — install, API overview, links to **CHANGELOG** and **docs/**.
