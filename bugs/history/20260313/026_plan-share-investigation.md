# Plan: Share Investigation (completed)

**Completed:** 2026-03-13

## Summary

Share Investigation is implemented: users can share an investigation via **GitHub Gist** (shareable `vscode://` deep link) or **Export as .slc file** from the Investigation panel (**Share** button or command **Share Investigation**). GitHub auth uses VS Code built-in auth and SecretStorage; token is cleared on sign-out. Recipients open the link in VS Code to import the investigation (add to store, set active). Import from URL is supported (`/import?gist=...` or `?url=...`). Implemented: `buildInvestigationZipBuffer` / `exportInvestigationToBuffer` in slc-bundle; share module (gist-uploader, gist-importer, github-auth, share-types); extended deep-links `createUriHandler(importHandlers)`; investigation store `addInvestigation`; size warning for bundles >50 MB; l10n for all user-facing messages; unit tests for importFromUrl validation.

## Original plan

See previous version of this file in git history (`bugs/026_plan-share-investigation.md` before move).
