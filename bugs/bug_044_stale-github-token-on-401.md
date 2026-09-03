# Bug 044 — Stale GitHub token not cleared on 401

## Status: Open

## Severity: Medium

Every GitHub API request fails silently after a token is revoked, until the user starts a new debug session.

## Problem

When a GitHub API request returns 401 (token revoked or expired), `clearGitHubToken` is not called. The stale token remains cached and every subsequent request fails silently until the user starts a new debug session (which triggers session-change cleanup). There is no "re-authenticate" action offered.

## Reproduction

1. Authenticate with GitHub in the extension.
2. Revoke the token externally (e.g. from GitHub settings).
3. Trigger any GitHub-integrated action (e.g. issue creation from a bug report).
4. Observe the request fails silently and repeats the same failure on retry, with no prompt to re-authenticate, until a new debug session starts.

**Frequency:** Always (once a token is revoked externally).

## Root Cause

`src/ui/integrations/github-auth.ts:12-15` vs `extension-activation.ts:199-205` — token invalidation is tied to the session lifecycle instead of to API response status codes.

## Proposed Fix

Call `clearGitHubToken()` on any 401 response. Show a notification: "GitHub token expired. Re-authenticate?" with a button that triggers the auth flow. Add a `clearGitHubToken` command for manual use.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
