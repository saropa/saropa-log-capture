## Summary

<!-- What does this PR change and why? -->

## Checklist

- [ ] `npm run compile` passes (types, ESLint, NLS, webview message catalog, `dist/` size guard)
- [ ] If you added or renamed a **log viewer webview → extension** `postMessage` handler (`case "…"` in `viewer-message-handler*.ts` or a key in `viewer-workspace-bool-message-map.ts`), run `npm run generate:webview-catalog` and commit `doc/internal/webview-incoming-message-types.md`
- [ ] If you added or changed **extension → webview** `postMessage` payloads (`type` field from host code), run `npm run generate:host-outbound-catalog` and commit `doc/internal/webview-outbound-message-types.md` (see `scripts/modules/webview-host-outbound-catalog.mjs` for scan rules)
- [ ] If you added or renamed **`contributes.commands`** in `package.json`, run `npm run generate:list-commands` and commit `doc/internal/contributes-commands.md`
- [ ] `npm run test` passes (or explain why not, e.g. environment-only)
- [ ] User-visible strings: NLS keys updated if needed (`package.nls.json` + `verify-nls` locales)
- [ ] No editor/tool trailers in commit messages (see CONTRIBUTING)
