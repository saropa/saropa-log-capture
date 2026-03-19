# Central errors module and viewer load / TS fixes (2026-03-13)

**Summary:** Added central errors barrel; fixed TypeScript and lint in viewer load and related files.

**Done:**
- **Central errors:** `src/modules/analysis/errors.ts` re-exports from level-classifier, error-fingerprint, error-rate-alert, and ErrorStatus type from error-status-store. Plan 023 (AI explain error) updated with Phase 0 and file table; AI context should import from this module.
- **Viewer load:** Restructured performance-data try/catch in `log-viewer-provider-load.ts` so TS parses correctly (no return inside try); eqeqeq fix for `!==`; optional catch.
- **Extension activation:** GitHub auth session check uses `getSession(..., { createIfNone: false })` instead of removed `getSessions`.
- **Build/CI:** Removed `HeadersInit` cast in fetch (type not in lib).
- **Docs:** `cross-session-analysis.md` error-fingerprint paths updated to `src/modules/analysis/error-fingerprint.ts`.

**Files changed:** errors.ts (new), log-viewer-provider-load.ts, extension-activation.ts, build-ci.ts, cross-session-analysis.md, bugs/023_plan-ai-explain-error.md, CHANGELOG.md.
