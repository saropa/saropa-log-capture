# Integration: Git and Source Code

## Problem and Goal

The extension already captures **Git branch, commit, dirty state, and remote** in the context header via `environment-collector.ts`. That helps reproducibility but not **code-level context**: who last changed the line that threw, which PR introduced it, what the file looked like at that commit, or whether the failure is in modified-but-uncommitted code. Developers often need to answer "when did this break?" and "who can I ask?" from a single place. This integration extends the existing git/source context so that logs are tied to **blame, PRs, and diffs** without leaving the viewer.

**Goal:** Enrich session metadata and the log viewer with (1) extended git context at session start (tags, last tag, describe), (2) per-line or per-error **blame** and **PR/issue links** when the user inspects a stack frame or error line, and (3) optional **diff summary** (uncommitted files, stash) in the header or a side panel, so that every log is self-contained for code archaeology.

---

## Data Sources

| Source | Data | How obtained |
|--------|------|--------------|
| **Git repo** | Branch, commit, dirty, remote | Already: `environment-collector.ts` |
| **Git tags / describe** | `git describe --tags --always` | Run at session start |
| **Blame** | Last commit and author per file:line | `git blame -L start,end file` for stack frame or clicked line |
| **PR / issue links** | GitHub/GitLab/Bitbucket URLs for commit or branch | From remote URL + commit/branch (e.g. GitHub: `.../commit/<sha>`, `.../pull/<n>`) |
| **Diff summary** | Uncommitted files, stash count | `git status --short`, `git stash list` |
| **File content at commit** | Snapshot of file at session commit | `git show <commit>:path` for "source at session" view |

---

## Integration Approach

### 1. Session start (header and metadata)

- **Already in header:** Git branch, commit, dirty, remote (from `DevEnvironment`).
- **Add to header (optional, configurable):**
  - `Git describe:  v1.2.3-5-gabc1234` (or `abc1234` if no tags).
  - `Uncommitted:   3 files (list or count)` and/or `Stash: 2 entries`.
- **Stored in `.meta.json` or header:** `describe`, `uncommittedFiles[]`, `stashCount` so that later opening the log still shows "code state at record time."

### 2. On-demand: blame and PR links (viewer and stack traces)

- When the user **clicks a stack frame** or uses "Go to source" from a log line, the extension already opens the file. **Enhancement:** In the same flow (or via a hover / side panel), show:
  - **Blame for that line:** "Last changed in commit `abc1234` by Author (date)" and a link to commit (e.g. GitHub commit URL).
  - **PR that introduced the commit:** If the repo is GitHub/GitLab and the commit is in a PR, resolve "branch → default PR" or "commit → PR" and show "Introduced in PR #42" with link.
- Implementation: when navigating to `uri:line`, call `git blame -L line,line <file>` (and optionally `git log -1 --format=...`), then format and show in hover or in a small "Code context" panel in the viewer. PR resolution can use GitHub CLI (`gh pr view`) or REST (with token) or simple heuristic: "origin/branch → GitHub compare or PR list."

### 3. Diff summary in header or panel

- At session start, run `git status --porcelain` (already used for dirty flag) and optionally `git stash list`. Store:
  - List of modified/added/deleted paths (or just counts and names).
  - Stash count (or stash list titles).
- Display: one or two lines in context header, e.g. `Uncommitted: src/foo.ts, src/bar.ts (2 files)` and `Stash: 2`. Option: expand in viewer "Source state" panel with full list and links to diff (e.g. `git diff` in terminal or open diff view).

### 4. "Source at session" snapshot (advanced)

- For critical sessions, optionally store a **manifest of file hashes** at session commit: `git ls-files -s` or `git rev-parse HEAD` plus list of modified files with patch. That allows "replay" or "exact tree" later. Heavy; make it opt-in and behind a setting (e.g. `saropaLogCapture.git.sourceSnapshot: true`).

---

## User Experience

