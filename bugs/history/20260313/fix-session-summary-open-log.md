# Fix: Session summary "Open Log" did nothing

**Date:** 2026-03-13

## Summary

After a debug session ended, the notification showed an "Open Log" button. Clicking it had no effect because the handler ran `saropaLogCapture.open`, which opens only the *active* session; by then the session was already finalized and no longer active.

## Change

- **SessionSummary** may now include an optional **logUri**. When present, "Open Log" opens that URI with `showTextDocument` instead of invoking the open command.
- **withLogUri(summary, logUri)** helper attaches the finalized session’s file URI to the summary.
- **finalizeSession** passes the completed log URI into the summary: `showSummaryNotification(withLogUri(generateSummary(...), logSession.fileUri))`.

No new user-facing strings; existing `action.openLog` is unchanged. Status bar and other callers of `saropaLogCapture.open` are unchanged.
