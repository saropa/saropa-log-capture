# Watch List (Keyword Watch)

> Internal developer reference — covers configuration, matching behavior, data flow, and key source files for the Keyword Watch feature. Not user-facing documentation.

Monitor incoming log lines for specific keywords or patterns and get notified when they appear.

## Configuration

Watch patterns are stored in VS Code workspace settings under `saropaLogCapture.watchPatterns`. Each entry has a `keyword` and an optional `alert` type.

### Default Patterns

| Keyword     | Alert Type |
|-------------|------------|
| `error`     | `flash`    |
| `exception` | `flash`    |
| `warning`   | `badge`    |

### Pattern Format

- **Plain text** — case-insensitive substring match (e.g. `error` matches `"Something Error happened"`)
- **Regex** — `/pattern/flags` format (e.g. `/\[PASS\]/` matches any line containing `[PASS]`)

### Alert Types

| Type    | Effect                                              |
|---------|-----------------------------------------------------|
| `flash` | Updates status bar and sidebar watch counts          |
| `badge` | Also increments the unread badge on the sidebar icon |
| `none`  | Count tracked internally, no UI notification         |

### Example Settings

```jsonc
// .vscode/settings.json
{
  "saropaLogCapture.watchPatterns": [
    { "keyword": "error", "alert": "flash" },
    { "keyword": "exception", "alert": "flash" },
    { "keyword": "warning", "alert": "badge" },
    { "keyword": "/\\[FAIL\\]/", "alert": "flash" },
    { "keyword": "timeout", "alert": "none" }
  ]
}
```

## Adding Items

Right-click a log line in the sidebar viewer and select **Add to Watch**. The selected line text is added as a plain-text pattern. Duplicates are rejected with an info message.

To watch for broader patterns (e.g. all `[PASS]` lines instead of one specific line), edit the entry in `.vscode/settings.json` and replace the literal text with a regex like `/\[PASS\]/`.

## How Matching Works

1. Each watch pattern is compiled into a regex on startup (and when settings change)
2. Every incoming log line is tested against all patterns
3. Multiple patterns can match the same line
4. Per-pattern hit counters are maintained for the session

Markers (timing separators) are never tested against watch patterns.

## Where Notifications Appear

- **Status bar** — shows counts inline, e.g. `error: 5 | warning: 3`
- **Sidebar badge** — unread hit count shown on the sidebar view icon (for `badge` and `flash` alerts)
- **Webview** — watch counts are posted to the sidebar viewer for display

## Data Flow

```
DAP output event
  -> session-manager broadcastLine()
    -> KeywordWatcher.testLine() checks all patterns
      -> hits attached to LineData as watchHits[]
        -> status bar updates counts
        -> sidebar badge increments (if flash/badge alert)
        -> webview receives counts via postMessage
```

## Key Source Files

| File                        | Role                                  |
|-----------------------------|---------------------------------------|
| `src/modules/keyword-watcher.ts`    | Core matching engine           |
| `src/modules/config.ts`             | Settings loader and defaults   |
| `src/modules/session-manager.ts`    | Watcher integration, line testing |
| `src/ui/viewer-handler-wiring.ts`   | "Add to Watch" context menu handler |
| `src/ui/status-bar.ts`              | Status bar count display       |
| `src/ui/log-viewer-provider.ts`     | Sidebar badge updates          |
| `src/ui/viewer-watch.ts`            | Webview-side count storage     |
