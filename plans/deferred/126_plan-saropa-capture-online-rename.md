# 126 — Online rename follow-ups for Saropa Capture

Status: Deferred. Code rename shipped in 9.8.0 (see [../125_plan-rename-to-saropa-capture.md](../125_plan-rename-to-saropa-capture.md)). Nothing here is started.

## Items

1. Rename the GitHub repository `saropa/saropa-log-capture` to `saropa/saropa-capture` (GitHub keeps redirects from the old URL).
2. Replace the intentionally retained `saropa-log-capture` repo URLs and slugs after step 1: `package.json` repository/bugs/homepage, `README.md`, `CHANGELOG.md` header links and `[log]` links, `.github/*`, `.vscode/TEST-EXTENSION.md`, `ROADMAP.md`, `plans/*`, `scripts/modules/publish/constants.py`, `version.py`, `check-stores-version.ps1`, `src/modules/ai/ai-session-resolver.ts`, `src/ui/viewer-panels/viewer-about-panel.ts`.
3. Publish `saropa.saropa-capture` to the VS Code Marketplace and Open VSX; update `marketplace-gallery-query-body.json` as needed.
4. Deprecate the old `saropa.saropa-log-capture` listings with a pointer to the new one.
5. Rename the local folder `d:\src\saropa-log-capture`; update additional-working-directory settings in other projects and the Claude project-memory path.
6. Update badges and remote URLs on dev machines.

## Constraint

Until step 3 ships, installs of the old ID receive no update; the old extension and the new one must not be advised for installation together (the new extension warns when both are present).
