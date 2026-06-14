# Saropa Suite — handshake verification runbook (Phase 1)

The executable form of Phase 1 in
[107_plan-saropa-suite-orchestration.md](../107_plan-saropa-suite-orchestration.md). The four suite
extensions are published and installed by real users, but the cross-tool handshake has never been run
once. This runbook proves the four seams on a live three-extension run, so "shipped, unverified"
becomes "shipped, verified".

Run it in a real VS Code window (not Cursor) on a real Flutter app that uses Drift. Record a
PASS / FAIL for every numbered check. A FAIL is filed as a **self-contained bug report in the owning
repo's `bugs/` folder** — never a cross-project edit — then fixed as a point release there.

The design fails safe: a broken seam shows up as a **silently missing feature** (a button that never
appears, a panel that shows zero findings), not a crash. So you are hunting for *absence*, not errors.

---

## Prerequisites

1. A Flutter app that depends on `drift` (or `sqflite`) and has at least one query that can run slow
   or N+1, plus a place you can force a `StateError` / `RangeError`.
2. All three extensions enabled (the **Saropa Suite** pack installs them in one click): Saropa Drift
   Advisor (`saropa.drift-viewer`), Saropa Lints (`saropa.saropa-lints`), Saropa Log Capture
   (`saropa.saropa-log-capture`).
3. The app's `pubspec.yaml` dev-depends on `saropa_lints` and depends on `saropa_drift_advisor` (so the
   Drift debug server runs and the analyzer plugin is active).
4. The workspace is a Git checkout (the `commitSha` seam needs a real `.git/HEAD`).

### The lifecycle gotcha — read this first

The three producers write their mirror at **different moments**, so getting all three fresh at the
same commit takes deliberate sequencing:

- `advisor.json` is written **while the Drift debug server is up** (during a debug run) — it is gone by
  the time the app stops, so capture it *during* the session, or run
  **Saropa Drift Advisor: Write Diagnostics Mirror (Suite)** on demand.
- `lints.json` is written on **analysis settle** (the debounced tick after the analyzer finishes).
- `log-capture.json` is written on **Log Capture session end**.

To have all three present and current: run the app in debug (advisor) → let analysis settle (lints) →
stop the Log Capture session (log-capture), all without an intervening `git commit`.

---

## Seam 1 — the envelope agrees on disk

**Goal:** all three tools read each other's `.saropa/diagnostics/*.json` without dropping everything.

1. Run the app in debug, exercise a query, then stop the Log Capture session.
2. Confirm all three files exist in `<workspace>/.saropa/diagnostics/`: `log-capture.json`,
   `advisor.json`, `lints.json`. → **PASS** if all three present. A missing file means that producer
   never fired (lifecycle gotcha above) — re-sequence before reading further.
3. Open `log-capture.json`. Confirm: top-level `schemaVersion`, `producer`, `generatedAt`,
   `diagnostics[]`; each diagnostic has `source: "log-capture"`, a `commitSha`, and a
   `location.file` that is **workspace-relative** (e.g. `lib/db/app_database.dart`) — **not** an
   absolute `C:\Users\…` path. → **PASS** on all four; absolute path is a Log Capture FAIL.
4. Open Drift Advisor's Drift Health panel (**Saropa Drift Advisor: Open Drift Health (Suite)**).
   Confirm it shows rows from **Saropa Lints** and **Saropa Log Capture**, not only Advisor's own. →
   **PASS** if sibling rows appear. Zero sibling rows while the files exist = a parse/field mismatch;
   owner is whoever **produced** the file Advisor couldn't read.
5. Open Lints' consolidated dashboard. Confirm a Drift rule row carries an "Advisor confirms at
   runtime" or "Log Capture saw N" badge. → **PASS** if a badge appears from real sibling evidence.

---

## Seam 2 — deep-links resolve and land

**Goal:** the gated cross-tool buttons appear only when valid, and actually open the right surface.

