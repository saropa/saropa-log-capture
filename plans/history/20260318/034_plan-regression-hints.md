# Plan: Regression hints (implemented 2026-03-18)

**Implementation summary:** Blame-based hints: `getGitBlame` + `getCommitUrl` used in Analysis panel (source section hash is a link) and error hover (when line has file:line). First-seen hints: Git provider stores `commit` at session start and in session-end meta; `regression-hint-service` loads first-seen session meta and reads `integrations.git.commit`; Insights recurring cards and "Recurring in this log" show "Introduced in commit X" with optional link. Batch first-seen loading parallelized with `Promise.all`. Commit links respect `integrations.git.commitLinks`.

---

# Plan: Regression hints

**Feature:** Show hints like "This error pattern appeared after commit X" by correlating errors with Git history.

**Context (Insights):** Recurring errors and session aggregation now live in the **unified Insights panel** (lightbulb icon; one scroll: Active Cases, Recurring errors, Frequently modified files, Environment, Performance). Regression hints should surface where users triage errors: the **Insights panel** (Recurring / Recurring in this log), the **Analysis panel** (when analyzing a specific error line), and the error hover popup in the viewer.

---

## What exists

- Git integration (blame, commit URLs); possibly blame-to-PR in analysis.
- Error grouping or fingerprinting; session and log data; recurring errors and "first/last seen" in Insights.
- GitHub/context features that map lines to commits and PRs.

## What's missing

1. **Error–commit correlation** — For a given error (or line), determine the commit that introduced it (e.g. git blame for the file/line, or first session where this error appeared and map that session to a commit via time or build metadata).
2. **"Introduced in" hint** — Display in UI: "Likely introduced in commit abc123 (Branch: main, 2 days ago)" with link to commit/PR.
3. **Build/CI tie-in** — If Build/CI integration provides commit for a session, use that to narrow "first seen" to a commit range.

## Implementation

### 1. Blame-based

- For the file and line associated with an error (e.g. from stack trace), run `git blame`; show "Last changed in commit X" with link. This is "where this line of code came from," not necessarily "when the bug was introduced."

### 2. First-seen regression

- Maintain or compute "first session where this error signature appeared" (e.g. from recurring-error store or session index). If sessions have commit/branch from Build/CI or Git integration, show "First seen in session from commit X."
- Optional: binary search over sessions by date to find first occurrence; then map that session to commit.

### 3. UI

- **Insights panel:** On recurring error cards (and "Recurring in this log"), show "Introduced in commit X" when first-seen maps to a commit; link to commit/PR.
- **Analysis panel:** When analyzing an error line, show "Introduced in commit X" (blame or first-seen) with link. Optional: "View blame" for current line.
- **Viewer:** Context menu or error hover: "Regression hint" / "Introduced in"; show commit, date, link.

## Files to create/modify

| File | Change |
|------|--------|
| New: regression hint service | Blame for line; optional first-seen + session→commit mapping |
| Insights panel (recurring cards) | Show "Introduced in commit X" for recurring patterns with first-seen data |
| Analysis panel / error hover | Show "Introduced in commit X" with link; optional "View blame" |
| Recurring/session metadata (cross-session aggregator or store) | Optional: store or query first-seen per error signature; link to commit |

## Considerations

- Accuracy: "introduced after commit X" is heuristic (first occurrence in our data); not always the true introducing commit.
- Performance: blame can be slow on large repos; cache or run async.

## Effort

**5–8 days** for blame-based hint; **8–12 days** with first-seen and session→commit.
