# Spec: Git and Source Code Integration

**Adapter id:** `git`  
**Status:** Implemented  
**Design:** Implemented; see provider in `src/modules/integrations/providers/git-source-code.ts` and this spec.

## Goal

Extend session context with git describe, uncommitted/stash summary; add blame and PR/commit links when navigating to source from a log line.

## Config

- `saropaLogCapture.integrations.adapters` includes `git`
- Optional `saropaLogCapture.integrations.git.*`: describeInHeader, uncommittedInHeader, stashInHeader, blameOnNavigate, includeLineHistoryInMeta, prLinks

## Implementation

- **Provider:** `onSessionStartSync`: run `git describe`, `git status --porcelain`, `git stash list`; return header lines + meta. `isEnabled`: adapters includes `git`.
- **Blame/PR:** On "Go to source" from viewer, after opening file call `git blame -L line,line`; show last commit, author, date in status bar (blameOnNavigate). Optional: resolve commit/PR URL (GitHub/GitLab) for copy link. Use existing `getGitBlame`; non-blocking.
- **Line history in log:** When `includeLineHistoryInMeta` is true, at session end the provider can parse the log for file:line references (e.g. stack traces), run blame for each, and store in `meta.integrations.git.lineHistory` for viewer/bug report. (Implementation: optional onSessionEnd in git provider; limit to N distinct file:lines and log size to avoid cost.)
- **Performance:** Sync git commands must be fast (describe, status); timeout and return empty on slow repo. Blame only on explicit navigate.
- **Status bar:** "Git" when adapter contributed at start.

## UX

- No loading spinner for sync git; optional "Loading PR…" for async PR resolution. Gradual: show commit link first, then PR if available.
