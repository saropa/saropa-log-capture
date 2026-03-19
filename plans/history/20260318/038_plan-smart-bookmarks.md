# Plan: Smart bookmarks (auto-suggest at first error per run)

**Status:** Implemented  
**Implemented:** 2026-03-18

---

## Implementation summary (2026-03-18)

First-error detection and notification-based suggestion are implemented. **Detection:** `src/modules/bookmarks/first-error.ts` scans content lines (same format as viewer-file-loader), uses `level-classifier` (strict/loose from config), returns first error and optionally first warning (lineIndex, snippet, lineText). **Lifecycle:** After `executeLoadContent` sends lines and run boundaries, first-error scan runs when `smartBookmarks.suggestFirstError` or `suggestFirstWarning` is on; result attached to load result and passed to `onFileLoaded`. **Suggestion:** `maybeSuggestSmartBookmark` in extension-activation runs once per file per session (in-memory Set); skips if that line already has a bookmark; shows VS Code information message "First error at line N. Add bookmark?" with **Add bookmark** / **Dismiss**; Add bookmark calls `bookmarkStore.add` (same as manual bookmark). **Settings:** `saropaLogCapture.smartBookmarks.suggestFirstError` (default true), `saropaLogCapture.smartBookmarks.suggestFirstWarning` (default false). L10n for message and actions in all locale bundles. Unit tests for `findFirstErrorLines`. Not implemented: optional Insights cross-link ("first error in this log" in Errors section); suggested bookmark badge in list (using Option A only).

---

**Feature:** Automatically suggest adding a bookmark at the first error (or first error of a given type) per run/session.

**Context (Insights):** The **Insights panel** (lightbulb icon) shows "Errors in this log" and "Recurring in this log" when a log is open. Smart bookmarks are viewer/session-centric (first error in this run); optional cross-link: e.g. "First error in this log" could be highlighted or surfaced in Insights for the current log so the two features reinforce each other.

---

## What exists

- Bookmarks: user can add/remove bookmarks on lines; bookmarks panel or list.
- Error detection: level classification (error, warning); error fingerprinting and "Errors in this log" in Insights.
- Session and log model.

## What's missing

1. **First-error detection** — For the current session (or when a session is opened), find the first line classified as error (and optionally first warning).
2. **Suggestion UI** — After load or at end of session, if no bookmark exists at that line, show a suggestion: "First error at line 42. Add bookmark?" or auto-add a "Suggested" bookmark that user can keep or remove.
3. **Persistence** — Suggested bookmark can be same as manual bookmark (stored with session/log) or a separate "auto-suggested" list that doesn't clutter manual bookmarks until user confirms.

## Implementation

### 1. Detection

- Scan log lines in order; find first with level === 'error' (and optionally first 'warning'). Return line index and snippet.
- Optional: only suggest if that line is not already bookmarked.

### 2. Suggestion

- **Option A:** Notification or inline hint: "First error at line X. [Add bookmark] [Dismiss]."
- **Option B:** Auto-add a bookmark with a "Suggested" or "First error" label; user can remove or keep. Badge in bookmarks list for "suggested."
- **Option C:** One-time per session: show a small popover or banner near the first error line with "Bookmark this?" and Yes/No.

### 3. Settings

- `saropaLogCapture.smartBookmarks.suggestFirstError` (default true); optional `suggestFirstWarning` (default false). Option to disable suggestions.

## Files to create/modify

| File | Change |
|------|--------|
| New: first-error finder (e.g. `src/modules/bookmarks/first-error.ts`) | Scan lines; return first error (and optional warning) index |
| Bookmark model/store | Optional: "suggested" flag or separate suggested list |
| Viewer or session lifecycle | After load, run first-error; show suggestion or auto-add |
| UI: notification or inline | "Add bookmark at first error?" or suggested bookmark badge |
| Insights panel (optional) | Optional: highlight or surface "first error in this log" in Errors-in-this-log section for consistency |
| `package.json` / settings | Smart bookmark toggles |
| l10n | Strings for suggestion and settings |

## Considerations

- Avoid being noisy: one suggestion per session (or per open), not per line.
- User may already have a bookmark at that line; don't duplicate.

## Effort

**2–4 days** for first-error detection and simple suggestion (notification or auto-add).
