# Plan: Share Investigation (completed)

**Completed:** 2026-03-13. **Follow-ups:** 2026-03-13.

## Summary

Share Investigation is implemented: users can share an investigation via **GitHub Gist** (shareable `vscode://` deep link) or **Export as .slc file** from the Investigation panel (**Share** button or command **Share Investigation**). GitHub auth uses VS Code built-in auth and SecretStorage; token is cleared on sign-out. Recipients open the link in VS Code to import the investigation (add to store, set active). Import from URL is supported (`/import?gist=...` or `?url=...`). **Phase 3:** Share history (last 10 shares in workspace state); **Recent shares…** in the Share menu to re-copy a link; command **Clear share history** to remove stored links. **Phase 4:** **Share on LAN** — temporary HTTP server (lan-server.ts), copy URL / stop server; **Upload to URL** — setting `share.uploadPutUrl` (presigned S3/Azure etc.), PUT buffer (upload-url.ts); **Save to shared folder** — setting `share.sharedFolderPath`, write .slc to team path (shared-folder.ts). Implemented: `buildInvestigationZipBuffer` / `exportInvestigationToBuffer` in slc-bundle; share module (gist-uploader, gist-importer, github-auth, share-types, share-history); extended deep-links `createUriHandler(importHandlers)`; investigation store `addInvestigation`; size warning for bundles >50 MB; l10n for all user-facing messages; unit tests for importFromUrl validation.

## Follow-ups (done)

- **Gist expiration:** Secret gists do not expire. README and in-product (Gist README, Share menu description) explain how to delete old gists from GitHub.
- **LAN + import:** `importFromUrl` now allows same-network `http` (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16–31.x.x) so teammates can paste a LAN URL (e.g. from Share on LAN) into Import from URL.
- **Copy deep link (local file):** New Share option exports to .slc (save dialog) and copies `vscode://…/import?url=file:///…`; import supports `file://` URLs.

## Original plan

See previous version of this file in git history (`bugs/026_plan-share-investigation.md` before move).
