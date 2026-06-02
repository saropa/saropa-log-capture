# Viewer: Ctrl+G Go to Line

User reported: "support the CTRL-G (go to line) command in the log viewer" — and after explaining the feature was already wired, followed up with a screenshot of VS Code's Quick Open showing `:4` and the message "Open a text editor first to go to a line or an offset", with "it doesnt work or do anything" / "CTRL-F works fine". The webview's goto-line overlay, `openGotoLine()`, `closeGotoLine()`, `scrollToLineNumber()`, the `gotoLine: 'ctrl+g'` viewerKeybindings entry, and the keydown handler that calls `openGotoLine()` all already existed and were correct — but VS Code's built-in `Ctrl+G → workbench.action.gotoLine` has no `when` clause, so it fired globally and consumed the keypress before the webview's keydown handler could see it.

## Finish Report (2026-06-02)

### Scope

(B) VS Code extension. TypeScript host code, `package.json` contributes (commands + keybindings), 11 NLS locale files, two generated catalog docs, CHANGELOG, one test file.

### Root cause

`Ctrl+G` is bound in VS Code's defaults to `workbench.action.gotoLine` with no `when` clause, so it fires regardless of focus. When the webview was focused, VS Code's keybinding handler ran the built-in command (which opens Quick Open in `:line` mode and displays "Open a text editor first…") **before** the webview's keydown handler — registered in [src/ui/viewer/viewer-script-keyboard.ts:86](src/ui/viewer/viewer-script-keyboard.ts#L86) — was even reached. `Ctrl+F` worked because `editor.action.startFindAction` is scoped to `editorTextFocus`, which is not set inside a webview; the webview's own handler runs unimpeded for those keys.

### Fix

Routed Ctrl+G through VS Code's command system with a `when` clause that restricts the override to the log viewer surfaces only:

