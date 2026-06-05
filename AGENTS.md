# Cursor agent navigation (app-store-scraper)

> **Source of truth:** [`.cursor/rules/`](.cursor/rules/) and [`.cursor/skills/`](.cursor/skills/). This file is a **hub** only. There is no **`CLAUDE.md`** in this package — use **[README.md](README.md)** for usage and **[docs/](docs/)** for deeper references.

## Rules

**Sync shared rules:** With **`mac-ai`** checked out as **`../mac-ai`** (same parent as this repo), run **`npm run cursor-rules:sync`** so **`.cursor/rules/`** gets symlinks to canonical **`mac-ai`** rules.

- **`alwaysApply: true` (from `mac-ai`):** `engineering-standards.mdc` (includes tests vs production code), `documentation-standards.mdc`, `ai-standards.mdc`
- **`globs` (from `mac-ai`):** `typescript-standards.mdc`
- **`alwaysApply: true` (local):** [`.cursor/rules/project-standards.mdc`](.cursor/rules/project-standards.mdc) — scraper-specific stack, Zod, security, **`docs/`** conventions
- **Tests (`globs`, local):** [`.cursor/rules/testing.mdc`](.cursor/rules/testing.mdc) — Vitest patterns; tests-vs-production posture in **`engineering-standards.mdc`** after sync

## Skills

- [`.cursor/skills/review-changes/SKILL.md`](.cursor/skills/review-changes/SKILL.md)
- [`.cursor/skills/typescript-conventions/SKILL.md`](.cursor/skills/typescript-conventions/SKILL.md)
- [`.cursor/skills/pragmatic-rating/SKILL.md`](.cursor/skills/pragmatic-rating/SKILL.md)
- **OpenSpec (experimental):** [`.cursor/skills/openspec-explore/SKILL.md`](.cursor/skills/openspec-explore/SKILL.md), [`.cursor/skills/openspec-propose/SKILL.md`](.cursor/skills/openspec-propose/SKILL.md), [`.cursor/skills/openspec-apply-change/SKILL.md`](.cursor/skills/openspec-apply-change/SKILL.md), [`.cursor/skills/openspec-sync-specs/SKILL.md`](.cursor/skills/openspec-sync-specs/SKILL.md), [`.cursor/skills/openspec-archive-change/SKILL.md`](.cursor/skills/openspec-archive-change/SKILL.md) — Claude Code mirrors under **`.claude/skills/`** and **`.claude/commands/opsx/`**.

## Slash commands

- [`.cursor/commands/`](.cursor/commands/) — **`opsx-explore`**, **`opsx-propose`**, **`opsx-apply`**, **`opsx-sync`**, **`opsx-archive`** (OpenSpec experimental workflow; config in **`openspec/config.yaml`**).

## See also

- **[README.md](README.md)** — install, API overview, links to **CHANGELOG** and **docs/**.
