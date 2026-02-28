# Spec: Git and Source Code Integration

**Adapter id:** `git`  
**Status:** Not implemented  
**Full design:** [docs/integrations/git-source-code.md](../docs/integrations/git-source-code.md)

## Goal

Extend session context with git describe, uncommitted/stash summary; add blame and PR/commit links when navigating to source from a log line.

## Config

- `saropaLogCapture.integrations.adapters` includes `git`
- Optional `saropaLogCapture.integrations.git.*`: describeInHeader, uncommittedInHeader, stashInHeader, blameOnNavigate, prLinks

## Implementation

- **Provider:** `onSessionStartSync`: run `git describe`, `git status --porcelain`, `git stash list`; return header lines + meta. `isEnabled`: adapters includes `git`.
- **Blame/PR:** On "Go to source" from viewer, after opening file call `git blame -L line,line`; resolve commit URL (GitHub/GitLab); show in hover or info message. Use existing `runGitCommand`; non-blocking.
- **Performance:** Sync git commands must be fast (describe, status); timeout and return empty on slow repo. Blame only on explicit navigate.
- **Status bar:** "Git" when adapter contributed at start.

## UX

- No loading spinner for sync git; optional "Loading PR…" for async PR resolution. Gradual: show commit link first, then PR if available.
