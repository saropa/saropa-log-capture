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
