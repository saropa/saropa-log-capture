# 107 Saropa Suite — Cross-Repo Orchestration

**Created:** 2026-06-14
**What it does:** Coordinates the four Saropa repositories that implement the Saropa Diagnostic
Envelope so the suite is finished as one system, not four disconnected halves. This is the layer
*above* the per-repo plans — it does not restate their requirements; it tracks what is actually built,
what genuinely remains, and the order to close it in.

This plan lives in `saropa-log-capture` by decision, but it governs all four repos. The per-repo plans
it sits over:

- **Drift Advisor** — `D:\src\saropa_drift_advisor\plans\67-saropa-suite-integration.md`
  (owns the canonical envelope schema — Section 2 there).
- **Saropa Lints** — `D:\src\saropa_lints\plans\SAROPA_SUITE_INTEGRATION.md`.
- **Log Capture** (this repo) — `D:\src\saropa-log-capture\plans\105_plan-saropa-suite-integration.md`.
- **Saropa Dart Utils** — `D:\src\saropa_dart_utils\plans\SAROPA_SUITE_INTEGRATION.md`
  (remediation layer, not a fourth lens).

---

## The core finding: built, not integrated

Every per-requirement task across all four repos is **shipped and committed**. The protocol — the
Saropa Diagnostic Envelope, the offline mirrors at `.saropa/diagnostics/<source>.json`, the deep-link
command ids — is complete and consistent across all four. No repo is waiting on another repo's code.

What has **never happened**: the three extensions running together and exchanging a single real
envelope. Each repo built its half against a written spec, unit-tested its own side in isolation, and
stopped. Every per-repo plan admits the same gap in its own words — "device verification pending",
"needs a running VS Code", "the cross-tool handshake is unproven". The suite is therefore three
extensions that each implement a shared protocol and have **never shaken hands**. That seam — not more
features — is the remaining work.

**All four extensions were published to the marketplace before that verification ran** (Drift Advisor
4.0.1, Saropa Lints 14.0.0, Log Capture 9.0.1, the Saropa Suite pack 1.0.7), so the handshake is now a
*production* check, not a pre-ship gate. The bound on the risk is the fail-safe design: a deep-link
renders only when the sibling command is registered (a `getCommands` probe — no dead buttons), envelope
parsing returns `undefined` on a schema/field mismatch rather than throwing, and mirror reads are
best-effort. A broken seam therefore surfaces as a **silently absent feature**, not a crash or data
loss — a quality gap, not a stability incident. Phase 1 is consequently the urgent item, and a FAIL is
a point release in the owning repo rather than a rollback.

### Built state (audited against each plan + changelog, 2026-06-14)

| Repo | Requirements shipped | Test state | Honest gap |
|------|----------------------|-----------|------------|
| **Log Capture** | R1 produce, R2 read+render, R3 crash signatures, R4 deep-link in, R5 deep-link out | 30 unit tests; traced to `src/` | No end-to-end run against a live sibling |
| **Drift Advisor** | R1 envelope on `/api/issues`, R2 mirror, R3 consume, R4 Drift Health panel, R5 five deep-link ids, R6 commit correlation + timeline + sidecar | 2845 tests | Visual/a11y audit of three panels unverified on a rendered window |
| **Saropa Lints** | R1 export, R2 consume+badge, R3 crash-to-rule, R4 deep-link ids, R5 deep-link out, R6 commit stamp, R7 pairing nudge | ~50 suite tests | Translated locale catalogs stale for `suite.*` keys; device verification pending |
| **Dart Utils** | R1 rule→remediation map, R3 crash-coverage audit (zero gaps), R5 CLI scanner | Pinning tests | R5 in-editor rule-pack port not built (CLI only) |

The **Saropa Suite** Extension Pack (Drift Advisor + Lints + Log Capture) is already published, so the
three-tool install is a single click — which makes Phase 1 below practical to set up.

---

## Shared-infrastructure extraction — CLOSED, no new project

The three sibling plans each carry a "Shared infrastructure" section proposing three new publishable
packages (`saropa-release-tools`, `saropa-vscode-i18n`, `saropa-vscode-ui`). Drift Advisor's Plan 67
§7 and the Lints plan both mark it WON'T DO; an external review captured in the Lints plan contested
the rejection and endorsed a lighter single-repo mechanism. This plan settles the contradiction.

**Decision: no new shared project, and no folding into a baseline either. The extraction is closed.**
The reasoning the prior docs used ("over-engineering") was directionally right but skipped the real
analysis. The careful version:

- The three proposed packages were **not alike**. Two of them — release tooling and the i18n pipeline
  — are **Python tooling that never needed packaging**. The only genuine TypeScript-library candidate
  was the UI kit (theme tokens + the high-contrast color bug), the smallest and most cosmetic of the
  three.
- The **Dart-side reusable concepts already have their baseline homes**, correctly: `saropa_dart_utils`
  holds the suite's Dart logic (rule→remediation map, crash-coverage audit); `saropa_lints` owns the
  rule catalog and the version-nudge. That sharing is done. Nothing remains to centralize there.
- What is left is only **TypeScript extension glue**. A database tool and a log tool have no reason to
  depend on a linter extension's internals to dedupe a theme token — that coupling is worse than the
  duplication it removes. So folding into a baseline is rejected for the same reason a new project is:
  the maintenance and coordination cost exceeds the copy-paste it would remove.

**The constructive fallbacks (build only if the pain recurs — do not pre-build):**

