# Bug 001 — F5 (Run Extension) pins CPU at 100% and blocks launch on the full `compile` chain

## Status: Fixed

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

Pressing **F5** ("Run Extension") spikes one CPU core from idle to 100% and holds
it there while VS Code shows a modal:

```
Waiting for preLaunchTask 'compile'...
[Debug Anyway] [Configure Task] [Abort]
```

The extension does not launch until the entire `compile` chain finishes; on a
cold run this is long enough that the launch appears hung, and killing the
VS Code window is the only way out.

## Environment

- Extension version: 9.0.6
- OS: Windows 11
- Trigger: the `Run Extension` / `Run Extension in VS Code` launch configs.

## Reproduction

1. Open `saropa-log-capture` in VS Code.
2. Press F5 (Run Extension).
3. CPU jumps to 100% on the task process; the "Waiting for preLaunchTask
   'compile'" dialog stays up until the whole chain completes.

**Frequency:** Always

## Root Cause

Both launch configs in `.vscode/launch.json` use `"preLaunchTask": "compile"`.
The `compile` npm script is a full validate-and-bundle pipeline, run
**sequentially** on every debug launch:

```
generate:db-detector-embed-merge && verify:node-toolchain && check-types
&& lint && verify-nls && verify:nls-coverage && verify:webview-catalog
&& verify:host-outbound-catalog && verify:list-commands && verify:l10n-keys
&& node esbuild.js && verify:dist-size
```

It runs **two full TypeScript passes** (`check-types` and `lint` are both `tsc`),
an embedding-merge generate step, and nine `verify:*` scripts before it ever
bundles. That is correct for a CI / pre-publish gate, but wrong for an
interactive F5: VS Code blocks the launch (`preLaunchTask`) until all of it
exits, and the `tsc` passes alone saturate a core.

Only **two** steps in the chain produce something the launched extension
actually needs:

- `generate:db-detector-embed-merge` — writes the **source** file
  `src/ui/viewer/generated/db-detector-embed-merge.generated.ts`, which the main
  bundle imports. It is a single small esbuild call (fast).
- `node esbuild.js` — produces `dist/extension.js`, the extension entry point.

Everything else (`verify:node-toolchain`, `check-types`, `lint`, `verify-nls`,
`verify:nls-coverage`, `verify:webview-catalog`, `verify:host-outbound-catalog`,
`verify:list-commands`, `verify:l10n-keys`, `verify:dist-size`) is a pure
**check** — it validates, it does not generate any artifact the debug session
loads. None of it needs to run to launch the extension. esbuild does not
type-check, so dropping the `tsc` passes does not affect the produced bundle;
type/lint/verify coverage stays available via `npm run compile` and CI.

## Changes Made

A fast dev-build task that keeps only the two artifact-producing steps, wired as
the `preLaunchTask`. The heavy `compile` script is left untouched for CI /
`npm run package` / manual full validation.

### File 1: `package.json` — add a `dev-build` script

Add one line to `"scripts"` (next to `compile`):

**After:**
```json
"dev-build": "npm run generate:db-detector-embed-merge && node esbuild.js",
```

This regenerates the embedded merge source, then bundles — nothing else.

### File 2: `.vscode/tasks.json` — add a `dev-build` task

Add this task object to the `"tasks"` array (alongside the existing `compile`
task):

**After:**
```json
{
	"label": "dev-build",
	"type": "npm",
	"script": "dev-build",
	"group": "build",
	"problemMatcher": [],
	"presentation": { "reveal": "silent", "panel": "shared" }
}
```

`problemMatcher: []` is intentional — this is a one-shot build, not a background
watcher, so it has no begin/end pattern to match. A failed build still exits
non-zero and VS Code surfaces it before launch.

### File 3: `.vscode/launch.json` — point both configs at `dev-build`

In **both** `"Run Extension"` and `"Run Extension in VS Code"`:

**Before:**
```json
"preLaunchTask": "compile"
```

**After:**
```json
"preLaunchTask": "dev-build"
```

## Result

F5 runs only `generate:db-detector-embed-merge` + `esbuild` — a fast bundle, no
`tsc`, no verify chain — so the launch is near-instant and the CPU spike is
gone. Full validation still runs on demand via `npm run compile` and in CI /
`npm run package`.

## Alternative (not chosen)

The repo already has a `watch` compound task (`watch:esbuild` + `watch:tsc`)
with a background problem matcher. Using `"preLaunchTask": "watch"` would give
incremental rebuild-on-save. It is **not** recommended as the primary fix
because a background-task end-pattern mismatch reproduces the exact
"Waiting for preLaunchTask…" hang this bug is about; the one-shot `dev-build` is
deterministic and cannot hang on matcher detection. Adopt `watch` later if
auto-rebuild during a debug session is wanted.

## Tests Added

None — this is a developer-tooling (`.vscode` / npm script) change with no
runtime code path.

## Commits

<!-- Add commit hashes as fixes land. -->

## Finish Report (2026-06-25)

### Summary

Pressing F5 ("Run Extension") blocked the debug launch behind the full
`compile` pipeline and saturated a CPU core, leaving the modal
"Waiting for preLaunchTask 'compile'…" dialog up until the entire chain
finished. The launch path now runs a minimal `dev-build` that produces only the
two artifacts the debug session loads, so the launch is fast.

### Changes

- `package.json` — added a `dev-build` script:
  `npm run generate:db-detector-embed-merge && node esbuild.js`. It regenerates
  the embedded DB-detector merge source (`src/ui/viewer/generated/db-detector-embed-merge.generated.ts`,
  imported by the bundle) and produces `dist/extension.js`. Nothing else.
- `.vscode/tasks.json` — added a one-shot `dev-build` npm task with
  `problemMatcher: []` (no begin/end pattern to match, so it cannot reproduce
  the background-matcher hang) and silent presentation.
- `.vscode/launch.json` — both launch configs ("Run Extension" and
  "Run Extension in VS Code") changed `preLaunchTask` from `compile` to
  `dev-build`.

### Rationale

esbuild does not type-check, so dropping the two `tsc` passes (`check-types`,
`lint`) does not change the produced bundle. The nine `verify:*` steps and the
toolchain check are pure validation — they generate no artifact the debug
session loads. The full `compile` script is left untouched for CI,
`npm run package`, and manual full validation.

### Verification

`npm run dev-build` was run: it regenerated the merge source and completed the
esbuild bundle (`[watch] build finished`) with no `tsc` or verify chain.

### Tests

None. Developer-tooling change (`.vscode` config + npm script) with no runtime
code path. A grep of `test/` found no coverage tied to `launch.json`,
`tasks.json`, or the `compile`/`dev-build` scripts.
