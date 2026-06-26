# Bug 002 — Opening the project in VS Code hangs the window (CPU 100%) — 16 GB `.vscode-test` crawled by the file watcher

## Status: Fixed

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

Opening the `saropa-log-capture` folder in VS Code spikes CPU to 100% and the
window becomes unresponsive ("dying") — killing VS Code is the only way out. The
project effectively cannot be opened.

## Environment

- Extension version: 9.0.6
- OS: Windows 11

## Reproduction

1. Open the `saropa-log-capture` folder in VS Code.
2. Window load pins a CPU core at 100% and hangs.

**Frequency:** Always (once the cache below has accumulated)

## Root Cause

The `.vscode-test/` directory holds **179,824 files / 16.3 GB across 26 complete
VS Code installations** (each a full ~200 MB Electron app tree). This is
`@vscode/test-electron` downloading a fresh VS Code build per version exercised
by the test runner and never cleaning up.

`.vscode-test/` **is** gitignored, so it is not committed — but it is **not**
excluded from VS Code's file watcher or search indexer:

- VS Code's default `files.watcherExclude` does not list `.vscode-test`.
- This project's `.vscode/settings.json` defines `files.exclude` /
  `search.exclude` for `out` and `dist` only, and has no `files.watcherExclude`
  at all.

So on folder open, the file watcher and search/TS indexer attempt to crawl all
16 GB / ~180k files across 26 Electron trees. That saturates CPU and makes the
window unresponsive.

(Distinct from Bug 001, which is the F5 `compile` preLaunchTask. This one is
triggered by simply opening the folder, before any launch.)

## Changes Made

Two parts: clear the accumulated cache (immediate relief), and exclude the
directory from watching/search/listing (prevents recurrence when the test runner
re-downloads).

### Part 1 — Delete the stale cache (run with the project closed)

```powershell
Remove-Item -Recurse -Force 'D:\src\saropa-log-capture\.vscode-test'
```

Safe: the directory is gitignored, and `@vscode/test-electron` re-downloads the
single version it needs on the next `npm test`. (Optional: keep only the latest
version instead of deleting all 26.)

### Part 2 — `.vscode/settings.json`: exclude `.vscode-test` from watcher/search/list

Add these keys (alongside the existing `files.exclude` / `search.exclude`):

```json
"files.watcherExclude": { "**/.vscode-test/**": true },
"search.exclude": { "**/.vscode-test/**": true },
"files.exclude": { "**/.vscode-test/**": true }
```

`files.watcherExclude` is the load-bearing one — it stops the watcher from
recursing the cache even after the runner re-downloads. `search.exclude` keeps it
out of search; `files.exclude` hides it from the Explorer tree.

### Part 3 (optional) — keep the cache from regrowing unbounded

Pin the test runner to a single VS Code version (e.g. `stable` only, or one
explicit version in `.vscode-test.mjs` / the `@vscode/test-cli` config) so it
stops accumulating a new ~200 MB install per version. Verify the current test
config before changing — out of scope for the immediate unblock.

## Result

With the cache cleared and `**/.vscode-test/**` watcher-excluded, the folder
opens normally and the watcher no longer crawls multi-gigabyte test binaries.

## Tests Added

None — developer-environment (`.vscode` settings + cache cleanup) change, no
runtime code path.

## Commits

<!-- Add commit hashes as fixes land. -->

## Finish Report (2026-06-25)

Implemented the exclusion fix (Part 2) and confirmed the cache (Part 1) was
already trimmed.

- **Part 1 (cache delete):** Already done outside this session. `.vscode-test/`
  now holds a single VS Code install (`vscode-win32-x64-archive-1.126.0`, 907 MB)
  instead of the 26 installs / 16.3 GB described above. No further cleanup needed.
- **Part 2 (settings exclusions):** `files.watcherExclude` for
  `**/.vscode-test/**` was already present in `.vscode/settings.json` (the
  load-bearing key — stops the watcher recursing the cache after the runner
  re-downloads). Added the two remaining keys this session:
  - `search.exclude` → `"**/.vscode-test/**": true` (keeps the installs out of
    search and TS indexing).
  - `files.exclude` → `"**/.vscode-test/**": true` (hides the cache from the
    Explorer tree).
- **Part 3 (version pinning):** NOT done — deliberately out of scope. The test
  config (`.vscode-test.mjs`) sets no `version`, so `@vscode/test-cli` defaults
  to `stable`; the 26-version accumulation came from `stable` rolling forward
  across VS Code releases without `@vscode/test-electron` cleaning up old
  installs. Pinning an explicit version would stop regrowth but freeze the test
  target — a behavior change, left for separate review. The watcher exclude
  already prevents the CPU hang regardless of how many versions accumulate.

No runtime code touched; no CHANGELOG entry (the change is a contributor-only
`.vscode/settings.json` edit that does not ship in the extension bundle).
