# Plan: Build/CI API Sources (completed)

**Adapter:** `buildCi`  
**Provider:** `src/modules/integrations/providers/build-ci.ts`  
**Completed:** 2026-03-13

## Summary

Build/CI integration now supports API-based sources in addition to the existing file source. Users can set `integrations.buildCi.source` to `file` (default), `github`, `azure`, or `gitlab`. For GitHub, owner/repo and branch are derived from git remote and current branch; for Azure and GitLab, settings `azureOrg`/`azureProject` and `gitlabProjectId` (and optional `gitlabBaseUrl`) are used. Tokens are stored in VS Code SecretStorage; commands to set/clear each token are in the command palette. API fetches run in `onSessionStartAsync` (10s timeout, fail silently); header and meta contributions are applied when the registry is called with `RunOnSessionStartAsyncOptions` and merged at session end. Integration context gained optional `extensionContext` for SecretStorage; registry merges async header (via `LogSession.appendHeaderLines`) and async meta at `runOnSessionEnd`.

## Original plan (reference)

- File-based source only: reads `buildInfoPath` JSON at session start (sync).
- Added: GitHub Actions, Azure DevOps, GitLab CI via `onSessionStartAsync`; `source` config; SecretStorage and set/clear commands; async contribution merge in registry and lifecycle.

## Deferred / not done

- **Proxy:** User proxy settings (`http.proxy`) are not yet applied to API requests; `fetch` uses default environment.
- **Unit tests:** API fetchers are testable in isolation; mocked `fetch` tests could be added later.
