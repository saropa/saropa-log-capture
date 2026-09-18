# Bug 047 — Suite silent-sibling check nags about Drift Advisor in workspaces that don't use Drift

## Status: Fixed (pending review)

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Severity: Low

Anyone with both Log Capture and Saropa Drift Advisor installed hits this in every workspace that has no Drift dependency, which is most of them. Nothing breaks, but the toasts are noise, and the second one tells the user to start a Drift debug session in a project that doesn't use Drift.

## Problem

On activation, `maybeNotifySilentSiblings` treats Drift Advisor as "installed but silent" whenever `.saropa/diagnostics/advisor.json` is missing. That file can only exist in a Drift project, so in any other workspace Advisor is always reported as silent. Log Capture then does two things:

1. **Self-wire refresh:** it runs `driftViewer.writeDiagnosticsMirror` with no arguments. Advisor treated that as a person running the command, so it showed its own warning:

   ```
   Could not write the diagnostics mirror — is the Drift debug server running and a workspace folder open?
   ```

   Drift Advisor fixed its side in `saropa_drift_advisor` commit `cf95fb9`: in a non-Drift workspace the command now returns `false` and shows no toast. It also accepts `{ silent: true }` and returns whether it wrote the mirror.

2. **Guidance notice:** Advisor is still silent after the refresh, so Log Capture shows `msg.suiteSilentAdvisor` once per (tool, cause):

   ```
   Saropa Drift Advisor is installed but has not shared any data yet. Start a Drift debug session so it can analyze your database, and its findings will appear here.
   ```

   This is still wrong in a non-Drift workspace. There is no database to analyze, so the advice can't be followed. The once-gate is stored in `globalState`, so it fires in the first non-Drift workspace and then stays suppressed everywhere, including real Drift projects where the advice would have helped.

## Reproduction

1. Install Saropa Log Capture and Saropa Drift Advisor.
2. Open a workspace whose `pubspec.yaml` has no `drift:` dependency, or that has no `pubspec.yaml` at all.
3. Let Log Capture activate.
4. Before Advisor's fix: Advisor's "Could not write the diagnostics mirror" warning appears. After the fix: only Log Capture's "installed but has not shared any data yet" notice appears, once.

**Frequency:** Always (the first time in each fresh profile, because of the once-gate)

## Root Cause

`readSiblingConnection` in `src/modules/diagnostics/suite-connection-status.ts` (around line 55) decides between `silent` and absent using only `vscode.extensions.getExtension(...)`, meaning "is it installed". It never asks whether this workspace could produce Advisor data at all. So in a non-Drift workspace, where the mirror never exists, Advisor is always classified `silent` with cause `noMirror`.

`tryRefreshSilent` in `src/modules/diagnostics/suite-silent-notice.ts` (lines 62–77) then runs `driftViewer.writeDiagnosticsMirror` with no arguments. It gives Advisor no signal that the call is automated, so Advisor's user-facing toasts can fire.

## Proposed Fix

1. **Treat Advisor as not applicable in a non-Drift workspace.** Before classifying Advisor as `silent`, check the workspace root's `pubspec.yaml` for a `drift:` or `saropa_drift_advisor:` dependency. That is the same test Advisor uses: `isDriftProject` / `workspaceUsesDrift` in Advisor's `extension/src/diagnostics/dart-file-parser.ts`. If neither is present, treat Advisor like an uninstalled sibling: no refresh and no notice.
2. **Call the refresh silently.** In `tryRefreshSilent`, pass the option and use the result:

   ```typescript
   const wrote = await vscode.commands.executeCommand<boolean>(command, { silent: true });
   ```

   Older Advisor versions ignore the argument and return `undefined`, so keep the existing re-read of the connections as the source of truth.
3. **Optional:** key the once-gate per workspace (`workspaceState`), or include the workspace in the key. A notice suppressed in an unrelated project then won't hide it in a Drift project where it is actionable.

## Changes Made

- Added a `notApplicable` connection state to `ConnectionState` (`src/modules/diagnostics/suite-connection-classify.ts`) and a pure `workspaceUsesDrift(dependencyNames)` helper that checks for a `drift` or `saropa_drift_advisor` pubspec dependency.
- `readSiblingConnection`/`readSuiteConnections` (`src/modules/diagnostics/suite-connection-status.ts`) now take an optional workspace `rootUri`. When given and the tool is `advisor`, the workspace's `pubspec.yaml` (via the existing `readPubspecDependencies`) is checked; if it declares no Drift dependency, Advisor is reported `notApplicable` instead of reading/classifying its mirror — no refresh, no notice.
- `maybeNotifySilentSiblings` (`src/modules/diagnostics/suite-silent-notice.ts`) now passes the first workspace folder's URI through to `readSuiteConnections` on both the initial read and the post-refresh re-read.
- `tryRefreshSilent` now calls the refresh command with `{ silent: true }` so Advisor treats it as an automated self-wire, not a user-run command, and skips its own toasts.
- The once-gate moved from `globalState` to `workspaceState`, so a notice already shown in one workspace no longer suppresses it in a different (e.g. genuinely Drift) workspace.

## Tests Added

- `src/test/modules/diagnostics/suite-connection-status.test.ts`: added unit tests for `workspaceUsesDrift` — no Drift-related dependency → `false`; `drift` dependency → `true`; `saropa_drift_advisor` dependency → `true`; empty dependency set → `false`.

## Commits

<!-- Add commit hashes as fixes land. -->
- `cf95fb9` (saropa_drift_advisor) fix(extension): no mirror warning in workspaces without Drift
