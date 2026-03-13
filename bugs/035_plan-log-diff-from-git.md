# Plan: Log diff from Git

**Feature:** Compare current session (or log file) to the previous commit or a chosen baseline (e.g. diff of log content or error set).

---

## What exists

- Git integration; commit URLs; possibly stored logs under workspace or reports.
- Session/list and viewer; export of logs.
- Session comparison (or 3-way) plan exists; diff logic may be reusable.

## What's missing

1. **Baseline selection** — "Compare to previous commit" or "Compare to commit X": resolve Git ref (HEAD~1, tag, or picker) and locate the log file or session that corresponds to that commit (e.g. from Build/CI metadata or same path in a previous run).
2. **Diff view** — Show diff between current log and baseline: line-by-line (e.g. unified diff) or error-set diff (errors in A but not B, etc.).
3. **Mapping commit → log** — Not all workspaces store logs in Git. Option A: compare current log to a previously exported/stored log for that commit (if we store by commit). Option B: compare to "last session from main" or "session from tag X" using Build/CI/session metadata that includes commit.

## Implementation

### 1. Resolve baseline

- "Previous commit": current branch HEAD~1; find a session or log that has that commit (e.g. buildCi header with commit, or stored log path that includes commit hash).
- If no stored log per commit, fall back to "last session before this one" and show commit from metadata if available.

### 2. Diff

- Text diff: two log files, run standard diff (e.g. line diff); display in diff viewer or side-by-side.
- Error diff: extract error lines from both; show "only in current", "only in baseline", "in both" (reuse comparison logic from 3-way plan if present).

### 3. UI

- Command: "Compare log to previous commit" or "Compare to commit…"; open diff view or comparison panel with current log vs baseline.

## Files to create/modify

| File | Change |
|------|--------|
| New: resolve baseline (e.g. `src/modules/compare/git-baseline.ts`) | Resolve commit ref; find matching session/log |
| Diff or comparison view | Reuse or extend session comparison; show log vs baseline |
| Commands | "Compare to previous commit" / "Compare to commit…" |

## Considerations

- Many projects don’t commit logs; feature is most useful when logs are versioned or when session metadata reliably has commit (Build/CI).

## Effort

**5–8 days** if baseline resolution is straightforward; more if commit→log mapping is complex.
