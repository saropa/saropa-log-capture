# Copy All script error (fixed 2026-02-28)

## Summary

"Copy All" (and single-line copy via copy-float) could throw in the log viewer webview:

```
Script error: Uncaught TypeError: Cannot read properties of undefined (reading 'replace')
```

## Cause

`stripTags(html)` in the viewer script called `html.replace(...)`. For some lines, `html` was undefined (e.g. line object missing `.html`), so `.replace` threw.

## Resolution

- **viewer-script.ts:** `stripTags` is now null/undefined-safe: `(html == null ? '' : String(html)).replace(...)`.
- **viewer-copy.ts:** Copy All and copy-float call `stripTags(line.html)`; no extra guards needed since `stripTags` handles null/undefined.
- Unit test added: viewer script defines null-safe `stripTags` (see `viewer-script-syntax.test.ts`).

Fixed in same release as src-folder reorganization (2.0.18).
