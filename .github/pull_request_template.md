## Summary

<!-- What does this PR change and why? -->

## Checklist

- [ ] `npm run compile` passes (types, ESLint, NLS, webview message catalog, `dist/` size guard)
- [ ] If you added or renamed a **log viewer webview → extension** `postMessage` handler (`case "…"` in `viewer-message-handler*.ts` or a key in `viewer-workspace-bool-message-map.ts`), run `npm run generate:webview-catalog` and commit `doc/internal/webview-incoming-message-types.md`
- [ ] `npm run test` passes (or explain why not, e.g. environment-only)
- [ ] User-visible strings: NLS keys updated if needed (`package.nls.json` + `verify-nls` locales)
- [ ] No editor/tool trailers in commit messages (see CONTRIBUTING)
