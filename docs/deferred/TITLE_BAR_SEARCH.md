# Title Bar Search — Feasibility & Plan

## Motivation

VS Code's built-in views (Problems, Output, Terminal) show a filter/search input
directly in the **view title bar** — the thin strip at the top of each panel.
This is instantly discoverable and always one click away. Our Log Viewer's search
is buried behind an icon-bar button that slides out a side panel, which is less
consistent with the native VS Code experience.

**Question:** Can we move search to the title bar for consistency?

## VS Code API Constraints

### What the title bar supports

The `view/title` contribution point accepts **command buttons only** — icon
actions that appear as small toolbar buttons in the title strip. We already use
this for the trash and pop-out buttons:

```jsonc
"view/title": [
  { "command": "saropaLogCapture.trashSession",  "group": "navigation" },
  { "command": "saropaLogCapture.popOutViewer",   "group": "navigation" }
]
```

### What the title bar does NOT support

- **Custom input fields** — no API to embed `<input>` or search widgets
- **Filter box** — the native filter input on the Problems panel is a
  workbench-internal feature; extensions cannot replicate it
- **Arbitrary HTML** — `view/title` only renders codicon icon buttons
- **TreeView `filterBox`** — proposed in
  [vscode#50062](https://github.com/microsoft/vscode/issues/50062) (closed 2019)
  but only applies to built-in tree views, not webview views

**Conclusion:** There is no VS Code API that lets a WebviewView extension place a
search input in the native title bar. The Problems-panel filter is a privileged
workbench feature unavailable to extensions.

## Current Search Architecture

| Component | File | Role |
|-----------|------|------|
| Search panel HTML | `viewer-search.ts:8-34` | Slide-out panel with input, toggles, nav |
| Search logic | `viewer-search.ts:37+` | Regex build, highlight, filter modes |
| Search history | `viewer-search-history.ts` | Persistent history + debounce |
| Search styles | `viewer-styles-search.ts` | Fixed-position left slide-out, z-index 260 |
| Icon bar button | `viewer-icon-bar.ts` | `#ib-search` (codicon-search) |
| Keyboard shortcut | `viewer-script.ts` | Ctrl+F / F3 opens search |
| Find in Files | `viewer-find-panel.ts` | Cross-session search (separate feature) |

**Current UX flow:**
1. User presses Ctrl+F or clicks the search icon in the left icon bar
2. Search panel slides in from the left edge (over the log content)
3. User types; results highlight or filter in real time
4. Escape closes the panel

## Options

### Option A: Title-bar icon that opens inline search (Recommended)

Add a **search icon** to the `view/title` toolbar. Clicking it sends a command
to the webview, which opens a **top-docked search strip** (like VS Code's
native Ctrl+F find widget) instead of the current side slide-out.

**Changes:**

1. **package.json** — add search button to `view/title`:
   ```jsonc
   {
     "command": "saropaLogCapture.focusSearch",
     "group": "navigation",
     "when": "view == saropaLogCapture.logViewer"
   }
   ```

2. **Extension command** — register `focusSearch` to post a message to the
   webview: `{ type: 'focusSearch' }`

3. **Webview search bar** — reposition from left slide-out to a **top strip**:
   - Fixed to the top of the viewport (below any toolbar)
   - Compact single row: `[input] [Aa] [W] [.*] [mode] [count] [prev] [next] [x]`
   - Collapses to zero height when closed (no overlay)

4. **Viewport offset** — when search strip is visible, shift `#viewport` top
   down by the strip height so log content is not obscured

**Pros:**
- Search icon visible in the title bar at all times (discoverable)
- Top-strip pattern matches VS Code's native Ctrl+F find widget
- No overlay obscuring log content
- Ctrl+F / F3 still work as before
- Minimal code change — same search logic, just repositioned HTML/CSS

**Cons:**
- Not a true native title-bar input (still inside the webview)
- Slightly reduces visible log area when open

### Option B: Keep side panel, add title-bar toggle

Add a search icon to `view/title` that simply triggers the existing slide-out
panel. Minimal change.

**Pros:** Very low effort
**Cons:** Doesn't improve the UX inconsistency; search still slides from the side

### Option C: QuickPick-based search

The title-bar search button opens a VS Code `showInputBox` for the query, then
posts the result back to the webview for highlighting/filtering.

**Pros:** Uses native VS Code UI
**Cons:** Loses real-time-as-you-type feedback, no toggle buttons, poor UX for
iterative searching

## Recommendation

**Option A** provides the best balance of discoverability and UX consistency.
The search strip at the top of the webview visually mirrors VS Code's native
find widget, the title-bar icon makes it discoverable, and the existing search
logic (regex, highlight/filter modes, history) is preserved unchanged.

### Implementation sketch

```
+----------------------------------------------+
| Log Viewer            [search] [trash] [pop] |  <-- native title bar
+----------------------------------------------+
| [input______] [Aa][W][.*] [H/F] 3/42 [^][v] |  <-- webview top strip
+----------------------------------------------+
| 10:03:01.234  Starting app...                |
| 10:03:01.456  Connected to server            |
|              ...virtual scroll...             |
+----------------------------------------------+
```

### Estimated scope

| Area | Files | Lines |
|------|-------|-------|
| package.json (command + menu) | 1 | ~10 |
| Extension command handler | 1 | ~10 |
| Search HTML repositioning | 1 | ~30 |
| Search CSS (top strip layout) | 1 | ~50 |
| Viewport offset when strip open | 1 | ~10 |
| **Total** | **~4** | **~110** |

## References

- [VS Code Views UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/views)
- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [vscode#50062 — Filter/search box API for tree views](https://github.com/microsoft/vscode/issues/50062)
- [vscode#161753 — TreeView search/filter customization](https://github.com/microsoft/vscode/issues/161753)
