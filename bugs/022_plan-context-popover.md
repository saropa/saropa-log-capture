# Plan: Context Popover (Cross-Source Context on Click)

**Feature:** Click on any log line → popover shows integration data from that time window (±5s).

**Problems Solved:**
- Integration adapters are islands: clicking an error doesn't show correlated HTTP/perf/terminal data
- Lightweight alternative to full timeline view for quick context

**Builds on:** Quick win "Show Integration Context" menu item (already implemented, shows session-level integration summary)

---

## What exists

- "Show Integration Context" context menu item (implemented in quick wins)
- Opens a side document with all integration data for the session
- Integration meta includes `capturedAt` and `sessionWindow` timestamps
- Sidecar files with timestamped data: `.perf.json`, `.requests.json`, `.events.json`

## What's missing

1. **Time-filtered context**: Show only data within ±N seconds of the clicked line
2. **Inline popover**: Display in a floating panel instead of separate document
3. **Sidecar parsing**: Load and filter sidecar file data by timestamp
4. **Line timestamp extraction**: Parse timestamp from the clicked log line
5. **Configurable window**: User setting for context time window (default ±5s)

---

## Sub-features

### 1. Line Timestamp Extraction

**Implementation:**

Create `src/modules/timeline/line-timestamp.ts` (or reuse from timeline plan):

```typescript
interface LineTimestampResult {
    timestamp: number;      // Epoch ms
    confidence: 'exact' | 'inferred' | 'session';
    source: string;         // How it was extracted
}

function extractLineTimestamp(
    lineText: string,
    lineIndex: number,
    sessionStart: number,
    sessionEnd: number
): LineTimestampResult {
    // 1. Try to parse timestamp from line content
    //    Patterns: [2026-03-12 14:32:05], [+1234ms], ISO 8601, etc.
    // 2. If no timestamp, infer from position:
    //    interpolate = sessionStart + (lineIndex / totalLines) * duration
    // 3. Return with confidence level
}
```

### 2. Sidecar Data Loading and Filtering

**Implementation:**

Create `src/modules/context/context-loader.ts`:

```typescript
interface ContextWindow {
    centerTime: number;     // Epoch ms (from clicked line)
    windowMs: number;       // ±5000ms default
}

interface ContextData {
    performance?: PerfContextEntry[];
    http?: HttpContextEntry[];
    terminal?: TerminalContextEntry[];
    events?: EventContextEntry[];
    docker?: DockerContextEntry[];
    database?: DatabaseContextEntry[];
}

interface PerfContextEntry {
    timestamp: number;
    freeMemMb: number;
    loadAvg1?: number;
    delta?: string;  // e.g. "+120MB from baseline"
}

interface HttpContextEntry {
    timestamp: number;
    method: string;
    url: string;
    status: number;
    durationMs: number;
}

// ... similar for other sources

async function loadContextData(
    sessionUri: vscode.Uri,
    window: ContextWindow
): Promise<ContextData> {
    const result: ContextData = {};
    const sidecars = await findSidecarUris(sessionUri);
    
    for (const sidecar of sidecars) {
        const ext = getSidecarExtension(sidecar);
        switch (ext) {
            case '.perf.json':
                result.performance = await loadPerfContext(sidecar, window);
                break;
            case '.requests.json':
                result.http = await loadHttpContext(sidecar, window);
                break;
            case '.terminal.log':
                result.terminal = await loadTerminalContext(sidecar, window);
                break;
            // ... etc
        }
    }
    return result;
}
```

### 3. Inline Popover UI

**Implementation:**

Extend existing context modal or create new popover in viewer:

**Option A: Extend existing modal (`viewer-context-modal.ts`)**
- Add a tab or section for "Integration Context"
- Load data on modal open

**Option B: New floating popover (recommended)**
- Appears near the clicked line
- Compact, dismissible
- Can be pinned open

Create `src/ui/viewer/viewer-context-popover.ts`:

