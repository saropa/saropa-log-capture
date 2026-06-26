# Suite mirror status + output synchronization

**Status: Reference — not an active plan (wound down 2026-06-14).** The suite effort is finished and
shipped; this is retained for its durable takeaway, the **output-synchronization design** in Part B
(correlate at read time on `commitSha`; no shared session id; latest-wins single mirror). The
in-viewer status strip (Part A) is deliberately **not** built — it would be a developer-facing
plumbing surface, against the goal of the extensions interoperating without extra screens. Kept as
reference, not as a backlog item.
**Created:** 2026-06-14
**Parent:** [plans/107_plan-saropa-suite-orchestration.md](../plans/107_plan-saropa-suite-orchestration.md)
(Phase 1 verification) and [plans/105_plan-saropa-suite-integration.md](../plans/105_plan-saropa-suite-integration.md)
(the Log-Capture half of the suite protocol).

## Problem

The three suite tools each write an offline mirror to `<workspace>/.saropa/diagnostics/<source>.json`
(`log-capture.json`, `advisor.json`, `lints.json`). A user has no in-app way to see whether those
files are actually being written, and the three are written at **different moments by different tools**
(Drift Advisor while its debug server is up, Saropa Lints on analysis settle, Log Capture on session
end) — so a consumer reading all three at once can get three snapshots from three different times and
potentially three different commits. There is no in-app signal for "is the suite consistent right now,
and which lens is missing or stale."

This is the live, automatic form of Seam 1 in the verification runbook
([plans/guides/suite-handshake-verification.md](../plans/guides/suite-handshake-verification.md)):
instead of digging through `.saropa/diagnostics/` by hand, the viewer surfaces it.

> Note: these mirrors are **not** in Log Capture's report folder (`reports/` by default). They live in
> the shared cross-tool path `.saropa/diagnostics/` (`DIAGNOSTICS_DIR_SEGMENTS` in
> [src/modules/diagnostics/saropa-diagnostic-envelope.ts](../src/modules/diagnostics/saropa-diagnostic-envelope.ts)),
> which all three extensions hardcode. They cannot move into `reports/` — the siblings do not know that
> folder exists or that it is renameable.

## Part A — In-viewer suite mirror status

A one-line strip in the Signal panel (next to the existing workspace-pulse strip) that shows, for each
of the three mirrors:

- **present / absent** — does the file exist and parse (`parseEnvelope`)?
- **commit** — the `commitSha` it was captured at, and whether it matches current `HEAD`
  (fresh) or not (stale).
- **count** — number of diagnostics in the envelope.
- **generatedAt** — when it was written.

A user running only two of the three lenses sees at a glance which one is missing. A stale or
mismatched-commit lens is visibly flagged rather than silently trusted. Reuses
[suite-mirror-read.ts](../src/modules/diagnostics/suite-mirror-read.ts) and
[envelope-parse.ts](../src/modules/diagnostics/envelope-parse.ts) — both already malformed-safe.

## Part B — Output synchronization (the real design question)

**There is no shared atomic write moment, and there cannot be.** The three tools are independent
extensions with different units of work (a Log Capture *session*, a Drift Advisor *debug run*, a Lints
*analysis tick*) and are rarely all live at once — the suite plans state this explicitly. So no single
process can snapshot all three atomically. Correlation must happen at **read time**, by shared
metadata.

**The correlation key is `commitSha`** — the only identifier all three tools independently stamp.
Freshness within a commit is decided by `generatedAt` (newest wins; a much-older file is flagged). A
shared session id is deliberately **rejected**: the three tools have no common session concept and no
moment to mint or agree on one, so commit is the natural and already-stamped join.

**Single mirror per tool (latest-wins overwrite) is the model and stays.** Each tool overwrites its
own `<source>.json` with its current state; there is exactly one file per source, always the latest.
The "match" problem therefore reduces to a freshness question — *do the three latest mirrors agree on
commit, and how recent is each* — not a many-to-many session join. True per-session history (append,
one row per run) is a larger design and is **out of scope**; commit-keyed latest-wins answers the real
question ("is the suite consistent at this commit, now?").

**The durable, well-defined snapshot is the session report.** Log Capture's session end already
resolves the session commit (`getSessionCommit`) and writes its own envelope
([session-lifecycle-finalize.ts](../src/modules/session/session-lifecycle-finalize.ts)). Add a
**"suite snapshot at session end"** block to the session report / sidecar recording each tool's
mirror: present, captured commit, count, generatedAt — keyed to this session's real commit. This is
the closest thing to "session matching" that is actually well-defined, and it mirrors what Drift
Advisor already records in its sidecar `suiteMirrors` block, so both ends agree on the shape.

No new shared file is introduced. The reconciliation is computed at read time for the live strip
(Part A) and persisted into the existing session report for the durable record (Part B). A derived
`.saropa/diagnostics/suite-status.json` cache is explicitly avoided — it would be a fourth file that
can itself rot, re-creating the very staleness problem it would claim to solve.

## Scope

- **In scope (Log Capture only):** the Signal-panel status strip (Part A), the session-report suite
  snapshot block (Part B), and the read-time reconciliation that both share. All achievable with the
  metadata already in the envelopes — no sibling change required.
- **Sibling dependency:** if a sibling mirror omits `commitSha` at the per-diagnostic or envelope
  level, the strip shows "commit: unknown" for that lens rather than guessing — and that gap is filed
  as a bug in the owning repo, not patched here.
- **Out of scope:** per-session mirror history (append), a shared session id, any new file under
  `.saropa/diagnostics/`.

## Test plan

- **Unit:** reconciliation function (pure) — given three envelope metadata records, returns
  present/commit/fresh/count per source; absent file → absent; older `generatedAt` → flagged; commit ≠
  HEAD → stale. Fixtures for all-three-present, one-missing, one-stale, one-malformed.
- **Render:** the strip renders the three states (present-fresh / stale / absent) with correct icons
  and never throws on a malformed or absent file.
- **Session report:** the suite snapshot block lists each present mirror with its commit and count, and
  omits cleanly when `.saropa/diagnostics/` is absent.

## Related

- Parent orchestration: [107](../plans/107_plan-saropa-suite-orchestration.md).
- Verification runbook this automates (Seam 1): [suite-handshake-verification.md](../plans/guides/suite-handshake-verification.md).
- Reuses: `suite-mirror-read.ts`, `envelope-parse.ts`, `envelope-io.ts`, `getSessionCommit`.
