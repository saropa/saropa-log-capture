# Plan: Git — includeLineHistoryInMeta and PR/commit link resolution

**Status: Implemented** (2025-03-12)

**Summary:** Added `onSessionEnd` to the git provider to parse log for file:line references (Dart, JS/TS, Java-style stack traces), run `git blame` per ref (cap 20, 2s timeout), and store `lineHistory` in session meta. Added `getCommitUrl` / `getRemoteBaseUrl` to resolve commit hashes to GitHub/GitLab/Bitbucket URLs; used in line history meta and in blame-on-navigate status bar. New config `integrations.git.commitLinks` (default true). Remote base URL is resolved once per session in onSessionEnd to avoid N git calls. Blame display shows "Git blame…" until result is ready. PR lookup via GitHub API left as stretch goal.

---

**Adapter:** `git`
**Provider:** `src/modules/integrations/providers/git-source-code.ts`

## What exists

- `onSessionStartSync`: runs `git describe`, `git status --porcelain`, `git stash list` → header + meta
- `blameOnNavigate`: wired in viewer-provider-actions.ts, calls `getGitBlame()` and shows result in status bar
- Config key `includeLineHistoryInMeta` exists in package.json and config interface but nothing reads it at session end

## What's missing

1. **`includeLineHistoryInMeta`**: at session end, parse log for file:line references, run blame for each, store in meta
2. **PR/commit URL resolution**: resolve commit hash to a GitHub/GitLab PR or commit URL

## Sub-features

### 1. includeLineHistoryInMeta (onSessionEnd)

**Implementation:**

Add `onSessionEnd` to the git provider:

1. Check `config.integrationsGit.includeLineHistoryInMeta` — if false, return undefined
2. Get the log content from context (session log text or file path)
3. Parse for `file:line` patterns (stack trace format: e.g. `package:lib/foo.dart:42`, `at Foo (src/bar.ts:10:5)`)
   - Use a regex that handles common stack trace formats (Dart, JS/TS, Python, Java)
   - Deduplicate by file:line
   - Cap at N distinct file:lines (e.g. 20) to bound cost
4. For each file:line, run `git blame -L line,line --porcelain <file>` with timeout
5. Collect results: `{ file, line, commit, author, date, summary }`
6. Return `Contribution[]` with meta payload containing `lineHistory` array

**Config:** No new settings needed — `includeLineHistoryInMeta` already exists (default `false`).

### 2. PR/commit URL resolution

**Implementation:**

Add a helper that resolves a commit hash to a web URL:

1. Run `git remote get-url origin` to get the remote URL
2. Parse the remote URL to extract host/owner/repo:
   - `git@github.com:owner/repo.git` → `https://github.com/owner/repo`
   - `https://github.com/owner/repo.git` → `https://github.com/owner/repo`
   - Same patterns for GitLab, Bitbucket
3. Construct commit URL: `{baseUrl}/commit/{hash}`
4. Optionally, for GitHub only: call `GET /repos/{owner}/{repo}/commits/{sha}/pulls` to find associated PR (requires token from SecretStorage — make this opt-in)

**Where it's used:**
- In `blameOnNavigate`: after showing blame in status bar, include a clickable commit URL
- In `lineHistory` meta: include commit URL per entry

**Config additions:**

Add to `IntegrationGitConfig`:
- `commitLinks`: `boolean` (default `true`)

Add to `package.json`:
- `saropaLogCapture.integrations.git.commitLinks` — boolean, default `true`
- Description: "Resolve commit hashes to web URLs (GitHub, GitLab, Bitbucket)."

### 3. Files to modify

| File | Change |
|------|--------|
| `src/modules/integrations/providers/git-source-code.ts` | Add `onSessionEnd` for line history; add commit URL resolver |
| `src/modules/config/config-types.ts` | Add `commitLinks` to `IntegrationGitConfig` |
| `src/modules/config/integration-config.ts` | Read `commitLinks` setting |
| `package.json` | Add `commitLinks` boolean setting |
| `src/ui/provider/viewer-provider-actions.ts` | Enhance blame display with commit URL |

### 4. Considerations

- Blame per file:line is expensive — strict caps on count (20) and timeout (2s per blame) are essential
- The log content access pattern at session end needs investigation — how do other `onSessionEnd` providers access the session log?
- Remote URL parsing must handle SSH, HTTPS, and edge cases (ports, subgroups)
- PR lookup via GitHub API is optional and requires auth — keep it as a stretch goal
- File:line regex must not false-positive on URLs or other colon-separated text