```javascript
// Webview script addition
function showContextPopover(lineIdx, anchorX, anchorY) {
    // 1. Extract timestamp from line
    // 2. Post message: { type: 'loadContextPopover', lineIndex, timestamp }
    // 3. Extension loads data, posts back: { type: 'contextPopoverData', data }
    // 4. Render popover near anchor position
}
```

**Popover layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Context at 14:32:05 (±5s)                              [×]  │
├─────────────────────────────────────────────────────────────┤
│ 🔧 Performance:                                             │
│    Memory: 450MB → 890MB (+440MB)                          │
│    CPU load: 0.12 → 0.78                                    │
│ ───────────────────────────────────────────────────────────│
│ 🌐 HTTP (2 requests):                                       │
│    POST /api/auth → 500 (3002ms)                           │
│    GET /api/config → 200 (45ms)                            │
│ ───────────────────────────────────────────────────────────│
│ 💻 Terminal:                                                │
│    npm ERR! network timeout                                 │
│ ───────────────────────────────────────────────────────────│
│ 🐳 Docker:                                                  │
│    container: auth-service (healthy)                        │
├─────────────────────────────────────────────────────────────┤
│ [Open in Timeline] [Copy] [Pin]                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Configuration

**Settings:**

Add to `package.json`:

```json
{
    "saropaLogCapture.contextWindowSeconds": {
        "type": "number",
        "default": 5,
        "minimum": 1,
        "maximum": 60,
        "description": "Time window (±seconds) for context popover data"
    },
    "saropaLogCapture.contextPopoverSources": {
        "type": "array",
        "default": ["performance", "http", "terminal", "events"],
        "description": "Integration sources to include in context popover"
    }
}
```

### 5. Trigger Options

**How to open the popover:**

| Trigger | Behavior |
|---------|----------|
| Double-click line | Show context popover |
| Context menu → "Show Integration Context" | Show popover (replace current behavior) |
| Hover + delay (optional) | Show lightweight preview |
| Keyboard shortcut (e.g. Ctrl+I) | Show popover for selected line |

**Recommended:** Keep "Show Integration Context" menu item but change behavior from opening document to showing popover.

### 6. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/timeline/line-timestamp.ts` | New: extract timestamp from log line |
| `src/modules/context/context-loader.ts` | New: load/filter sidecar data |
| `src/ui/viewer/viewer-context-popover.ts` | New: popover script |
| `src/ui/viewer/viewer-context-popover.css` | New: popover styles |
| `src/ui/shared/viewer-panel-handlers.ts` | Update `handleIntegrationContextRequest` |
| `src/ui/provider/viewer-message-handler.ts` | Handle `loadContextPopover` message |
| `package.json` | Add settings |
| `l10n.ts` + bundles | Add localization strings |

---

## Phases

### Phase 1: Core data loading
- Line timestamp extraction
- Sidecar loading with time filtering
- Update existing handler to use time filtering

### Phase 2: Popover UI
- Create floating popover component
- Wire to context menu action
- Basic styling

### Phase 3: Polish
- Configurable time window
- Source filtering settings
- Copy/pin functionality
- "Open in Timeline" link (depends on Timeline View plan)

---

## Considerations

- **Performance**: Sidecar files can be large. Load lazily, cap entries shown.
- **Timestamp quality**: Some lines lack timestamps. Show "approximate" indicator.
- **Empty context**: If no sidecar data exists, show "No integration data in this time window" with suggestion to enable integrations.
- **Multiple popovers**: Only one popover open at a time (dismiss previous).
- **Positioning**: Popover should not obscure the clicked line. Position below or to the side.
- **Accessibility**: Keyboard dismissible (Esc), focus trap, ARIA attributes.

---

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 1-2 days | None |
| Phase 2 | 2-3 days | Phase 1 |
| Phase 3 | 1-2 days | Phase 2, Timeline View (optional) |
| **Total** | **4-7 days** | |

---

## Success Criteria

1. User clicks a log line that occurred at 14:32:05
2. Popover appears showing HTTP requests, perf data, terminal output from 14:32:00 - 14:32:10
3. User sees correlation: "500 error happened same moment as memory spike"
4. Popover is dismissible and doesn't block workflow
5. Works even when some integration sources are disabled (shows available data)
