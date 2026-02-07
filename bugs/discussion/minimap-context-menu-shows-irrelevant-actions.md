# Bug: Minimap Right-Click Shows Irrelevant Cut/Copy/Paste Actions

## Summary
Right-clicking on the VS Code minimap displays the standard editor context menu (Cut, Copy, Paste, etc.), which has no meaningful function in the minimap context.

## Limitations

- **No VS Code setting exists** to customize or disable the minimap context menu independently of the editor context menu.
- **Extensions cannot override** the minimap's right-click behavior. The VS Code extension API does not expose the minimap context menu as a contribution point.
- **The minimap shares the editor's context menu** by design. There is no separation between the two in VS Code's architecture.
- **Disabling the minimap entirely** (`editor.minimap.enabled: false`) is the only way to remove the menu, but this loses the minimap itself.
- **No upstream fix is planned.** As of VS Code 1.98, this remains the default behavior with no open proposal to change it.

## Impact
Low — cosmetic UX issue only. The actions appear but do nothing harmful.

## Workarounds
- Ignore the menu items.
- Disable the minimap if it is not needed.
- File a feature request on [microsoft/vscode](https://github.com/microsoft/vscode/issues) for a minimap-specific context menu.

---
**Priority:** Low
**Environment:** VS Code (all platforms)
**Date:** 2026-02-03
