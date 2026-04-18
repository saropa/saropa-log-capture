# Plan 051: Structured File Modes

**Problem:** The default tracked file types include `.md`, `.json`, `.csv`, and `.html` alongside `.log` and `.txt`. When the viewer opens any of these, the full log analysis pipeline runs — producing false error/warning levels, phantom SQL fingerprints, bogus signals, and broken repeat detection. These are structured documents, not event streams. The pipeline should know the difference.

**Root cause:** `addToData()` treats every line identically regardless of file type. There is no concept of "this file is not a log."

---

## File Mode Classification

| Extension | Mode | Nature |
|---|---|---|
| `.log`, `.txt` | `log` | Event stream — full analysis pipeline |
| `.md` | `markdown` | Document — headings, bullets, tables |
| `.json`, `.jsonl` | `json` | Tree — indented, collapsible nodes |
| `.csv` | `csv` | Tabular — aligned columns |
| `.html` | `html` | Markup — treat as plain text (no rendering) |

All non-log modes share the same core behavior: **skip the entire log analysis pipeline**. Each mode adds lightweight presentation on top.

---

## Shared: What to Skip for All Non-Log Modes

Every analysis step in `addToData()` is skipped. The fast path creates a plain `info`-level item with all filter/analysis flags defaulted to `null`/`false`/`undefined`. The item has the same shape as a log line item, so `calcItemHeight()`, filters, search, viewport, and export all work unchanged.

Skipped analysis (all of these produce false positives on structured documents):

- Level classification (`classifyLevel`)
- Device-tier demotion
- Recent-error proximity inheritance
- Source tag / logcat tag / class tag parsing
- SQL fingerprinting and repeat detection
- DB line detectors (N+1, burst, slow-query signals)
- SQL pattern filter / query history
- Continuation grouping
- ASCII art detection
- Stack frame detection (`isStackFrameText`)
- Error classification / critical error check
- Auto-hide pattern matching
- Structured prefix parsing
- Drift debug server detection
- Separator line detection

---

## Shared: Toolbar Toggle (All Non-Log Modes)

A new toolbar icon appears **only when a non-log file is loaded**. It toggles between raw text view and formatted view. Off by default — the file loads as plain text first.

**Icon:** `codicon-open-preview` (or `codicon-eye`) — label "Format"

**Behavior:**
- **Off (default):** Lines display as plain monospace text, identical to current behavior but without log analysis
- **On:** Mode-specific formatting applies (see per-mode sections below)
- Toggle state is per-file (stored in webview state keyed by filename)
- Toggling re-renders the viewport without re-parsing — formatting is a display concern, not a data concern

**Implementation:**

The toggle button is added to the top bar (not the icon bar — this is a view control, not a panel). It's hidden when `fileMode === 'log'` and shown otherwise.

```html
<button id="format-toggle" class="nav-btn" style="display:none" title="Toggle formatted view">
    <span class="codicon codicon-open-preview"></span>
</button>
```

Show/hide when file mode changes:

```javascript
var formatToggle = document.getElementById('format-toggle');
if (formatToggle) {
    formatToggle.style.display = (fileMode === 'log') ? 'none' : '';
}
```

---

## Mode: Markdown

When format toggle is **on**, lines get lightweight HTML treatment during rendering (not in `addToData` — in the render path):

### Rendering Rules

| Pattern | Rendered as |
|---|---|
| `# Heading` through `###### Heading` | Bold text, scaled font size (h1 largest), left-colored border |
| `- item` or `* item` | Bullet character + indented text |
| `1. item` | Number + indented text |
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `` `code` `` | Monospace background span |
| `> blockquote` | Left border + muted color |
| `---` / `***` | Thin horizontal rule |
| `| col | col |` | Monospace-aligned, no actual `<table>` — just padding to align pipes |
| `[text](url)` | Underlined text (not clickable — security) |
| Everything else | Plain text, no transformation |

