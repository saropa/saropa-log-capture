# Plan: Regression hints

**Feature:** Show hints like "This error pattern appeared after commit X" by correlating errors with Git history.

---

## What exists

- Git integration (blame, commit URLs); possibly blame-to-PR in analysis.
- Error grouping or fingerprinting; session and log data.
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

- In context menu or inline: "Regression hint" / "Introduced in"; show commit, date, link. Optional: "View blame" for current line.

## Files to create/modify

| File | Change |
|------|--------|
| New: regression hint service | Blame for line; optional first-seen + session→commit mapping |
| Analysis/context UI | Show "Introduced in commit X" with link |
| Recurring/session metadata | Optional: store or query first-seen per error signature; link to commit |

## Considerations

- Accuracy: "introduced after commit X" is heuristic (first occurrence in our data); not always the true introducing commit.
- Performance: blame can be slow on large repos; cache or run async.

## Effort

**5–8 days** for blame-based hint; **8–12 days** with first-seen and session→commit.
