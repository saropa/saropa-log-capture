# Plan: Crashlytics setup automation and help when connection fails

**Status:** Implemented.

**Summary:** Improved Firebase Crashlytics setup and troubleshooting: gcloud install one-liner (winget/brew), setup checklist (✓/✗/○), Copy diagnostic and Show Output when connection fails, Open Firebase Console link, “run in external terminal” hint and service account key alternative, proactive status bar (ready vs setup), and service account JSON key auth for environments without gcloud.

---

## Implemented

1. **Step 1 (gcloud):** OS-specific install one-liner with Copy button (Windows: winget, macOS: brew). “If gcloud is not in PATH after installing, restart the terminal or VS Code.”
2. **Step 2 (token):** External terminal hint with copyable `gcloud auth application-default login`; Permission denied / Crashlytics Viewer role hint; service account setting hint.
3. **Step 3 (config):** “Use existing file: android/app/google-services.json” when a workspace file exists; Open Firebase Console (project-specific when available).
4. **Setup checklist:** One-line status (✓ gcloud · ✗ token · ○ config) at top of setup wizard.
5. **When connection fails:** Copy diagnostic (plain text for support/terminal), Show Output (Saropa Log Capture channel), Open Firebase Console. Same actions on “Query failed” (e.g. 404). Diagnostic copy includes proxy/VPN hint for timeout/network.
6. **Status bar:** “Crashlytics: ready” or “Crashlytics: complete setup in panel” on workspace load and folder change; updates after panel refresh; click opens log viewer.
7. **Service account key:** Setting `saropaLogCapture.firebase.serviceAccountKeyPath` (path to JSON key). Token obtained via `google-auth-library` when set; fallback to gcloud. Documented in FIREBASE_CRASHLYTICS.md. Status bar and getFirebaseContext treat token-first so SA-only users never see the gcloud step.

## Files changed

- `src/modules/crashlytics/firebase-crashlytics.ts` — getGcloudInstallCommand, getCrashlyticsStatus, token-first getFirebaseContext, resolveServiceAccountKeyPath, setupChecklist.
- `src/modules/crashlytics/crashlytics-service-account.ts` — New: getAccessTokenFromServiceAccount (JWT from key file).
- `src/modules/crashlytics/crashlytics-types.ts` — SetupChecklist, SetupStepStatus.
- `src/ui/shared/handlers/crashlytics-handlers.ts` — handleCrashlyticsRequest extras, handleCrashlyticsShowOutput, notifyCrashlyticsStatusBarUpdate, fallback setupChecklist in catch.
- `src/ui/shared/handlers/crashlytics-serializers.ts` — SerializeContextExtras, buildDiagnosticCopyText, setupChecklist, diagnosticCopyText.
- `src/ui/panels/viewer-crashlytics-panel.ts` — Checklist, gcloud install line + copy, token step external hint + SA hint, config “Use existing file”, Copy diagnostic / Show Output / Open Console, buildChecklistHtml.
- `src/ui/viewer-styles/viewer-styles-crashlytics.ts` — cp-checklist, cp-install-via, cp-copy-btn, cp-setup-why, cp-use-existing, cp-diag-actions-row, cp-btn-secondary, cp-open-console.
- `src/ui/shared/crashlytics-status-bar.ts` — New: CrashlyticsStatusBar, setCrashlyticsStatusBarUpdateCallback, notifyCrashlyticsStatusBarUpdate.
- `src/extension-activation.ts` — CrashlyticsStatusBar registration, setCrashlyticsStatusBarUpdateCallback, onDidChangeWorkspaceFolders.
- `src/ui/provider/viewer-message-handler.ts` — crashlyticsShowOutput.
- `src/ui/shared/viewer-panel-handlers.ts` — handleCrashlyticsShowOutput export.
- `src/l10n.ts` — statusBar.crashlyticsReady, statusBar.crashlyticsSetupNeeded.
- `package.json` — saropaLogCapture.firebase.serviceAccountKeyPath, google-auth-library dependency.
- `package.nls.json` + locale files — serviceAccountKeyPath description.
- `docs/FIREBASE_CRASHLYTICS.md` — Service account key section, token lifecycle note.
