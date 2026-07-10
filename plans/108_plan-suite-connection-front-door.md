# 108 Suite connection front door — make the integration discoverable

**Status: Active — scoping (2026-06-14).**
**Why:** The suite integration is wired in code but invisible in practice. It surfaces only when a long
chain of preconditions all align (a Log Capture opt-in on, queries captured, the SQL panel open, a
sibling's `.saropa/diagnostics/<source>.json` written, matching commit), and shows **nothing** when any
link is missing. No real user will assemble that. The fix is not more plumbing — it is detection,
guidance, and self-wiring so a user either sees it working or sees exactly what is missing and the one
action to fix it.

This is the real "make it usable" work that the suite reference guides
([105](105_plan-saropa-suite-integration.md), [107](107_plan-saropa-suite-orchestration.md)) do not
deliver. Treat those as the protocol record; this is the product.

## Goal

A user with the extensions installed never sees silent nothing. They see one of:

1. **Connected** — "Drift Advisor and Lints are sharing data; here is what the three found together."
2. **Installed but silent** — "Lints is installed but hasn't shared anything yet" + the exact cause and
   the one action (enable setting X / run a Drift debug session / nothing-to-do-we-fixed-it).
3. **Not installed** — the existing install prompt (already built).

State 2 is the entire missing piece — it is precisely the state every confused user lands in today.

## What already exists (reuse, do not rebuild)

- [signal-report-ecosystem.ts](src/ui/signals/signal-report-ecosystem.ts) — already checks sibling
  install status via `vscode.extensions` and renders install-prompt vs data states. Extend it with the
  silent state; surface it where the user actually looks, not only in an exported report.
- [drift-advisor-constants.ts](src/modules/integrations/drift-advisor-constants.ts) /
  [saropa-lints-api.ts](src/modules/misc/saropa-lints-api.ts) — the extension ids
  (`saropa.drift-viewer`, the Lints id) and existing cross-extension wiring.
- [suite-mirror-read.ts](src/modules/diagnostics/suite-mirror-read.ts) /
  [envelope-parse.ts](src/modules/diagnostics/envelope-parse.ts) — malformed-safe mirror reading with
  the `commitSha` / `generatedAt` metadata the freshness check needs.
- The once-gated notice pattern in
  [recommend-adapters-notice.ts](src/modules/integrations/recommend-adapters-notice.ts) and
  [nls-coverage-notice.ts](src/l10n/nls-coverage-notice.ts) — reuse for the "don't nag" gating.

## Capability matrix — what Log Capture can fix vs guide

The "we can fix it" promise has real limits; this is the honest split per sibling.

| Sibling mirror | Emitted when | Can Log Capture trigger it? | If not, the guided action |
|---|---|---|---|
| `advisor.json` (Drift Advisor) | while its debug server is up; manual via `driftViewer.writeDiagnosticsMirror` | **Partly** — call that command if registered AND the server is up | "Start a Drift debug session" (no server = no data; Log Capture cannot start it) |
| `lints.json` (Saropa Lints) | on analysis settle | **No manual command known** — see cross-repo ask | "Ensure the Lints analyzer is active for this workspace" / name the gating setting |
| `log-capture.json` (Log Capture, own) | on session end | **Yes — fully ours** | n/a; we guarantee it |

So: Log Capture owns its own emission, can *trigger a refresh* where a sibling exposes a command, and
otherwise **detects + diagnoses + guides**. It cannot run a sibling's debug server or change the app's
behavior, and it must not silently flip another extension's settings — it names the setting and lets
the user enable it.

## The build

1. **Detect three states per sibling** — not-installed / installed-but-silent / emitting-fresh.
   "Silent" = extension present (`getExtension`) but no fresh `.saropa/diagnostics/<source>.json` (absent,
   unparseable, or `commitSha` ≠ HEAD). Pure function over (installed?, mirror metadata, HEAD).
2. **Diagnose the silent cause** (best-effort, in priority order): setting disabled (name the exact
   setting), no debug session run yet, no Dart/Drift in the workspace, stale commit. Each maps to a
   concrete next action.
3. **Front door, made live.** Extend the ecosystem surface to render the silent state with an action
   button, and surface it in the live Signal panel (not only the exported report) so it is visible in
   the normal flow.
4. **Self-wire what we can.** On workspace open / panel focus, read the mirrors and, where a sibling
   exposes a safe refresh command that is registered (Drift Advisor's `writeDiagnosticsMirror`), call it
   so the user never has to. No manual timing, no commit-aligning by hand.
5. **Notify, gated once.** When a sibling is installed-but-silent, show one guided toast naming the
   item and the action ("Saropa Lints is installed but hasn't shared findings — enable `X`" / "Run a
   Drift debug session to populate database issues"), with an Enable / Run / Show-me button where the
   action is ours to offer. Gate per (sibling, cause) so it never nags; re-arm when the cause changes.

## Honest limits (state them in the UI, not just here)

- A missing `advisor.json` because no debug session ever ran is **not** auto-fixable — the toast says so
  and offers the step, it does not pretend to fix it.
- Log Capture names a sibling's gating setting; it does not toggle another extension's config silently.
- Where a sibling has no refresh command, "we can fix it" is false until that command exists (below).

## Cross-repo asks (bug reports, not edits from here)

- **Saropa Lints** likely needs a `saropaLints.writeDiagnosticsMirror` (or equivalent) command so Log
  Capture can trigger a `lints.json` refresh on demand, the way Drift Advisor's
  `writeDiagnosticsMirror` allows. File as a feature request in `saropa_lints/bugs/`.
- Confirm each sibling documents which setting gates its emission, so the diagnose step names the right
  one rather than guessing.

## Scope boundary

Log Capture only. Detection, the live front door, self-wiring via existing sibling commands, and the
guided notifications are all built here with the metadata already on disk. Anything requiring a sibling
to expose a new command or change behavior is a bug report into that repo.

## Test plan

- **Unit (pure):** the three-state classifier (installed × mirror metadata × HEAD → state + cause);
  fixtures for each state and each silent cause; stale-commit → silent.
- **Render:** the ecosystem surface renders all three states with the right action; never throws on
  absent/malformed mirror.
- **Gating:** the notice fires once per (sibling, cause), suppresses on repeat, re-arms when the cause
  changes — reuse and test against the existing gated-notice pattern.
- **Self-wire:** when Drift Advisor is installed and its refresh command is registered, the refresh is
  invoked; when absent, it is skipped silently and the guided action is shown instead.

## Explicitly not this plan

Not relabeling, not the old per-feature silent plumbing, and not a developer diagnostics screen — this
is the user-facing front door plus the self-wiring that the integration needed to be real.

---

## Finish Report (2026-06-14)

### What shipped

The suite integration was invisible: it surfaced only when a long chain of preconditions aligned and
rendered nothing otherwise, leaving an installed companion tool with no explanation and no way in. The
front door, the self-wiring, and the package-based suggestions that make it discoverable now exist.

**Connection state machine.** `src/modules/diagnostics/suite-connection-classify.ts` is a pure
classifier (no fs, no vscode) returning `notInstalled` / `silent` (cause `noMirror` or `stale`) /
`connected` for each sibling, judging staleness only when both the mirror commit and the current
commit are known. `suite-connection-status.ts` is the thin impure reader that resolves installation
(`vscode.extensions.getExtension`) and the mirror metadata and defers to the classifier.

**Installed-but-silent notice.** `suite-silent-notice.ts` runs on activation: it reads the
connections, tries to make a silent tool emit (self-wiring — `vscode.commands.executeCommand` of Drift
Advisor's `driftViewer.writeDiagnosticsMirror` when that command is registered), and only if the tool
is still silent shows one guided `showInformationMessage` naming the concrete next step. Gated per
(tool, cause) in `globalState`, so it never nags and re-arms when the cause changes; evidence-based, so
a tool the user has not installed is never mentioned. Wired in `extension-activation.ts` next to the
NLS-coverage notice.

**Integrations front door.** A dedicated Integrations icon (`ib-integrations`, codicon-plug) was added
to the activity bar with the existing badge machinery. Clicking it opens the Options slide-out and
switches to the existing Integrations view (`openIntegrationsView`), then refreshes. The host
(`requestSuiteIssues` → `suiteIssues`) returns a combined payload: the companion-tool issues block
(`suite-issues-html.ts`, read from `advisor.json` / `lints.json`, silent tools rendering their guidance
line) and the suggested-integrations block (`suite-suggestions-html.ts`, reading `pubspec.yaml` /
`package.json` through the existing `suggestAdaptersFromPubspec` / `suggestAdaptersFromPackageJson`
tables, dropping already-enabled adapters, filtering `adbLogcat` without an Android app). The icon
badge counts issues + suggestions, so it surfaces whenever there is anything to act on. Each suggestion
row carries an Enable button that checks the corresponding integration checkbox and fires its `change`
event, reusing the established `setIntegrationsAdapters` persistence, then refreshes.

All host-built HTML escapes every dynamic value (`escapeHtml`); the webview injects it via `innerHTML`,
matching the other host-rendered panels.

### Honest gaps

- The classifier's `stale` branch is implemented and unit-tested, but the impure callers
  (`readSuiteConnections`, the two HTML builders) do not yet pass a current HEAD commit — no live-HEAD
  resolver exists in this repo (`getSessionCommit` reads session metadata, not HEAD). So only
  `notInstalled` / `silent(noMirror)` / `connected` are active in practice; `stale` is future-wired
  pending a HEAD resolver.
- `suite-silent-notice.ts` and `suite-issues-html.ts` can refresh Drift Advisor on demand
  (`writeDiagnosticsMirror`), but Saropa Lints contributes no manual mirror-refresh command, so a silent
  Lints is guided, not auto-fixed. Tracked as the cross-repo ask in this plan's "Cross-repo asks".
- The badge counts opt-in suggestions alongside found issues — a deliberate discoverability choice, not
  a defect; the screen separates the two into labelled sections.

### Verification

- `npm run check-types` — clean.
- `npm run compile` — full gate green: webview incoming + host-outbound catalogs regenerated and match,
  contributed-commands reference matches, `verify:l10n-keys` resolves all 2308 keys, dist size within
  ceiling.
- ESLint on every touched source file — clean (the one pre-existing `max-lines` warning on
  `viewer-script-messages.ts` is unrelated; the change to that file is net-zero lines — the script
  concat moved to the `viewer-script.ts` assembly point to avoid growing it).
- Unit tests: 7 new pure cases in `suite-connection-status.test.ts` (classifier across all states and
  the never-guess-stale guards) — pass under `node --test`.
- `viewer-icon-bar.test.ts` extended so the new icon is covered by the action-oriented-tooltip
  assertion; not executed headlessly (Mocha/Extension-Host suite), verified by inspection — the new
  icon's title matches the asserted `Click to open/close` prefix and `getIconBarHtml` includes it.

### Verification not done

The webview behavior — the badge painting the count, the Integrations screen rendering the suggestions
and issues blocks, the Enable button toggling the checkbox and persisting — cannot be confirmed from a
headless environment. It requires loading the extension in the Extension Development Host against a
project where the siblings have written their mirrors. This is the one manual-verification item.

### Plan status

Plan retained **active**. The Log-Capture code scope is complete, but the plan's done-criteria include
end-to-end visual verification (above) and depend on the cross-repo Lints refresh-command ask; both
remain, and this document is the tracker for them.

Bug archive: none — the related `bugs/suite_mirror_status_and_sync.md` was superseded (its Part A
status-strip was deliberately not built; the integration took the Integrations-screen form instead) and
is retained as a reference note, not closed as a fixed bug.

Finish report appended: plans/108_plan-suite-connection-front-door.md

---

## Finish Report — follow-up (2026-06-14): stale path live + broader detection

### What shipped

Two follow-ups to the Integrations front door, closing the first item in the "Honest gaps" section
above (the `stale` branch was implemented and unit-tested but dormant — no live-HEAD resolver existed,
so only `notInstalled` / `silent(noMirror)` / `connected` were active in practice).

**Current-HEAD resolver — `stale` activated.** A companion tool's shared diagnostics carry the
`commitSha` they were captured at; surfacing a mirror from an earlier commit as current would mislead.
`workspace-head-commit.ts` now resolves the workspace's current HEAD by reading `.git` directly — no
git process spawned — following a detached HEAD to its object id, or a symbolic ref to its loose ref
file and then `packed-refs`. It returns `undefined` on any failure (missing `.git`, a worktree or
submodule where `.git` is a file, an unreadable ref), so a consumer never guesses staleness when the
commit is unknown. The parsing (`parseHeadRef`, `findPackedRef`, `isObjectId`) is split into the pure
`workspace-head-commit-parse.ts` so it runs under `node --test`. `suite-silent-notice.ts` now passes
the resolved HEAD to the classifier (a mirror at a different commit triggers the stale guidance), and
`suite-issues-html.ts` marks a tool's section "(from an earlier commit)" — new l10n key
`viewer.integrations.suiteStale`, CSS `.suite-issue-stale` — when its mirror commit differs from HEAD.

**Broader package detection.** `adapter-recommendations.ts` gained ~30 dependency mappings to the
existing eight adapter ids — SQL clients and ORMs (`floor`, `postgres`, `sqlite_async`,
`mysql1`/`mysql_client`, `drift_dev`, `mariadb`, `mssql`, `tedious`, `oracledb`, `drizzle-orm`,
`kysely`, `pg-promise`, `@prisma/client`, `redis`, `ioredis`, `cassandra-driver`), HTTP clients
(`graphql`, `graphql_flutter`, `superagent`, `ky`, `cross-fetch`, `request`), test tooling (`mockito`,
`mocktail`, `bloc_test`, `patrol`, `jasmine`, `tap`, `uvu`), and browser automation (`webdriverio`,
`nightwatch`, `testcafe`). No new adapter ids were introduced. Coverage tools (`nyc`/`c8`) and Sentry
were deliberately not mapped — their output is a different input format than the existing Coverage and
Crashlytics adapters consume, so a mapping would point users at the wrong adapter.

### Verification

- `npm run check-types` — clean.
- `npm run compile` — full gate green: webview catalogs, contributed-commands reference,
  `verify:l10n-keys` (2309 keys resolve), dist size within ceiling.
- ESLint on every touched source file — clean.
- Pure unit tests under `node --test`: `workspace-head-commit.test.ts` (5 cases — symbolic ref,
  detached HEAD, garbage, packed-ref lookup, peeled-tag skip) and `suite-connection-status.test.ts`
  (7 cases) pass together (12/12).
- `adapter-recommendations.test.ts` extended with `deepStrictEqual` assertions pinning the new
  mappings (e.g. `floor`→`['database']`, `drift_dev`→`['database','driftAdvisor']`,
  `webdriverio`→`['browser']`); it imports `INTEGRATION_ADAPTERS` (which loads `vscode`) so it runs in
  the Extension Host, not headlessly — its new assertions were audited against the table by inspection
  and match exactly.

### Remaining (plan stays active)

- End-to-end visual verification in the Extension Development Host — the badge count, the Integrations
  screen rendering the suggestions and issues blocks, the stale "(from an earlier commit)" label, and
  the Enable button toggling a checkbox — still requires loading the extension against a project where
  the siblings have written mirrors at a differing commit.
- The cross-repo ask for a Saropa Lints manual mirror-refresh command (so a silent Lints can be
  auto-refreshed rather than only guided) is unchanged.

Finish report appended: plans/108_plan-suite-connection-front-door.md

## Owner ruling (2026-07-09): issues block removed from the Integrations screen

The "Issues found by your companion tools" block and its share of the icon badge were REMOVED.
Ruling: **the Options screen is for toggles only** — it is a configuration surface, not a
diagnostics feed. The block rendered every raw diagnostic from the sibling mirrors (Drift Advisor
statistical outliers, Saropa Lints HACK markers) with no severity gate and no cap, which read as
noise, not signal. Companion findings belong in the tools' own UIs and the signal report's
ecosystem section (`signal-report-ecosystem.ts`), which summarizes instead of dumping rows.

What was removed / kept:

- REMOVED: `suite-issues-html.ts` (host builder), the `integrations-suite-issues` container,
  the `.suite-issue-*` CSS, and the five `viewer.integrations.suite*` l10n keys.
- RENAMED: the message pair `requestSuiteIssues` → `suiteIssues` became
  `requestSuiteSuggestions` → `suiteSuggestions`; the webview script is now
  `viewer-suite-suggestions-script.ts` (`getSuiteSuggestionsScript`). Catalogs regenerated.
- KEPT: the Integrations icon (shortcut to the Integrations screen), the badge (now counting only
  pending integration suggestions), the suggested-integrations block with its Enable buttons, the
  companion install rows, and the silent-tool notification flow (`suite-silent-notice.ts` —
  a notification, not an Options-screen surface, so unaffected).

**Do not re-add a diagnostics list to any Options view.** If cross-tool findings need a surface
later, propose it as its own panel or extend the signal report — never the Options panel.
