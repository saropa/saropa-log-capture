# Project Logs multi-select (2026-03-13)

## Summary
Implemented Ctrl/Cmd-click multi-select in the Project Logs panel and extended the session context menu to operate on the selection.

## Implemented
- **Multi-select:** Ctrl-click (or Cmd-click) toggles selection; plain click clears and opens. Selection state survives list re-renders (filters, refresh).
- **Context menu:** Right-click on a selected item applies to all selected; right-click on unselected applies to that item only. Menu labels pluralize for copy (Copy Deep Links / Copy File Paths).
- **Actions:** Copy Deep Links and Copy File Paths write newline-separated values. Export, Tag, Trash, Restore, Rename, Add to Investigation run per session (sequentially). Open opens each in turn; Replay uses first selected.
- **Trash panel:** Unchanged; still single-selection (same API with one-element arrays).

## Files changed
Session panel script and rendering, session context menu script, message handler and session action handler (array payload), handler wiring, provider/pop-out handler types, l10n (deepLinksCopied, filePathsCopied), session list styles (selected state), test expectation update.