1. The recurring "fixed color washes out in high-contrast" bug is a **lint problem, not a library
   problem**. Each extension already runs ESLint; a small shared ESLint rule that bans a hardcoded hex
   where a `--vscode-*` token exists prevents the bug class without one line of shared runtime code.
2. If the Python tooling (release gates, i18n pipeline) ever drifts and the drift bites, keep **one
   canonical copy and sync it** — the same pattern already used for the shared NLLB interpreter — never
   a published unit.

Shared-infra therefore blocks nothing and is removed from the active sequence.

---

## The orchestration sequence

### Phase 1 — Prove the handshake (highest value, blocks nothing else)

The one thing nobody has done. Stand up a single real Flutter/Drift app with the Saropa Suite pack
installed (all three extensions), and walk the full loop end to end, capturing every seam mismatch as
a bug filed in the **owning** repo (cross-project rule: a Log-Capture-side defect is fixed here; a
sibling defect is a bug report written into that repo, not an edit).

The seams to exercise:

1. **Envelope on disk agrees byte-for-byte.** Trigger a slow query in the app → confirm Log Capture
   writes `.saropa/diagnostics/log-capture.json` → confirm Drift Advisor and Lints both parse it
   without dropping diagnostics (schema major, field names, workspace-relative paths all matching the
   canonical Section 2 shape).
2. **Deep-links resolve and land.** Confirm the gated "Explain this query in Drift Advisor" / "Show
   rule in Saropa Lints" buttons actually appear (the `getCommands` probe sees the sibling), and that
   clicking one lands on the right surface — not a dead command, not the wrong table.
3. **Crash → rule loop fires.** Trigger a parsed crash family → confirm Log Capture stamps the
   `crash:<id>` signature → confirm Lints' "enable rule X" nudge fires for the mapped rule → confirm
   Dart Utils' remediation map names the safe primitive.
4. **Commit correlation dims correctly.** Confirm a mirror captured at a different `commitSha` renders
   as stale/dimmed rather than as current truth.

Exit criterion: each of the four seams demonstrated once on a live three-extension run, with any
mismatch filed as an owning-repo bug. This converts four "unverified" plans into one verified suite.

The click-by-click runbook for this phase — prerequisites, the lifecycle sequencing the three
producers need, and a PASS/FAIL check per seam — is
[guides/suite-handshake-verification.md](guides/suite-handshake-verification.md).

Seam 1 also gets an **in-app automatic form**: a suite-mirror status strip in the viewer's Signal
panel plus a session-report snapshot, so the user sees which mirrors are present, at which commit, and
how fresh — without digging through `.saropa/diagnostics/` by hand. This also settles the output-sync
question (commit-keyed read-time reconciliation; no shared session id; latest-wins single mirror).
Planned in [../bugs/suite_mirror_status_and_sync.md](../bugs/suite_mirror_status_and_sync.md).

### Phase 2 — Manual a11y / visual audits (gated behind Phase 1)

The LAUNCH_TEST items every plan defers because they need a rendered window: Drift Advisor's Drift
Health, Commit Timeline, and Suite Findings panels; the Lints dashboard runtime-evidence badges. RTL /
dyslexia rendering, WCAG-AA contrast, design-system token adoption. Gated behind Phase 1 because there
is no point auditing panels that do not yet render the correct cross-tool data.

### Phase 3 — Locale regeneration (operator-run, per repo)

Saropa Lints' new `suite.*` / `consolidated.evidence.*` keys leave its 23 translated catalogs stale;
audit the other repos for the same. Regeneration runs the machine-translation pipeline, which is
**operator-run only and never triggered from this plan** — adding English source keys is fine; running
NLLB is a separate, explicit authorization naming the exact command. The publish coverage gate already
blocks a release until the catalogs are regenerated, so this cannot ship stale by accident.

### Phase 4 — Dart Utils R5 in-editor (independent, low priority)

The "prefer `saropa_dart_utils`" migration suggestions exist today as a CLI scanner
(`tool/suggest_saropa_utils.dart`). Porting them to a type-aware rule pack inside `saropa_lints` (so
they surface as in-editor quick fixes) is the natural next step, blocked on selecting a
flow-analysis-safe target. Independent of Phases 1–3; pursue only after the handshake is proven.

---

## Ownership and the cross-project rule

This plan coordinates four repos but **edits only Log Capture**. Work that lands in a sibling repo is
either done by the user or filed as a self-contained bug report into that repo's `bugs/` folder — never
a direct cross-project edit. The per-repo plans remain the source of truth for each half's internal
detail; this document only sequences the joint work and records the suite-wide decisions (the
shared-infra closure above being the first).

## Done criteria (suite-wide)

- Phase 1's four seams each demonstrated once on a live three-extension run; every mismatch filed in
  its owning repo and closed.
- The three a11y audits passed on rendered panels.
- No stale translated catalog blocking any repo's next release.
- Shared-infra stays closed unless a named, recurring pain reopens it under one of the two fallbacks.

## Related plans

- `D:\src\saropa_drift_advisor\plans\67-saropa-suite-integration.md` (canonical envelope owner)
- `D:\src\saropa-log-capture\plans\105_plan-saropa-suite-integration.md` (Log-Capture half)
- `D:\src\saropa_lints\plans\SAROPA_SUITE_INTEGRATION.md`
- `D:\src\saropa_dart_utils\plans\SAROPA_SUITE_INTEGRATION.md`
