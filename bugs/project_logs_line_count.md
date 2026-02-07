# Feature: Line Count in Project Logs Tree View

## Summary

Show line count in the Project Logs sidebar tree, positioned before the file size
in the description. Active (recording) sessions show a live-updating count with a
clear visual indicator; closed sessions show a cached final count.

## Current State

- `SessionMetadata.lineCount` exists in the interface but is **never populated**
- `extractFields()` declares `lineCount` in its return type but never parses it
- The session footer already writes line count: `=== SESSION END — {date} — {N} lines ===`
- The session header (written at start) does **not** include line count
- Active sessions already display: red record icon, `●` label prefix, `ACTIVE ·` description prefix
- Current description format: `Dart · Feb 2, 4:13pm · 24.5 KB · #tags`

## Target Description Format

**Closed sessions:**
`Dart · Feb 2, 4:13pm · 1,234 lines · 24.5 KB · #tags`

**Active (recording) sessions:**
`ACTIVE · Dart · 4:13pm · 1,234 lines ● · 24.5 KB`

The `●` dot after the count echoes the recording indicator already used in the label,
reinforcing "still counting" at a glance alongside the red icon and `ACTIVE` prefix.
Format numbers with commas (locale-aware, matching `formatCount()` in status bar).

## Line Count Source (two-tier)

### Tier 1 — Parse from session footer (fast, preferred)

The footer line `=== SESSION END — ... — N lines ===` is already written by
`LogSession.stop()`. Parse this with a regex when loading metadata. This is a
single-line read near the end of the file — no full scan needed.

### Tier 2 — Count lines on disk (fallback)

For files without a footer (crash, still recording, manually created, older format),
count newlines in the file. Cache the result keyed on `(uri, mtime, size)` so it
only re-counts when the file actually changes.

### Active sessions

Use the live `LogSession.lineCount` getter directly — no file I/O needed. The
session manager already tracks the active session and its line count.

## Caching

- **Closed files:** Cache line count in memory keyed on `(uri, mtime, size)`. The
  cache invalidates naturally when `mtime` or `size` changes (file watcher triggers
  `getChildren()` which reloads metadata).
- **Active files:** No cache — read from `LogSession.lineCount` on each render.

## Tree Refresh Debounce for Active Sessions

The FileSystemWatcher already triggers `refresh()` on every file change. During
active recording, constant writes would cause excessive refreshes.

**Adaptive debounce** — scale interval based on line count:

| Line count     | Refresh interval |
|----------------|------------------|
| < 1,000        | 3 seconds        |
| 1,000–10,000   | 10 seconds       |
| > 10,000       | 30 seconds       |

Add a setting `saropaLogCapture.treeRefreshInterval` (number, seconds, default `0`
meaning "adaptive"). When set to a positive value, use that fixed interval instead
of the adaptive schedule. This gives power users control while keeping the default
smart.

## Split File Groups

When a session is split across multiple files (e.g., `session_001.log`,
`session_002.log`), they appear as a collapsible parent node in the tree.

- **Parent node:** Show total line count summed across all parts
  - `3 parts · 4,567 lines · 1.2 MB`
- **Child nodes (individual parts):** Show per-part line count as usual
  - `Dart · Feb 2, 4:13pm · 1,234 lines · 400 KB`

## Tooltip Updates

Add line count to tooltips:

```
session_20260207_141300_myapp.log
Date: 2026-02-07T14:13:00.000Z
Modified: Feb 7, 2:15pm
Project: myapp
Adapter: Dart
Lines: 1,234
Size: 24.5 KB
Timestamps: Yes
```

## Implementation Checklist

### 1. Parse line count from footer
- In `parseHeader()` (session-history-provider.ts), after reading the header block,
  also scan the last ~200 bytes of the file for the `SESSION END` footer
- Extract the line count with regex: `/(\d[\d,]*)\s+lines\s*===/`
- Populate `SessionMetadata.lineCount`

### 2. Fallback: count lines on disk
- Add a `countFileLines(uri)` utility that counts newlines via `workspace.fs.readFile`
- Add an in-memory cache: `Map<string, { mtime: number; size: number; count: number }>`
- Use this when footer parsing yields no result

### 3. Active session line count
- `SessionHistoryProvider` already has `activeUri` — extend with an `activeLineCount`
  property that the session manager updates
- Or: pass a reference/callback so the provider can query the live count

### 4. Update `buildDescription()`
- Insert formatted line count before `formatSize(item.size)` in the parts array
- For active sessions, append ` ●` after the count

### 5. Update `buildTooltip()`
- Add `Lines: {formatted count}` between Adapter and Size

### 6. Update split group description
- In `getSplitGroupTreeItem()`, sum line counts across parts and include in description
- Update `buildSplitGroupTooltip()` to include total line count

### 7. Adaptive debounce
- Add a debounce wrapper around `refresh()` that adjusts interval based on active
  session line count
- Add the `treeRefreshInterval` setting to `package.json` and `config.ts`

### 8. Format helper
- Reuse or share the existing `formatCount()` locale formatting from status bar
