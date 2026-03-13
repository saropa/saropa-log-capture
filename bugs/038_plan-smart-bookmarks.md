# Plan: Smart bookmarks (auto-suggest at first error per run)

**Feature:** Automatically suggest adding a bookmark at the first error (or first error of a given type) per run/session.

---

## What exists

- Bookmarks: user can add/remove bookmarks on lines; bookmarks panel or list.
- Error detection: level classification (error, warning); possibly error fingerprinting or grouping.
- Session and log model.

## What's missing

1. **First-error detection** — For the current session (or when a session is opened), find the first line classified as error (and optionally first warning).
2. **Suggestion UI** — After load or at end of session, if no bookmark exists at that line, show a suggestion: "First error at line 42. Add bookmark?" or auto-add a "Suggested" bookmark that user can keep or remove.
3. **Persistence** — Suggested bookmark can be same as manual bookmark (stored with session/log) or a separate "auto-suggested" list that doesn’t clutter manual bookmarks until user confirms.

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
| `package.json` / settings | Smart bookmark toggles |
| l10n | Strings for suggestion and settings |

## Considerations

- Avoid being noisy: one suggestion per session (or per open), not per line.
- User may already have a bookmark at that line; don’t duplicate.

## Effort

**2–4 days** for first-error detection and simple suggestion (notification or auto-add).
