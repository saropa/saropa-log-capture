# Bug 044 — Stale GitHub token not cleared on 401

## Status: Fixed

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

The core 401 handler (`handleGitHubApiUnauthorized()` in `src/modules/share/github-auth.ts`) was
already implemented and wired into the share path (`src/modules/share/gist-uploader.ts`) before
this pass. Two gaps remained and are now closed:

1. **`gist-importer.ts` not wired**: `importFromGist()` in `src/modules/share/gist-importer.ts`
   now takes an optional `context: vscode.ExtensionContext` parameter and calls
   `handleGitHubApiUnauthorized(context, res)` when the initial Gist metadata fetch
   (`GET https://api.github.com/gists/{id}`) returns non-OK, clearing any stale token before
   surfacing the "not found or not accessible" error — import hits the same GitHub API host as
   share/upload, so a token left stale by a prior share attempt could otherwise 401 here too with
   no recovery path. `src/extension-activation.ts`'s `importFromGist` deep-link handler now
   passes `context` through. The raw-content download (`slcFile.raw_url`, on
   `gist.githubusercontent.com`, unauthenticated) is not wired — it never sends the stored token,
   so a 401 there would not indicate a stale-token condition.
2. **No manual `clearGitHubToken` command**: added
   `saropaLogCapture.clearGitHubToken` (`src/collection-commands-share.ts`, next to the existing
   `clearShareHistory` command) — calls `clearGitHubToken(context)` and shows a confirmation
   message (`msg.githubTokenCleared`) so the user isn't left guessing whether the action worked.
   Declared in `contributes.commands` (`package.json`) with NLS key
   `command.clearGitHubToken.title` added to `package.nls.json` and all 10 locale files
   (English placeholder text — machine translation was not run this pass, per the project's
   operator-run-only MT policy).

Also see bug_043's Changes Made for an unrelated incident (destroyed then reconstructed
uncommitted `package.json` state) discovered while verifying this fix's `contributes.commands`
entry — package.json is confirmed consistent again via the full `npm run compile` gate chain.

## Tests Added

No new test file. Manually re-ran the existing `src/test/modules/share/gist-importer.test.ts`
suite (3 tests, `importFromUrl` validation/error-message coverage) via
`npm run test:file -- out/test/modules/share/gist-importer.test.js` — all 3 pass; the new
`context` parameter is optional and additive, so no existing test needed updating.

## Commits
<!-- Add commit hashes as fixes land. -->
