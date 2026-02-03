# Discussion: View Title Filter Bar (like Problems, Output, Debug Console)

## Summary
VS Code's built-in panels (Problems, Output, Debug Console) each have a filter input bar embedded in their title/toolbar area with toggle icons. Can we replicate this for the Saropa Log Capture webview panel?

## What Native Panels Provide
- **Problems:** Filter text input with glob support (`**/*.ts`, `!**/node_modules`), severity toggle buttons (Error, Warning, Info)
- **Output:** Filter text input with exclusion support (`!excludeText`), channel selector dropdown
- **Debug Console:** Filter text input with exclusion/regex support (`!exclude`, `\escape`)
- **Terminal:** No filter bar, but has tab management and split controls

## Constraint: WebviewView API Limitations
The filter bars in native panels are **built-in VS Code workbench chrome** rendered outside the webview content area. The VS Code extension API does **not** expose a filter input widget for WebviewView providers.

What the API does expose for `view/title`:
- Icon buttons that trigger commands (via `contributes.menus` > `view/title`)
- `when` clauses to conditionally show/hide buttons
- Inline vs overflow menu placement (`"group": "navigation"` for inline)

What it does **not** expose:
- Text input fields in the title bar
- Dropdown selectors in the title bar
- Native filter widget for webviews

## Current State
The extension already has more filtering power than any native panel:

| Capability | Native Panels | Saropa Log Capture |
|---|---|---|
| Text search | Title bar input | Search panel (Ctrl+F) with case/regex/whole-word |
| Cross-file search | None | Find in Files (Ctrl+Shift+F) |
| Severity filtering | Problems only (3 levels) | 7 levels with context lines slider |
| Category/channel | Output dropdown | Checkbox per DAP category |
| Exclusion patterns | `!text` prefix in some | Dedicated rules with regex support |
| App-only filter | None | Framework vs app classification |
| Filter presets | None | Save/load named presets |
| Filter status badge | None | Active filter count indicator |

All filters are accessed via the right-edge icon bar (slide-out panels) and footer flyup menu.

## Options

### Option A: Add Quick-Toggle Icons to View Title Bar
Add high-frequency filter toggles as icon buttons in the panel's title toolbar, next to the existing pop-out button.

**Candidates for title bar icons:**
- Exclusions on/off (funnel icon)
- App-only toggle (app icon)
- Level filter summary (warning icon, opens level flyup or quick pick)
- Search (magnifying glass, opens Ctrl+F panel or VS Code input box)

**Pros:**
- Familiar placement for VS Code users
- Quick single-click access to common filters
- No webview changes needed for the buttons themselves

**Cons:**
- Icons only, no text input (API limitation)
- State feedback is limited (can toggle icon appearance via `when` clauses, but no badge/count)
- Duplicates controls already in the webview icon bar

### Option B: Embed a Filter Bar Inside the Webview (Top Edge)
Render a filter input bar at the top of the webview content that visually mimics the native panel filter bars.

**Pros:**
- Full control over layout, text input, toggle buttons, badges
- Can match native look using `--vscode-*` CSS variables
- Could be always-visible or collapsible

**Cons:**
- Consumes vertical space inside the webview (reduces log viewport)
- Not truly native — subtle visual/behavioral differences
- Duplicates the existing search panel functionality
- Additional maintenance surface

### Option C: Keep Current Architecture (No Change)
The existing icon bar + slide-out panels + footer flyup already exceed native panel capabilities. The interaction model is different but more powerful.

**Pros:**
- No new code or maintenance burden
- Filters are already more capable than native panels
- No vertical space lost to a persistent filter bar

**Cons:**
- Less discoverable for users expecting the native filter bar pattern
- Requires learning the icon bar and footer interactions

### Option D: Hybrid — Title Bar Icons + Existing Panels
Add a few toggle icons to the `view/title` bar for the most common operations, keeping the full panel system for detailed control.

**Example title bar additions:**
1. Filter toggle (funnel icon) — shows/hides active exclusions
2. Level quick pick — opens VS Code quick pick with severity checkboxes
3. Search shortcut — opens the webview search panel (or focuses it)

**Pros:**
- Low effort, small surface area
- Gives quick access without replacing existing UI
- Leverages VS Code native quick pick for level selection

**Cons:**
- Mixed interaction model (some controls in title bar, most in webview)
- Quick pick for levels loses the context lines slider

## Recommendation
**Option D (Hybrid)** provides the best balance. Add 2-3 toggle icons to the view title bar for quick access to the most-used filters, while keeping the full slide-out panels for detailed configuration. This gives users the familiar "toolbar buttons" experience without trying to replicate a text input that the API doesn't support.

## Priority
Low — the current filtering system is fully functional and more capable than native panels. This is a discoverability and convenience improvement.

---
**Date:** 2026-02-03
