# Bug 003 — Workspace-wide: VS Code hangs on open when it crawls oversized directories; detection + prevention across `D:\src`

## Status: Documented (prevention actions listed; per-project guards not yet applied)

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Scope

This is an **environment / workspace-hygiene** bug, not a runtime defect in any
one extension. It is filed here because the triggering incident was this
project's 16 GB `.vscode-test` cache (see [Bug 002](../plans/history/2026.06/2026.06.25/bug_002_vscode-test-cache-hangs-window-on-open.md)).
It catalogs every project under `D:\src` that can hit the same class of failure,
and how to stop it at the source.

## Problem

When VS Code opens a folder it sets up a file watcher and search/TS index over
the **entire** tree, minus a short list of default excludes (`node_modules`,
`.git`, a few others). Any other directory that grows very large is crawled in
full on every open. Past a few gigabytes / tens of thousands of files this pins
a CPU core at 100% and the window becomes unresponsive — it looks like the
project "won't open."

The acute instance: `@vscode/test-electron` downloads a **complete ~200 MB
VS Code build per version** into `.vscode-test/` and never removes old ones. In
this project it reached **16.3 GB / 179,824 files across 26 version installs**,
which froze the window on open.

## Root Cause (the class, not just the instance)

1. **Unbounded growth at the source.** `@vscode/test-electron` (and
   `@vscode/test-cli`) cache a full editor per version under `.vscode-test/`
   with no cleanup. Each new VS Code release exercised by tests adds ~200 MB +
   thousands of files. Nothing prunes it.
2. **No watcher exclusion.** `.vscode-test/` is gitignored (so it is not
   committed) but is **not** in VS Code's default `files.watcherExclude`, nor in
   most projects' `.vscode/settings.json`. Gitignore stops commits; it does
   **not** stop the file watcher. So the watcher recurses the whole cache.
3. **Generalizes to any large dir.** The same crawl cost applies to large build
   outputs, generated blobs, report archives, and example/asset trees that are
   not watcher-excluded.

## Detection (reproducible)

Run from PowerShell. **Scan A** — projects that use the VS Code test downloader
and whether they are guarded:

