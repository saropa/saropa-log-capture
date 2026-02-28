# Crashlytics: google-services.json discovery and error UX

## Issue

1. Extension did not reliably find `google-services.json` when it lived under `android/app/` (common in Flutter/Android projects); a single `findFiles('**/google-services.json')` could return a different file first in multi-root or large workspaces.
2. On HTTP 404 ("Project or app not found"), the error message did not mention `google-services.json` or where the extension reads config, so users did not know to check that file or settings.
3. No way to open the config file from the Crashlytics panel when the query failed.

## Resolution

- **Discovery:** Prefer `**/android/**/google-services.json`, then any `**/google-services.json` (excluding node_modules). Both searches run in parallel. Log which file was used (e.g. `Config from android/app/google-services.json`).
- **Messages:** 404 and "no file found" / setup hint now point to `google-services.json` (e.g. android/app/) and `saropaLogCapture.firebase.projectId / .appId`. Single shared constant `firebaseConfigSetupHint` in `crashlytics-diagnostics.ts` to keep wording consistent.
- **Open action:** When the panel shows "Query failed" (e.g. 404), an **Open google-services.json** button opens the file the extension would use (same discovery), with a progress notification while resolving.

## Files changed

- `src/modules/firebase-crashlytics.ts` — findBestGoogleServicesJson (parallel search, prefer android), use firebaseConfigSetupHint
- `src/modules/crashlytics-diagnostics.ts` — firebaseConfigSetupHint, 404 message
- `src/ui/viewer-panel-handlers.ts` — handleOpenGoogleServicesJson (withProgress)
- `src/ui/viewer-crashlytics-panel.ts` — error view button + comment
- `src/ui/viewer-message-handler.ts`, `src/ui/pop-out-panel.ts` — handle crashlyticsOpenGoogleServicesJson
- `src/ui/viewer-styles-crashlytics.ts` — .cp-diag-actions
- `docs/FIREBASE_CRASHLYTICS.md` — detection priority and Open button