### Settings (under `saropaLogCapture.git.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `describeInHeader` | boolean | `true` | Include `git describe` in context header |
| `uncommittedInHeader` | boolean | `true` | Include uncommitted files summary in header |
| `stashInHeader` | boolean | `false` | Include stash count in header |
| `blameOnNavigate` | boolean | `true` | Show blame (commit, author) when navigating to source from log |
| `prLinks` | boolean | `true` | Resolve and show PR/commit links (GitHub/GitLab) when possible |
| `sourceSnapshot` | boolean | `false` | Store file manifest/hashes at session start (opt-in, heavier) |

### Commands

- **"Saropa Log Capture: Show blame for current line"** — From editor focused on a file opened from log, show blame and PR link in hover or quick pick.
- **"Saropa Log Capture: Copy commit link"** — Copy GitHub/GitLab commit URL for the current line’s blame commit.

### UI

- **Header:** Additional lines after existing Git Branch/Commit: `Git describe`, `Uncommitted`, `Stash`.
- **Viewer:** On "Go to source," show a small tooltip or panel: "Last change: abc1234 by Author (date) · PR #42" with clickable link.
- **Bug report:** Include "Git describe" and "Uncommitted files" in the bug report template so issues carry full code context.

---

## Implementation Outline

### Components

1. **Extend `environment-collector.ts` (or `git-context.ts`)**
   - Add optional calls: `git describe --tags --always`, `git status --porcelain` (already have), `git stash list`.
   - Return `describe`, `uncommittedFiles: string[]`, `stashCount` (or stash list). Keep non-blocking: if git fails, leave fields empty.

2. **`log-session-helpers.ts` / header generation**
   - In `appendDevEnvironment` (or equivalent), append lines for describe, uncommitted summary, stash when config says so.
   - Ensure header stays under reasonable size (e.g. uncommitted file list truncated to 10 paths + "and N more").

3. **Blame and PR resolver**
   - New module: `git-blame.ts` (or under `modules/git/`). Given `uri: vscode.Uri`, `line: number`:
     - Run `git blame -L line,line -s -e <path>` (or with `-w` to ignore whitespace); parse output for commit hash and author.
     - Optionally `git log -1 --format=%H %an %ae %s %ci` for that commit.
   - **PR link:** From `git remote get-url origin` and commit hash, build URL (GitHub: `.../commit/<sha>`, GitLab: `.../commit/<sha>`). For "PR that introduced," use `gh pr view` if `gh` in PATH and token configured, or GitHub API with token; else show only commit link.

4. **Viewer and navigation**
   - When handling "open source" from viewer (e.g. stack frame click), after opening the editor, call blame resolver and post message to webview or show in VS Code hover (via `vscode.languages.registerHoverProvider` for log-origin files?) or show in a small status bar / info message. Simpler: show in **Output Channel** or **information message** with "Copy commit link" button.

5. **`.meta.json`**
   - If we persist session metadata, add `gitDescribe`, `uncommittedFiles`, `stashCount` so that "Open Windows events"–style UX can also show "Git state at record time" when opening an old log.

### Performance and errors

- All git commands must be non-blocking and not throw: use `runGitCommand` with timeout, catch errors, return empty/default.
- Blame only on explicit navigate (or hover); do not run blame for every line in the viewer.
- PR resolution may require network; run async and show "Loading PR…" then "PR #42" or "Commit link only."

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.git.*` as above.
- **Remote detection:** Support GitHub, GitLab, Bitbucket URL patterns for commit and PR links; document that PR links for other hosts require custom logic or `gh`/API.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Large uncommitted list | Truncate in header (e.g. 10 files + count); full list in panel or on demand |
| Blame slow on huge file | Run in background; show "Loading…"; cache by (uri, line) for session |
| No GitHub token / gh | Commit link still works; PR link only when `gh` or API token available |
| Not a git repo | Skip all git additions; existing behavior unchanged |

**Alternatives:**

- **Blame in viewer inline:** Show blame for every stack frame line in the viewer (e.g. right column). More informative but noisier and more git calls; make it optional.
- **Link to GitHub Actions / CI:** See Build and CI integration; combine "this commit" with "last build for this commit."

---

## References

- Existing: `environment-collector.ts`, `log-session-helpers.ts` (appendDevEnvironment), `github-context.ts` (blame PR, file PRs).