```powershell
$roots = Get-ChildItem 'D:\src' -Directory
foreach ($r in $roots) {
  $pkg = Join-Path $r.FullName 'package.json'; if (-not (Test-Path $pkg)) { continue }
  $praw = Get-Content -Raw $pkg
  if ($praw -notmatch '@vscode/test-(electron|cli)') { continue }
  $sj = Join-Path $r.FullName '.vscode\settings.json'
  $guard = (Test-Path $sj) -and (Select-String $sj -Pattern 'watcherExclude' -SimpleMatch -Quiet) `
                            -and (Select-String $sj -Pattern 'vscode-test'   -SimpleMatch -Quiet)
  '{0,-26} watcherExclude:{1}' -f $r.Name, $(if($guard){'yes'}else{'NO - RISK'})
}
```

**Scan B** — any directory > 1 GB that VS Code would crawl on open (excludes
`node_modules` / `.git`):

```powershell
foreach ($r in Get-ChildItem 'D:\src' -Directory) {
  foreach ($k in Get-ChildItem $r.FullName -Directory -Force -EA SilentlyContinue |
                 Where-Object { $_.Name -notin 'node_modules','.git' }) {
    $sum = (Get-ChildItem $k.FullName -Recurse -File -Force -EA SilentlyContinue | Measure-Object Length -Sum).Sum
    if ($sum -gt 1GB) { '{0,9:N2} GB  {1}' -f ($sum/1GB), $k.FullName.Replace('D:\src\','') }
  }
}
```

## Findings (scan date 2026-06-25)

### A. VS Code test-downloader projects

| Project | Uses | `.vscode-test` gitignored | watcherExclude guard | Status |
|---|---|---|---|---|
| `saropa-log-capture` | `@vscode/test-electron` | yes | **yes** | Fixed (Bug 002) |
| `vscode-versionlens-master` | `@vscode/test-electron` | yes | **NO** | **AT RISK — same failure mode** |

`vscode-versionlens-master` has a `.vscode/settings.json` but no
`**/.vscode-test/**` watcher exclusion. Its `.vscode-test` is currently absent
(tests not run lately); the first test run will start the same accumulation, and
opening the folder while it is large will hang exactly as this project did.

### B. Other directories > 1 GB crawled on open

| Size | Path | Kind |
|---|---|---|
| 4.36 GB | `contacts\blobs` | generated/test blobs |
| 3.60 GB | `contacts\reports` | report archive |
| 2.91 GB | `contacts\build` | Flutter build output |
| 3.37 GB | `saropa_radiance_vector\game` | asset/build tree |
| 2.19 GB | `saropa_kykto\build` | Flutter build output |
| 1.58 GB | `web.app.dotnet\Saropa` | .NET build/bin/obj |
| 1.32 GB | `saropa_bangers\build` | Flutter build output |
| 1.23 GB | `saropa_drift_advisor\example` | example app tree |
| 1.14 GB | `saropa_lints\build` | Dart build output |

These are **secondary** (1–4 GB, not the 16 GB / 180k-file Electron case) and the
projects appear to open today, but each adds watcher/index load and should be
excluded. `build/` is the most common — VS Code does not exclude it by default.

## Prevention

### 1. Guard every test-downloader project (stops the hang) — do this for `vscode-versionlens-master`

Add to that project's `.vscode/settings.json` (inside the top `{`):

```json
"files.watcherExclude": { "**/.vscode-test/**": true },
```

Apply it safely (closes-the-file-then-inserts once after the opening brace, and
will not double-insert):

```powershell
$p = 'D:\src\vscode-versionlens-master\.vscode\settings.json'
$lines = Get-Content $p | Where-Object { $_ -notmatch 'vscode-test' }
$done = $false
$out = foreach ($l in $lines) {
  $l
  if (-not $done -and $l.Trim() -eq '{') { '  "files.watcherExclude": { "**/.vscode-test/**": true },'; $done = $true }
}
Set-Content -Path $p -Value $out -Encoding utf8
```

### 2. Stop the 16 GB at the source (stops the growth)

Watcher-excluding hides the cache from VS Code but it still consumes disk. To
keep it bounded:

- **Pin the test runner to one VS Code version** instead of letting it fetch a
  new build per version (in `@vscode/test-cli` config / `.vscode-test.mjs`, or
  the `version` passed to `runTests`). One install instead of 26.
- **Prune after the run** — a `posttest` step or CI cleanup that deletes
  `.vscode-test` (or keeps only the latest), so it never accumulates:
  `Remove-Item -Recurse -Force .\.vscode-test` after the suite.

### 3. Exclude large build/output dirs (reduces watch load)

For each project in Finding B, confirm the dir is gitignored and add it to that
project's `files.watcherExclude`, e.g. `"**/build/**": true`,
`"**/reports/**": true`, `"**/blobs/**": true`. Lower priority than item 1.

### 4. Optional standing detector

Scans A and B above can be saved as a Python hygiene script run periodically (or
in CI) to flag any project whose crawlable footprint crosses a threshold before
it becomes a hang. Not built yet — raise if wanted.

## Per-project action checklist

- [ ] `vscode-versionlens-master` — add `files.watcherExclude` for
      `**/.vscode-test/**` (command in Prevention 1). *Other project — user must
      apply; cannot be edited from here.*
- [x] `saropa-log-capture` — `.vscode-test` pruned at the source (Prevention 2).
      A `posttest` step keeps only the newest install after every `npm test`,
      so the 16 GB cannot rebuild. The `**/.vscode-test/**` watcher exclusion
      from Bug 002 is already in `.vscode/settings.json`.
- [ ] Finding-B projects — watcher-exclude their large `build`/`reports`/`blobs`
      dirs (Prevention 3). *Other projects — user must apply.*

## Note on ownership

These edits live in other repos under `D:\src`. They are listed here as a
catalog with ready-to-run commands; each must be applied in its own project —
this document does not modify them.

## Commits

<!-- Add commit hashes as guards land. -->

- `c723769d` — saropa-log-capture: `posttest` prune of stale `.vscode-test`
  installs (Prevention 2).

## Finish Report (2026-06-25)

**Scope of this implementation pass:** only the `saropa-log-capture` portion of
the catalog. The other rows (`vscode-versionlens-master`, the Finding-B
projects) live in separate repos and are deliberately left to ready-to-run
commands in the Prevention sections above — they are not edited from here.

**What landed (this project):**

- New `posttest` lifecycle step,
  [prune-vscode-test-cache.mjs](../scripts/modules/test/prune-vscode-test-cache.mjs),
  runs after every `npm test` and removes all but the newest
  `vscode-…-archive-<version>` install under `.vscode-test/`. This bounds the
  cache to a single ~200 MB build instead of accumulating one per VS Code
  release (the unbounded growth that reached 16.3 GB / 179,824 files and froze
  the window on open in Bug 002). `extensions/` and `user-data/` are never
  touched; the script is a no-op when `.vscode-test/` is absent or holds one
  install.
- `package.json` scripts: added `posttest` (auto) and `prune:vscode-test`
  (manual; `--dry-run` previews without deleting).
- Pruning was chosen over pinning a single VS Code version: pinning would stop
  the project ever testing against current stable, whereas pruning keeps testing
  against whatever `@vscode/test-cli` downloads while still bounding disk to one
  install.

**Verified:** dry-run against the live cache (one install present) reports
nothing to prune; dry-run with two injected older-version dirs correctly keeps
`1.126.0` and marks `1.105.0` + `1.99.0` for removal.

**Already in place (Bug 002):** `"files.watcherExclude": { "**/.vscode-test/**":
true }` in `.vscode/settings.json` — the watcher exclusion that stops the crawl;
this pass adds the growth bound the watcher exclusion does not provide.
