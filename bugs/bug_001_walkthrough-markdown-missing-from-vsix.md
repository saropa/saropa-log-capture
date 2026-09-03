# Bug 001 — Getting Started walkthrough steps reference deleted `media/walkthrough/*.md`

## Status: Open

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Severity: High

Every new user's first-run experience. Six walkthrough steps render with no body content in every release since v3.10.0.

## Problem

`package.json` `contributes.walkthroughs[0].steps[*].media.markdown` points at `media/walkthrough/<step>.md`. Those six files were deleted in commit `9f195441` (2026-03-19, first shipped in v3.10.0) and moved to `plans/walkthrough/`. `plans/**` is excluded from the VSIX by `.vscodeignore`, and `package.json` was never updated. The `media/` directory in the repo contains only `codicons/`.

```
package.json:3285  "markdown": "media/walkthrough/session-history.md"
package.json:3293  "markdown": "media/walkthrough/configure-settings.md"
package.json:3304  "markdown": "media/walkthrough/open-viewer.md"
package.json:3315  "markdown": "media/walkthrough/start-debugging.md"
package.json:3323  "markdown": "media/walkthrough/keyboard-shortcuts.md"
package.json:3331  "markdown": "media/walkthrough/about-saropa.md"
```

`.vscodeignore:25` even says `media/walkthrough/` is "actually loaded by the extension" — the comment describes a folder that no longer exists.

## Environment

- Extension version: 3.10.0 through 9.3.12 (current)
- Any VS Code, any OS

## Reproduction

1. Install the extension from the Marketplace (or run F5).
2. Run **Saropa Log Capture: Getting Started** (`saropaLogCapture.openWalkthrough`).
3. Click any step — the step body is empty; only the title and description from `package.json` render.

**Frequency:** Always

## Root Cause

Commit `9f195441 chore(repo): migrate plan docs and expand project index coverage` moved the walkthrough markdown from `media/walkthrough/` into `plans/walkthrough/` as part of a doc consolidation, treating the files as documentation rather than runtime assets. Nothing verifies that `contributes.walkthroughs` media paths resolve at package time, so the break was silent.

## Proposed Fix

1. Move `plans/walkthrough/*.md` back to `media/walkthrough/` (the runtime location). Keep only one copy — `plans/walkthrough/` should not exist.
2. Rewrite the six step bodies while relocating them — they are stale (e.g. `open-viewer.md` says "sidebar viewer", but the view container is contributed to the bottom **panel**; `keyboard-shortcuts.md` should match the current F1 reference).
3. Add `verify:walkthrough-media` to the `npm run compile` verify chain: assert every `media.markdown` / `media.image` path in `contributes.walkthroughs` exists on disk and is not matched by `.vscodeignore`.
4. Update `README.md` "Documentation" table and any links that point at `plans/walkthrough/keyboard-shortcuts.md` (README.md:394).

## Changes Made

<!-- Fill in when a fix is written. -->

## Tests Added

<!-- verify:walkthrough-media script + a test that loads package.json and stats each path. -->

## Commits

<!-- Add commit hashes as fixes land. -->
