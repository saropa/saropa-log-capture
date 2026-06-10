# Plan: Session comparison (3-way)

**Feature:** Compare three sessions side by side (e.g. diff-style or aligned by time) to see what changed between runs.

**Status (2026-06-10): MVP shipped** — the comparison engine + a "Compare 3 Logs" command + a Markdown triage report. The richer 3-column linked-scroll webview and timestamp alignment remain (see Finish Report).

---

## What exists

- Session list and open session in viewer; possibly session comparison or diff elsewhere in codebase.
- Timeline and context popover for single-session view.
- Export/import of sessions and investigations.

## What's missing

1. **3-way session selection** — UI to pick three sessions (e.g. baseline, run A, run B) from the project logs or investigation.
2. **Comparison view** — Display the three logs in a comparable way: aligned by timestamp, or by line number, or side-by-side diff (e.g. baseline vs A, baseline vs B).
3. **Difference highlighting** — Highlight added/removed/changed lines or error sets between runs; optional summary (e.g. "Session B has 3 new errors vs baseline").

## Implementation

### 1. Selection

- Command or panel: "Compare 3 sessions"; user selects three sessions (list or picker). Store as Session A, B, C (or Baseline, A, B).
- Validate: all three are valid log URIs and readable.

### 2. Alignment strategy

- **By time:** Align lines by timestamp so the same moment in time lines up across columns. Gaps if one session has no event at that time.
- **By structure:** If logs share similar structure (e.g. same test run), align by line index or by first N lines; then diff.
- **By content:** Fuzzy match lines across sessions (e.g. same error message); more complex.

### 3. UI

- Three columns (or three panels); shared scroll or linked scroll. Use existing viewer components if possible, with a "comparison" mode that hides single-session chrome.
- Diff highlighting: color or icon for "only in A", "only in B", "only in C", "in all". Optional summary panel above/below.

### 4. Scope

- MVP: three columns, same log format; align by line index and show simple diff (add/remove). Later: timestamp alignment and richer summary.

## Files to create/modify

| File | Change |
|------|--------|
| New: comparison data (e.g. `src/modules/compare/session-compare.ts`) | Load three logs; align; compute diff |
| New: comparison view (e.g. `src/ui/panels/session-compare-panel.ts`) | Three-column UI; wire to comparison data |
| Commands | "Compare 3 sessions" → open comparison with session picker |
| `package.json` | Command, optional view container |

## Considerations

- Large logs: avoid loading three full logs into memory; stream or window.
- Different log lengths: define rules (e.g. align by start time, pad shorter with empty lines or "no event").

## Effort

**7–10 days** for 3-way view with timestamp or line alignment and basic diff.

---

## Finish Report (2026-06-10) — 3-way comparison MVP (engine + command + report)

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript) + package.json/NLS command. No Dart/Flutter.

**What shipped (the plan's MVP: "align by content, simple diff, basic summary").** The existing 2-way comparison (`diff-engine.ts` + `session-comparison.ts` webview) is untouched; this adds a 3-way path end to end:
- **`src/modules/compare/session-compare.ts`** — pure `compareThreeSessions(input)`: indexes each session's lines by a normalized key, buckets every distinct line by presence (`A`/`B`/`C`/`AB`/`AC`/`BC`/`ABC`), and computes the triage summary — **new errors in B vs baseline A**, **new errors in C vs A**, and **errors resolved** (baseline-A errors absent from both runs). Error detection is an injectable predicate (default regex) so the engine stays pure and the caller can pass the project classifier.
- **`src/modules/misc/line-normalize.ts`** — extracted the line normalizer out of `diff-engine.ts` into a shared pure module so the 2-way and 3-way comparers normalize identically (a line judged equal by one is judged equal by the other) and the 3-way engine is host-free / unit-testable.
- **`src/modules/compare/session-compare-markdown.ts`** — pure renderer: triage summary table first (new/resolved errors), then per-presence line buckets, each capped at 50 lines with an "… and N more" note so a huge log can't produce a multi-megabyte document.
- **`saropaLogCapture.compareThreeSessions`** command ("Compare 3 Logs") — picks baseline + run B + run C via three exclusion-filtered Quick Picks (mirrors the 2-way picker), reads the files best-effort, runs the engine, and opens the report as a Markdown document with the preview shown.

**Why a Markdown report, not the 3-column webview.** The plan estimates the full linked-scroll 3-column viewer at L effort; a Markdown document is the lightweight MVP surface (no webview, reuses VS Code's preview) that delivers the actual decision value — "did this run introduce errors / fix them?" — immediately. The richer viewer is the deliberate follow-up.

**Files changed/created:**
- New: `session-compare.ts`, `session-compare-markdown.ts`, `line-normalize.ts`, test `session-compare.test.ts`.
- Modified: `diff-engine.ts` (use the shared normalizer; dropped its private copy + now-unused stripAnsi import), `commands-comparison.ts` (command + 3-session picker + report opener), `package.json` + `package.nls*.json` (×11) (command), `strings-a.ts` (picker prompts/titles/warning), `plans/reference/contributes-commands.md` (regenerated), `CHANGELOG.md`.

**Tests:** `session-compare.test.js` → 10 passing (presence buckets, pairwise membership, timestamp-insensitive matching, new-errors-in-B/C, resolved errors, custom predicate, blank-line skip, plus Markdown report structure/deltas/empty-bucket). `diff-engine.test.js` → 4 passing (no regression from the normalizer move). `npm run check-types` clean; `npm run lint` no warnings on changed files; `npm run compile` passes all verify gates (NLS 11-locale aligned, command catalog matches, dist size OK).

**Outstanding (plan stays active):** the 3-column **linked-scroll webview** with side-by-side columns and inline diff coloring; **timestamp alignment** (the engine currently aligns by content membership, not wall-clock); fuzzy content matching; and windowing/streaming for very large logs (the engine reads full files — fine for typical sessions, a concern at extreme sizes). On-device (F5) confirmation of the command + report is the user's check.

**Finish report appended:** plans/031_plan-session-comparison-three-way.md