1. In Log Capture's **SQL Query History**, find a query row. Confirm an **Explain this query in Drift
   Advisor** action is present. → **PASS** if present (the `getCommands` probe found
   `driftViewer.openExplainForSql`). Absent button = Drift Advisor isn't registering that id; owner is
   Drift Advisor.
2. Click it. → **PASS** if Drift Advisor's EXPLAIN panel opens **on that query**. Opens on the wrong
   query / no-ops = FAIL (source repo if the args are malformed, target repo if the command mishandles
   them).
3. In a Log Capture **Lints finding** row, confirm **Show rule in Saropa Lints** appears and opens
   Lints' Rule Explain for that rule (`saropaLints.explainRule`). → **PASS** on open.
4. Reverse direction: from a Drift Advisor or Lints finding, confirm an action targeting
   `saropaLogCapture.openSqlHistoryForFingerprint` focuses Log Capture's SQL History on that query, and
   `saropaLogCapture.openSignal` reveals the matching signal. → **PASS** on each landing.
5. Negative control: disable one sibling extension, reload, and confirm its buttons **disappear**
   rather than erroring. → **PASS** if they vanish silently (this is the fail-safe gate working).

---

## Seam 3 — crash → rule → remediation

**Goal:** a parsed crash family flows from a Log Capture signature to a Lints "enable rule" nudge.

1. Force a parsed crash family in the app — `.first` on an empty list (`StateError`) or `[i]` out of
   range (`RangeError`) — and capture it in a Log Capture session.
2. In `log-capture.json`, confirm the crash diagnostic carries `category: "crash"` and a `ruleId` of
   the form `crash:<id>` (e.g. `crash:state-error-no-element`, `crash:range-error-index`). → **PASS**
   if the signature is stamped; absent = Log Capture FAIL.
3. Confirm Saropa Lints raises its once-per-rule **"This crash class is covered by rule `X`, currently
   disabled — enable it"** nudge for the mapped rule (it fires on activation and when the crash mirror
   changes; it is gated, so it shows once). → **PASS** on the nudge; never fires = a mismatch between
   Log Capture's `CRASH_SIGNATURE_IDS` and Lints' crash-to-rule map; owner is Lints.
4. Cross-check (data, not runtime): the rule the nudge names should appear in Dart Utils'
   `kRuleRemediations`, pointing at the safe primitive (e.g. `firstWhereOrElse`, `singleOrNull`). →
   **PASS** if the mapping row exists.

---

## Seam 4 — commit correlation dims stale findings

**Goal:** a finding captured at an older commit is shown as stale, not as current truth.

1. With all three mirrors fresh at the current commit, note the commit SHA.
2. Make and commit a trivial change (`git commit`) so HEAD moves, **without** regenerating the mirrors.
3. Open Drift Health again. → **PASS** if the prior findings render **dimmed / badged "stale"** because
   their `commitSha` no longer matches HEAD. Shown as current = FAIL; everything dimmed = commit
   resolution is broken. Owner is Drift Advisor (it owns the stale rendering and commit resolution).
4. Open the commit timeline (**Saropa Drift Advisor: Open Commit Timeline**). → **PASS** if it shows
   per-commit finding counts with a delta against the previous commit.

---

## Recording and filing

For each numbered check, record PASS / FAIL with one line of detail on a FAIL (what you expected, what
you saw). For every FAIL:

1. Identify the owning repo (named per seam above).
2. Write a self-contained bug report into that repo's `bugs/` folder — reproduction, expected,
   observed, the seam it breaks. Do **not** edit the sibling repo directly.
3. The fix is a point release in the owning extension; re-run the affected seam to confirm before
   closing.

## What passing unlocks

When all four seams pass on a live run, the verifiable plans can close:
[105_plan-saropa-suite-integration.md](../105_plan-saropa-suite-integration.md) (Log Capture) and the
Saropa Lints plan archive with a finish report; the orchestration tracker
[107](../107_plan-saropa-suite-orchestration.md) advances to Phase 2 (the a11y/visual audits). Drift
Advisor's plan 67 and the Dart Utils plan stay open by their own design (canonical protocol owner;
ongoing/deferred scope).
