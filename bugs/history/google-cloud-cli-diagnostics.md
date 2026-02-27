# Google Cloud CLI - Crashlytics Panel Diagnostics

## Original Issues

1. "Check Again" doesn't do anything - no user message
2. "Check Again" should then show the last checked date time

## Resolution (2026-02-15)

Both issues resolved by adding structured diagnostics throughout the Crashlytics pipeline:

- **"Check Again" feedback:** The panel now shows a loading state when "Check Again" is clicked, followed by either the issue list or a diagnostic error box with the actual failure reason (gcloud not found, auth expired, permission denied, wrong project ID, etc.).
- **Last checked timestamp:** A "Last checked: X ago" label is now shown in the diagnostic box when an error occurs, using `formatElapsedLabel()` to display a human-readable time.

### Files Changed

- `src/modules/crashlytics-diagnostics.ts` (new) — diagnostic types, output channel, error classifiers
- `src/modules/crashlytics-types.ts` (new) — extracted shared type interfaces
- `src/modules/firebase-crashlytics.ts` — logging, HTTP status checks, diagnostic propagation
- `src/ui/crashlytics-panel.ts` — diagnostic UI rendering in setup wizard and issue list
- `src/ui/insights-crashlytics-bridge.ts` — shared output channel import