No fenced code block rendering (` ``` `). No image rendering. No nested list depth. Keep it simple.

### Collapsible Sections

Heading lines (`#` through `######`) act as collapsible group headers:

- Click a heading to collapse/expand everything between it and the next heading of equal or higher level
- Collapsed state: heading shows with a `▶` prefix and a line count badge (e.g., "▶ ## Risk Assessment (12 lines)")
- Expanded state: heading shows with `▼` prefix, all lines visible
- Default: all sections expanded
- Collapse state is per-heading, not stored across file switches

**Implementation:** Use the same `calcItemHeight() → 0` pattern as stack frame collapse. Each heading stores a `collapsed` flag and a range of line indices. Collapsing sets `height: 0` on all lines in the range and calls `recalcHeights()` + `renderViewport(true)`.

---

## Mode: JSON

When format toggle is **on**:

### Rendering Rules

- Indent lines according to brace/bracket nesting depth (2-space increments, visual only)
- Syntax color: keys in one color, string values in another, numbers/booleans/null in a third
- Commas and braces in muted color

### Collapsible Nodes

- Lines containing `{` or `[` (that aren't closed on the same line) act as collapsible headers
- Click to collapse everything between the opener and its matching closer
- Collapsed state shows: `{ ... }` or `[ ... ]` with an item count badge (e.g., `{ ... 8 keys }`)
- Matching is computed once on load (brace-depth counting), stored as a collapse map

**Implementation:** Same `calcItemHeight() → 0` pattern. The brace-matcher runs once when formatting is toggled on, producing a map of `openerIndex → closerIndex`. Clicking an opener sets `height: 0` on all lines in the range.

### `.jsonl` Handling

Each line is an independent JSON object. Treat each line as its own collapsible root if it contains nested braces. No cross-line brace matching.

---

## Mode: CSV

When format toggle is **on**:

### Rendering Rules

- First line is treated as a header row — bold text, subtle bottom border
- Columns are aligned by padding (computed from the first ~100 rows to avoid scanning the whole file)
- Column separator (comma, tab, semicolon) is auto-detected from the first line
- Values containing the separator are respected if quoted
- Alternating row background (very subtle — e.g., every other row has 2% opacity tint)

### No Collapsing

CSV is flat — no hierarchical structure to collapse.

---

## Mode: HTML

When format toggle is **on**:

- Same as JSON mode — indent by tag nesting depth, syntax color tags vs attributes vs content
- Collapsible on open/close tag pairs

When format toggle is **off** (default): plain text, no analysis. This is the safe fallback for a format that could contain anything.

---

## Implementation Plan

### Step 1: File mode detection and messaging

**File:** `src/ui/provider/log-viewer-provider-load.ts`

Detect extension, send `setFileMode` message before lines flow:

```typescript
function detectFileMode(uri: vscode.Uri): string {
    const ext = uri.fsPath.toLowerCase().split('.').pop();
    switch (ext) {
        case 'md': return 'markdown';
        case 'json': return 'json';
        case 'jsonl': return 'json';
        case 'csv': return 'csv';
        case 'html': case 'htm': return 'html';
        default: return 'log';
    }
}
```

### Step 2: Webview file mode global + format toggle state

**File:** `src/ui/viewer/viewer-script-messages.ts`

```javascript
var fileMode = 'log';
var formatEnabled = false;

case 'setFileMode':
    fileMode = msg.mode || 'log';
    formatEnabled = false; // reset on file switch
    updateFormatToggleVisibility();
    break;
```

### Step 3: Analysis bypass in `addToData()`

**File:** `src/ui/viewer/viewer-data-add.ts`

Single guard at the top of the normal-line branch, before stack-frame detection:

```javascript
if (fileMode !== 'log') {
    // Structured file — skip all log analysis, create plain info item
    var docItem = { /* ... all flags false/null ... */ };
    allLines.push(docItem);
    totalHeight += docItem.height;
    return;
}
```

Also gate `isStackFrameText()`:

```javascript
if (fileMode === 'log' && isStackFrameText(html)) {
```

### Step 4: Format toggle button

**File:** `src/ui/viewer-nav/viewer-top-bar.ts` (or equivalent top bar file)

Add the button HTML, hidden by default. Show when `fileMode !== 'log'`.

### Step 5: Per-mode rendering

New files — one per mode, following the `/* javascript */` template literal pattern:

| File | Responsibility |
|---|---|
| `src/ui/viewer/viewer-format-markdown.ts` | Markdown heading/bullet/bold rendering + section collapse |
| `src/ui/viewer/viewer-format-json.ts` | JSON indent/color + brace-pair collapse |
| `src/ui/viewer/viewer-format-csv.ts` | CSV header detection + column alignment |

These scripts export a `formatLine(item, plain)` function that returns modified HTML when formatting is enabled, or the original HTML when disabled. The render path calls `formatLine` instead of using `item.html` directly.

### Step 6: Collapse mechanics for markdown and JSON

Reuse the existing pattern from stack group collapse:

- Store `collapsed` flag and line range on the header item
- `calcItemHeight()` returns `0` for lines inside a collapsed range
- Click handler on the header calls `recalcHeights()` + `renderViewport(true)`
- No changes to `calcItemHeight()` filter-flag checks — collapse is structural, not filter-based

### Step 7: Session panel presentation

**File:** `src/ui/session/session-display.ts`

- Non-log files get a distinct icon (document icon instead of log icon)
- Non-log files excluded from error/warning count aggregation in day-group headings

---

## Files Changed

| File | Change |
|---|---|
| `src/ui/provider/log-viewer-provider-load.ts` | `detectFileMode()` + send `setFileMode` message |
| `src/ui/viewer/viewer-script-messages.ts` | Handle `setFileMode`, store `fileMode` + `formatEnabled` globals |
| `src/ui/viewer/viewer-data-add.ts` | Non-log fast path + gate `isStackFrameText` |
| `src/ui/viewer-nav/viewer-top-bar.ts` | Format toggle button HTML |
| `src/ui/viewer/viewer-format-markdown.ts` | **New** — markdown rendering + section collapse |
| `src/ui/viewer/viewer-format-json.ts` | **New** — JSON indent/color + brace collapse |
| `src/ui/viewer/viewer-format-csv.ts` | **New** — CSV header + column alignment |
| `src/ui/viewer/viewer-data-helpers-render.ts` | Call `formatLine()` in render path |
| `src/ui/session/session-display.ts` | Distinct icon for non-log files |
| `src/ui/session/session-history-metadata.ts` | Exclude non-log from error/warning counts |

---

## What This Does NOT Do

- No full markdown preview (images, nested lists, footnotes, code block syntax highlighting)
- No JSON schema validation
- No CSV sorting or filtering by column
- No HTML preview rendering (that would be an iframe security nightmare)
- No new settings — mode is auto-detected from extension, format toggle is per-file UI state
- No changes to `calcItemHeight()` filter-flag checks — collapse uses the structural pattern, not filter flags

---

## Testing

### All non-log modes
1. Open file — no lines colored as error/warning/database
2. No signals fire on content that would trigger them in a log (e.g., "error", SQL statements)
3. Search filter works
4. Export works
5. Format toggle shows/hides, persists per-file
6. Switching from non-log to log file restores full analysis
7. Day-group error/warning counts exclude non-log files

### Markdown
8. Format toggle on: headings are bold/sized, bullets render, bold/italic work
9. Click heading to collapse — lines below hide, heading shows line count
10. Click again to expand
11. Nested headings: collapsing `##` does not collapse a subsequent `#`

### JSON
12. Format toggle on: keys/values colored, indentation matches nesting
13. Click `{` line to collapse — content hidden, shows `{ ... N keys }`
14. Nested objects: collapsing inner does not affect outer
15. `.jsonl`: each line independently collapsible

### CSV
16. Format toggle on: first row bold, columns aligned
17. Auto-detects comma vs tab vs semicolon separator
18. Quoted values with embedded separators handled correctly
