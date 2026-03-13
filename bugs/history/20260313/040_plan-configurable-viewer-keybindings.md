# Plan: Configurable viewer keybindings (power shortcuts) — COMPLETED

**Summary (2026-03-13):** Implemented. Power shortcuts are driven by a key→action map; default map is injected in the viewer script and overridden via `saropaLogCapture.viewerKeybindings` (actionId → key descriptor). Options → Keyboard shortcuts: double-click power shortcut row to enter record mode (status bar: "Press a key for [action] (Escape to cancel)"); next key is saved and broadcast to all views. Escape cancels. Command rows still open VS Code Keyboard Shortcuts. Single merge helper `mergeUserKeybindings`; `getViewerKeybindingsFromConfig` and `getViewerActionToKeyFromConfig` use it. Unit tests for normalizeKeyDescriptor, buildKeyToAction, getDefaultKeyToAction, getViewerActionLabel.

---

# Plan: Configurable viewer keybindings (power shortcuts)

**Feature:** Let users rebind the panel viewer power shortcuts (Ctrl+F, Space, M, P, etc.) instead of using the current hardcoded keys. The app remains the source of truth; changes are persisted in settings or workspace state.

---

## What exists

- **Power shortcuts** are implemented in the webview in `viewer-script-keyboard.ts`: a single `keydown` handler with hardcoded key → action mapping (e.g. `e.key === ' '` → toggle pause, `e.key === 'm'` → insert marker).
- **Command Palette commands** are already user-rebindable via VS Code **Keyboard Shortcuts** (Ctrl+K Ctrl+S); the Options → Keyboard shortcuts panel now explains this and supports double-click-to-open-keybindings for those commands.
- Options → **Keyboard shortcuts…** lists both power shortcuts and key commands; power shortcut rows are not rebindable from the UI today.

## What's missing

1. **Schema** — Define which viewer actions are rebindable (e.g. open search, pause, word wrap, insert marker, pin, annotate, copy, etc.) and a stable action ID per action.
2. **Storage** — Persist key → action overrides. Options: `saropaLogCapture.viewerKeybindings` in settings (JSON object mapping actionId → key descriptor, e.g. `{ "openSearch": "ctrl+f", "togglePause": "space" }`) or workspace/global state. Default: use current hardcoded keys when no override is set.
3. **Key descriptor format** — Normalize key+modifiers (e.g. `ctrl+shift+f`, `space`, `m`) so storage and comparison are consistent across platforms (Ctrl vs Cmd can be handled at read time).
4. **Record-key UI** — In the Keyboard shortcuts panel, allow double-click (or a "Change" control) on a **power shortcut** row to enter "record mode": listen for the next keydown, then save that key as the binding for that action. Show conflicts (e.g. same key already bound to another action) and let the user resolve (replace or cancel).
5. **Runtime** — In `viewer-script-keyboard.ts`, replace hardcoded key checks with a lookup from the configured keybindings (injected or sent via message when the panel loads). Keep a fallback to current defaults if config is missing or invalid.

## Implementation outline

1. **Settings / state** — Add a setting or state key for viewer keybindings; document the action IDs and key format in CONTRIBUTING or a short doc.
2. **Viewer script** — Build the key → action map from config (and defaults); in the keydown handler, use the map instead of literal key checks. Ensure modifier handling (ctrl, meta, shift) is consistent.
3. **Options panel** — For power-shortcut rows, add a double-click (or explicit "Change" button) that posts a message to the extension to enter "record key for action X". Extension shows a quick input or focuses the viewer and waits for keydown; on key received, update settings/state and send new keybindings to the viewer.
4. **Conflict handling** — When recording a key already in use, either overwrite the other action's binding or show a small confirmation ("Replace binding for Open search?").
5. **Accessibility** — Ensure the record-key flow is keyboard and screen-reader friendly (focus management, clear instructions).

## Files to touch

| Area | Files |
|------|--------|
| Keybindings config | New module or section in existing settings for `viewerKeybindings`; optional default map constant. |
| Viewer keyboard | `viewer-script-keyboard.ts` — drive handler from config; receive config via postMessage or initial script payload. |
| Options / shortcuts UI | `viewer-keyboard-shortcuts-html.ts` (power shortcut rows: data-action-id, optional "Change" control), `viewer-options-panel-script.ts` (double-click → postMessage openKeybindings is for commands only; add openRecordViewerKey for power shortcuts). |
| Message handler | `viewer-message-handler.ts` — handle "recordViewerKey" (start record), "setViewerKeybinding" (apply new key), "getViewerKeybindings" (return current map for UI). |
| i18n | If we add labels for "Change key" or "Record key", add strings to package.nls.json. |

## Considerations

- **Scope** — Keybindings could be per-workspace or global; decide and document (e.g. workspace setting vs user setting).
- **Reset** — Provide "Reset to default" for a single binding or all viewer keybindings from the Keyboard shortcuts screen.
- **Discoverability** — The Keyboard shortcuts panel already lists power shortcuts; making rows double-clickable (or adding a small "Change" link) keeps discovery in one place.
