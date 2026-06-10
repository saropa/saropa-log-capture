# Relocate watch-list.md and drift-advisor schema into plans/guides/

**Trigger:** User flagged that nine files in `plans/` break the `NNN_` numbering convention ("these docs are unusually named for the /plans/ folder"), then asked which could be moved to `plans/guides/` for reference only. Two qualified by the "documents shipped behavior, not future work" test.

## Finish Report (2026-06-10)

### Scope

(C) docs only. No app code, no extension TypeScript, no tests, no localization touched.

### What changed

Classified the nine un-prefixed `plans/` files into three groups:

1. **Intentional (left as-is):** five integration design docs (`http-network.md`, `application-file-logs.md`, `database-query-logs.md`, `browser-devtools.md`, `security-audit-logs.md`) — `001_integration-specs-index.md:10` references them by bare name as "Long-form design docs (background)". Moving them would break that index line.
2. **Forward-looking plans (left as-is, still need numbering — out of scope here):** `multi-log-mode.md` (Vision + unbuilt Stage 2/3) and `cross-session-analysis.md` ("Status, Roadmap & Ideas").
3. **Reference-only (moved this task):**
   - `watch-list.md` — self-declares "Internal developer reference … for the Keyword Watch feature." Documents a shipped feature; no roadmap.
   - `drift-advisor-session.schema.json` — a file-contract schema; its only live referencer (`plans/guides/integrations.md`) already lives in `guides/`.

### Moves

- `git mv plans/watch-list.md plans/guides/watch-list.md`
- `git mv plans/drift-advisor-session.schema.json plans/guides/drift-advisor-session.schema.json`
- `plans/guides/integrations.md:11` — link repointed from `../drift-advisor-session.schema.json` to same-dir `drift-advisor-session.schema.json`.

### Reference audit

- `watch-list.md`: no live references anywhere except `plans/history/**` (frozen historical record — left untouched).
- schema: only live referencer was `plans/guides/integrations.md` (fixed). `CHANGELOG_ARCHIVE.md:1774` carries a stale link to `plans/integrations/drift-advisor-session.schema.json` — that path never matched the file's real location (it was at `plans/`), so it was already broken before this move; it is a frozen archive entry and was left untouched.

### Not done (deliberately deferred, awaiting user)

- Numbering `multi-log-mode.md` and `cross-session-analysis.md` as `NNN_` plans and adding them to the index. User has not yet approved this; not part of this task.

### Bundled, not mine

The commit also carries pre-existing working-tree changes from another workstream (publish scripts under `scripts/modules/publish/`, `scripts/publish.py`, `plans/052_*.md`, `plans/README.md` deletion, and an unrelated prior edit to `plans/guides/integrations.md`). Bundled per the commit-freely house rule.

### Bug archive

No bug archive — task did not close a `bugs/*.md` file.
