# ROADMAP.md reduced to a redirect to the plans folder

**Trigger:** The user first asked whether everything in `ROADMAP.md` was covered by a plan in `plans/` (it was), then asked to "change the roadmap to simply point the the plans folder on github," and finally "no. remove everything except for the redirector." The roadmap's per-row plan-file links were a maintenance burden that broke or went stale on every plan rename, archive to `plans/history/`, or ship.

## Finish Report (2026-06-10)

This work will be reviewed by another AI.

### Scope
(C) docs only — `ROADMAP.md`, `CHANGELOG.md`, `README.md`. No code, scripts, or manifest.

### What changed
- **`ROADMAP.md`** — the entire file (core-features table, scored future-work table, unscored table, known-issues table, footer) was replaced with a heading and one line:
  > Plans live in the [plans folder on GitHub](https://github.com/saropa/saropa-log-capture/tree/main/plans).
  The redirect URL matches `repository.url` in `package.json`; the `plans/` folder exists at repo root.
- **`CHANGELOG.md`** — added one `[Unreleased] › Changed` entry recording the redirect and the reason (per-row plan links broke/staled on rename/archive/ship).
- **`README.md:417`** — the docs-index row describing `ROADMAP.md` said "Links to feature plans and completed work," which is no longer true; changed to "Pointer to the plans folder, where feature plans live."

### Review notes
- No tests reference ROADMAP (grep of `src/test`, zero matches) — nothing to update or run.
- All other `ROADMAP.md` references in the repo are whole-file links, not deep `#anchor` links, so removing the internal sections broke no link. One exception is prose-only: `plans/028_plan-webview-accessibility.md:3` cites "ROADMAP.md §7" as provenance; the §7 anchor no longer exists but the file link resolves. Left untouched — editing active plan bodies is outside this docs task.

### Outstanding
None. No behavior changed; no on-device verification applies.