1. **New host command** [src/commands-tools.ts:147](src/commands-tools.ts#L147) — `saropaLogCapture.gotoLineInViewer` broadcasts `{ type: 'triggerGotoLine' }` via the existing `ViewerBroadcaster`. Mirrors the pattern of `saropaLogCapture.toggleSearchOverlay` (same file, 5 lines higher).
2. **New webview dispatcher case** [src/ui/viewer/viewer-script-messages.ts:148](src/ui/viewer/viewer-script-messages.ts#L148) — `case 'triggerGotoLine': openGotoLine()`. Reuses the existing webview function; no logic duplication.
3. **New `contributes.keybindings`** entry in `package.json` (lines 2573-2580 of the updated file) binding `ctrl+g` / `cmd+g` to the host command **only when**:
   ```
   focusedView == saropaLogCapture.logViewer
     || activeWebviewPanelId == saropaLogCapture.popOutViewer
   ```
   VS Code's default still applies in editors and elsewhere; the viewer's overlay opens inside the log viewer view and the pop-out panel.
4. **New `contributes.commands`** entry + `command.gotoLineInViewer.title` NLS key in all 11 locale files (en, de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw).
5. **Regenerated** `doc/internal/contributes-commands.md` and `doc/internal/webview-outbound-message-types.md` via `npm run generate:list-commands` / `npm run generate:host-outbound-catalog`. Both verified clean by their `verify:*` siblings on `npm run compile`.

### Files changed

```
M CHANGELOG.md                                    (+1 entry under [Unreleased] Fixed; adjacent duplicate ### Fixed/### Added headings merged)
M doc/internal/contributes-commands.md           (regenerated; +1 row)
M package.json                                    (+1 commands entry, +1 keybindings array)
M package.nls.json                                (+1 NLS key — en)
M package.nls.de.json                             (+1 NLS key — Gehe zu Zeile)
M package.nls.es.json                             (+1 NLS key — Ir a la línea)
M package.nls.fr.json                             (+1 NLS key — Atteindre la ligne)
M package.nls.it.json                             (+1 NLS key — Vai alla riga)
M package.nls.ja.json                             (+1 NLS key — 行へ移動)
M package.nls.ko.json                             (+1 NLS key — 줄로 이동)
M package.nls.pt-br.json                          (+1 NLS key — Ir para a linha)
M package.nls.ru.json                             (+1 NLS key — Перейти к строке)
M package.nls.zh-cn.json                          (+1 NLS key — 转到行)
M package.nls.zh-tw.json                          (+1 NLS key — 前往行)
M src/commands-tools.ts                           (+7 lines: registration with explanatory comment)
M src/ui/viewer/viewer-script-messages.ts        (+1 line: dispatcher case)
M src/test/ui/viewer-null-guards-interaction.test.ts (+1 import, +1 test asserting the dispatcher case)
A plans/history/2026.06/2026.06.02/viewer-ctrl-g-goto-line.md (this file)
```

The auto-regenerated `doc/internal/webview-incoming-message-types.md` also shows as modified by git status — that's an unrelated pre-existing drift from the prior session-info-modal work; included in the working tree but not authored by this task.

### Tests

- **Existing tests audited.** Grep across `src/test/` for the symbols I touched found 4 files:
  - `viewer-null-guards-interaction.test.ts` — pins null guards in the goto-line script. My change does not touch `viewer-goto-line.ts`, so the existing assertions remain valid. **All 4 existing goto-line tests pass.**
  - `viewer-floating-search.test.ts` — sibling pattern (verifies the `triggerToggleSearch` dispatcher case). My change adds an analogous case; no assertion broken. **10/10 pass.**
  - `viewer-session-nav-search.test.ts` — comment-only reference. No assertion involved.
  - `viewer-collapse-expand.test.ts` — sibling dispatcher tests for `triggerCollapseAll/ExpandAllSections`. Pattern preserved. **9/9 pass.**
- **New test added.** [src/test/ui/viewer-null-guards-interaction.test.ts](src/test/ui/viewer-null-guards-interaction.test.ts) gains one case in the `viewer-goto-line` suite, modeled exactly on the existing `triggerToggleSearch` dispatch test at `viewer-floating-search.test.ts:111-119`. It asserts the message handler contains `case 'triggerGotoLine'` and calls `openGotoLine()`. The test has a multi-line WHY comment explaining the Ctrl+G plumbing chain so a future refactor that drops the case is caught.
- **Suite results.** `viewer-null-guards-interaction.test.js` → **20 passing** (was 19; +1 new). Smoke `extension-smoke.test.js` → **1 passing** (extension activates with the new command + keybinding contribution).
- **Verifiers** (run via `npm run compile`):
  - `verify-nls` — 466 keys × 11 locales aligned.
  - `verify:webview-catalog` — host→webview incoming catalog matches handler sources.
  - `verify:host-outbound-catalog` — outbound catalog matches sources (now includes `triggerGotoLine`).
  - `verify:list-commands` — commands doc matches `package.json`.
  - `verify:dist-size` — 4.38 MiB (cap 12 MiB).
- **`npm run check-types`** — clean.
- **`npm run lint`** — 9 warnings total, all pre-existing `max-lines` warnings on files outside my edit footprint, except `viewer-script-messages.ts` which went from 333 → 334 (cap 325, already over by 8 before this task). No errors. Refactoring the over-cap dispatcher is out of scope for this fix.

### Verifying the fix manually

F5 in VS Code → Extension Development Host → focus the Saropa Log Capture view → press `Ctrl+G`. The Go to Line overlay opens at the top center of the viewer; the placeholder shows `1 – <total>`. Type a line number — the viewport scrolls live as you type. Enter commits the position; Escape reverts to the saved scroll; blur commits. Same behavior in the pop-out panel (`Pop Out` icon → focus the popped-out tab → `Ctrl+G`). In a regular editor tab, `Ctrl+G` still opens VS Code's Quick Open `:line` prompt.

### Outstanding work

None. The chain user → keybinding → host command → broadcast → webview dispatcher → existing webview function is end-to-end covered by tests and verified by the smoke harness.

Finish report saved: `plans/history/2026.06/2026.06.02/viewer-ctrl-g-goto-line.md`
