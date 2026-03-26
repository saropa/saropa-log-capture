# Plan: Compare current log to a Git baseline

**Feature:** Use a Git commit as a **time baseline** (e.g. `HEAD~1`, a tag, or a picked commit), resolve a **baseline log** if possible, then show the same kind of comparison the extension already uses for two hand-picked sessions (normalized line diff; optional DB fingerprint extras).

This is **not** limited to “log files tracked in Git.” Most logs live only under the project log directory; the commit is a **label** for which stored session to load, not necessarily `git show <ref>:path`.

---

## Scope

| Tier | What | Notes |
|------|------|--------|
| **MVP** | Command: compare **current** session (or explicit log URI) to **previous commit** (`HEAD~1`) on the current branch, when a matching saved session can be found | Reuse `compareLogSessionsWithDbFingerprints` + session comparison UI |
| **MVP+** | “Compare to commit…” — user picks ref (input box or Git-aware picker) | Same resolution as MVP, different ref |
| **Later** | 3-way or richer error-set-only views | See `plans/031_plan-session-comparison-three-way.md` |
| **Out of scope for this plan** | Re-implementing unified diff inside the repo for arbitrary paths under version control | Only if we add “open `git show` output” as a separate, explicit feature |

**v1 diff presentation:** Reuse the existing session comparison panel (`SessionComparisonPanel`) so behavior matches “compare two saved logs” today — line-oriented diff with optional Drift SQL fingerprint section, not a second bespoke diff UI.

---

## What exists (concrete)

- **Two-session compare:** `src/modules/misc/diff-engine.ts` (`compareLogSessions`, `compareLogSessionsWithDbFingerprints`).
- **Comparison UI:** `src/ui/session/session-comparison.ts`; commands in `src/commands-comparison.ts` (`saropaLogCapture.markForComparison`, `compareWithMarked`, `compareSessions`).
- **Git in extension:** `src/modules/git/git-diff.ts` (commit stat summary), `src/modules/git/git-blame.ts`, `src/modules/integrations/providers/git-source-code.ts` (commit links). Analysis panel uses blame/diff (`src/ui/analysis/analysis-panel-streams.ts`).
- **Session metadata:** `src/modules/session/session-metadata.ts` — `SessionMeta.integrations` may hold provider payloads (e.g. `buildCi`) that **could** carry a commit hash; shape is `Record<string, unknown>` until normalized for this feature.
- **Related plan:** `plans/031_plan-session-comparison-three-way.md` (three sessions; alignment strategies).

---

## What’s missing

1. **Baseline ref resolution** — Parse/validate `HEAD~1`, tag, full SHA, etc. (likely small wrapper over `git rev-parse` in workspace folder).
2. **Commit → baseline log URI** — No single source of truth today. Need a defined order of attempts (below).
3. **Commands + wiring** — New commands that resolve baseline URI then call `SessionComparisonPanel.compare(baselineUri, currentUri)` (order: baseline first vs current second should match existing UX for “A vs B”).
4. **User messaging** — Clear errors when no session matches the commit (many workspaces never store commit on sessions).

---

## Baseline log resolution (decision order)

Implement as explicit steps; stop at first success.

1. **Tracked log path (optional narrow case)**  
   If the project configures or discovers a log path that is **in Git**, and `git cat-file -e <ref>:<path>` succeeds, read that blob as baseline text.  
   *Most Saropa sessions won’t hit this; keep behind config or heuristics so we don’t surprise users.*

2. **Session index via metadata**  
   Load `.session-metadata.json` (via `SessionMetadataStore`) for all tracked log files in the log directory. Find a session whose metadata ties it to the target commit (exact field TBD: e.g. `integrations.buildCi.commit` after we document a normalizer). Prefer **most recent** file if multiple match.

3. **Filename / path heuristics**  
   If logs or exports are named with a short SHA, match `ref` prefix (fragile; optional).

4. **Explicit fallback (no silent wrong baseline)**  
   If nothing matches: show an error with actions — e.g. “Compare two sessions…” / link to docs — **do not** substitute “previous session in list order” unless the user explicitly chose that fallback (that order is not the same as Git history).

---

## Implementation outline

### 1. Git ref helper

- Input: workspace folder, ref string (`HEAD~1`, tag, SHA).
- Output: resolved full SHA (or failure).
- Prefer a small module under `src/modules/git/` (e.g. `git-rev-resolve.ts`) using the existing pattern from `git-diff.ts` / workspace `cwd`.

### 2. Baseline URI resolver

- New module (e.g. `src/modules/compare/git-baseline.ts` or `src/modules/git/log-baseline-for-commit.ts`):
  - Takes resolved SHA + current log URI + `SessionMetadataStore` + config.
  - Runs the decision list above; returns `vscode.Uri | undefined` and a short `reason` for telemetry or user messages.

### 3. Commands

- `saropaLogCapture.compareLogToPreviousCommit` — current session / active log → `HEAD~1` → compare.
- `saropaLogCapture.compareLogToCommit` — QuickPick or input for ref → same pipeline.
- Register next to `commands-comparison.ts`; reuse l10n patterns.

### 4. Metadata contract (design task)

- Decide which integration payload field(s) define “this session was built at commit X.”  
- Add a normalizer in config or session layer (similar to other `integrations` consumers) so resolution is one function, not ad hoc `as any`.

---

## Files to create or touch

| Area | Path |
|------|------|
| Ref + baseline resolution | New: `src/modules/git/` or `src/modules/compare/` helper(s) |
| Metadata / commit extraction | `src/modules/session/session-metadata.ts` or small `session-commit-from-meta.ts` |
| Commands | `src/commands-comparison.ts`, command IDs in `package.json` |
| L10n | `src/l10n` / message bundle for new strings |
| Tests | Unit tests for ref parsing mock and “pick correct session when two have metadata” |

---

## Considerations

- **Logs not in Git** — Default path is metadata/index; set expectations in UI copy.
- **Dirty working tree** — “Previous commit” is still a valid baseline; document that it compares to **last recorded** state at that commit, not uncommitted editor buffers.
- **Performance** — Scanning all sessions for metadata should batch-read central store once per command, not N+1 opens.

## Effort

| Track | Estimate |
|-------|----------|
| Ref resolution + commands + wiring into `SessionComparisonPanel` | ~2–3 days |
| Metadata contract + normalizer + resolver tests + polished errors | ~2–4 days |
| Optional: versioned log path in repo | +1–2 days |

**Total:** about **5–8 days** depending on how strict the commit→metadata contract must be and how many edge cases (monorepo, multiple log roots) you support in v1.
