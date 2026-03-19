# Plan: Configurable Marketplace URL (remove hardcoding)

**Status: Implemented** (2026-03-13)

**Summary:** Added `src/modules/marketplace-url.ts` with `getMarketplaceBaseUrl()`, `buildChangelogUrl(extensionId)`, and `buildItemUrl(extensionId)`. All marketplace links (about-content-loader, viewer-about-panel, bug-report-formatter, gist-uploader) now use this module. About panel changelog link initial `data-url` is `#` and only opens when host has sent `aboutContent.changelogUrl` (guard against openUrl with `#`).

---

**Issue:** ROADMAP §3 — Hardcoded Marketplace URL  
**Location:** `about-content-loader.ts` (and related About/links usage)  
**Severity:** Low

---

## Goal

Centralize the “marketplace base URL” so that all consumer code uses one definition. Fork maintainers can change `MARKETPLACE_BASE` in one file for Open VS X or other hosts.

## Files modified

| File | Change |
|------|--------|
| `src/modules/marketplace-url.ts` | New: `getMarketplaceBaseUrl()`, `buildChangelogUrl()`, `buildItemUrl()` |
| `src/ui/viewer-panels/about-content-loader.ts` | Uses shared `buildChangelogUrl` |
| `src/ui/viewer-panels/viewer-about-panel.ts` | Uses `buildItemUrl()` for project links; changelog link guard `url !== '#'` |
| `src/modules/bug-report/bug-report-formatter.ts` | Uses `buildItemUrl('Saropa.saropa-log-capture')` |
| `src/modules/share/gist-uploader.ts` | Uses `buildItemUrl('saropa.saropa-log-capture')` |
