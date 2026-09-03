# Bug 001 — Getting Started walkthrough steps reference deleted `media/walkthrough/*.md`

## Status: Closed

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

1. `git mv plans/walkthrough/*.md media/walkthrough/` — the six step bodies now live only at
   the runtime location `package.json` already pointed at. `plans/walkthrough/` no longer
   exists.
2. Rewrote stale content while relocating:
   - `open-viewer.md` — "sidebar viewer" → "Log Viewer" (the view container is contributed to
     the bottom `panel`, not a sidebar; verified against `package.json`
     `contributes.viewsContainers.panel`).
   - `keyboard-shortcuts.md` — the **A** key description was "Toggle app-only stack frames";
     that action was replaced by the three-way device-log cycle (`toggleDevice` in
     `src/ui/viewer/viewer-keybindings.ts`) — updated to "Cycle device logs (None / Warn+ /
     All)". **Ctrl+C** was documented as "Copy as plain text"; the shipped default is
     `copyJson` (`ctrl+c`) — updated to "Copy as JSON", and added the previously-missing
     **Ctrl+B** bookmark row. Added a comment pointing future editors at the source-of-truth
     files (`viewer-keybindings.ts`, `viewer-keyboard-shortcuts-html.ts`) plus a note that F1
     in the Log Viewer is the always-current reference.
   - `session-history.md` — retention default was documented as 10; the shipped default
     (`saropaLogCapture.maxLogFiles`) is `0` (unlimited) — corrected.
   - `configure-settings.md`, `start-debugging.md`, `about-saropa.md` — verified against
     `package.json` / current behavior; no stale content found, left as-is.
3. Added `scripts/modules/verify/verify-walkthrough-media.mjs`: asserts every
   `contributes.walkthroughs[*].steps[*].media.markdown` / `.image` path in `package.json`
   exists on disk and does not resolve under a directory `.vscodeignore` excludes wholesale
   (e.g. `plans/**`). Wired in as `npm run verify:walkthrough-media`, added to the
   `npm run compile` verify chain.
4. `README.md` already referenced `media/walkthrough/keyboard-shortcuts.md` (line 394) — no
   change needed there; it was pointing at the correct future location all along.

## Tests Added

- `src/test/modules/scripts/walkthrough-media.test.ts` — asserts every walkthrough step's
  `media.markdown` path starts with `media/walkthrough/` and exists on disk, and asserts
  `plans/walkthrough/` does not exist (regression guard against the doc-consolidation pattern
  that caused this bug).
- `scripts/modules/verify/verify-walkthrough-media.mjs` — compile-time gate covering the same
  invariant plus the `.vscodeignore` packaging check; run manually with
  `node scripts/modules/verify/verify-walkthrough-media.mjs` (confirmed passing: "OK (6
  walkthrough media path(s) resolve and ship)").

## Commits

<!-- Add commit hashes once this change is committed. -->
