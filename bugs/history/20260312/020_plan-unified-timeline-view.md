# Plan: Unified Timeline View

**Feature:** Correlate all data sources (debug console, terminal, integrations) on a single time-synchronized view.

**Problem Solved:** Users can't answer "what was happening at 14:32:05 across all sources?" — each source is viewed separately with no correlation.

---

## What exists

- Debug console logs with timestamps (extracted from log content or elapsed prefixes)
- Integration sidecars with timestamps: `.perf.json` (samples[].t), `.events.json` (time), `.requests.json` (timestamp)
- Session metadata with `sessionWindow.start` / `sessionWindow.end` (added in quick wins)
- Replay mode shows logs with timing, but single-source only
- Terminal capture writes `.terminal.log` sidecar (raw text, timestamps may be embedded)

## What's missing

1. **Unified data model**: A common event structure across all sources
2. **Timeline view UI**: A new panel/view that displays merged events chronologically
3. **Timestamp normalization**: Parse timestamps from heterogeneous sources into epoch ms
4. **Filtering/zooming**: Show/hide sources, zoom to time ranges, density control
5. **Click-to-navigate**: Click event → jump to source (log line, sidecar entry)

---

## Sub-features

### 1. Unified Event Model

**Data structure:**

```typescript
interface TimelineEvent {
    /** Epoch milliseconds */
    timestamp: number;
    /** Source identifier */
    source: 'debug' | 'terminal' | 'http' | 'perf' | 'docker' | 'events' | 'database' | 'browser';
    /** Severity for visual styling */
    level: 'error' | 'warning' | 'info' | 'debug' | 'perf';
    /** Display text (single line) */
    summary: string;
    /** Full content for detail view */
    detail?: string;
    /** Navigation target */
    location?: {
        file: string;      // URI string
        line?: number;     // For log files
        jsonPath?: string; // For sidecar JSON
    };
}
```

**Implementation:**

Create `src/modules/timeline/timeline-event.ts`:
- Define `TimelineEvent` interface
- Add source-specific parsers:
  - `parseLogLineToEvent(line, lineIndex, fileUri)` — extract timestamp, level, text
  - `parsePerfSampleToEvent(sample, sidecarUri)` — convert perf sample to event
  - `parseHttpRequestToEvent(request, sidecarUri)` — convert HTTP log entry
  - `parseTerminalLineToEvent(line, lineIndex, sidecarUri)` — best-effort timestamp extraction

### 2. Timeline Data Loader

**Implementation:**

Create `src/modules/timeline/timeline-loader.ts`:

```typescript
interface TimelineLoadOptions {
    sessionUri: vscode.Uri;
    sources: ('debug' | 'terminal' | 'http' | 'perf' | 'docker' | 'events' | 'database' | 'browser')[];
    timeRange?: { start: number; end: number };
    maxEvents?: number;
}

async function loadTimelineEvents(options: TimelineLoadOptions): Promise<TimelineEvent[]> {
    // 1. Load main log file, parse to events
    // 2. Find sidecars using findSidecarUris() from slc-bundle.ts
    // 3. Load and parse each enabled sidecar
    // 4. Merge all events by timestamp
    // 5. Apply time range filter if specified
    // 6. Cap to maxEvents (default 10,000)
    return events;
}
```

### 3. Timeline View Panel

**Implementation:**

Create `src/ui/timeline/timeline-panel.ts`:

- New webview panel (similar to pop-out viewer)
- Opened via command `saropaLogCapture.showTimeline` or session context menu
- Layout:
  ```
  ┌─────────────────────────────────────────────────────────────┐
  │ [Source filters: ☑Debug ☑Terminal ☑HTTP ☐Perf ☐Events]    │
  │ [Time range: |=======●========|] [Zoom: 1x ▾]              │
  ├────────┬────────────────────────────────────────────────────┤
  │ 14:32:00│ ● [Debug] Starting auth flow...                   │
  │         │ ○ [Perf]  Memory: 450MB                           │
  │ 14:32:02│ ● [HTTP]  POST /api/auth → pending...             │
  │ 14:32:05│ ⚠ [Debug] ERROR: Connection timeout               │
  │         │ ⚠ [HTTP]  POST /api/auth → 500 (3002ms)           │
  │         │ ● [Perf]  Memory spike: 450MB → 890MB             │
  │ 14:32:10│ ● [Debug] Retry attempt 2...                      │
  └────────┴────────────────────────────────────────────────────┘
  ```

**Webview script:**

- Virtual scrolling for large event counts (reuse existing viewer virtualization)
- Source color coding (debug=blue, http=green, perf=purple, error=red)
- Click event → post message → open source file/line or show detail popover
- Time scrubber for navigation
- Keyboard: arrow keys to navigate, Enter to open source

### 4. Timestamp Normalization

**Implementation:**

Create `src/modules/timeline/timestamp-parser.ts`:

```typescript
/** Parse various timestamp formats to epoch ms. Returns undefined if unparseable. */
function parseTimestamp(text: string, sessionStart?: number): number | undefined {
    // Patterns to handle:
    // - ISO 8601: "2026-03-12T14:32:05.123Z"
    // - Log prefix: "[2026-03-12 14:32:05.123]"
    // - Elapsed: "[+1234ms]" (relative to sessionStart)
    // - Flutter: "I/flutter (12345): [14:32:05.123]"
    // - Unix epoch: "1710251525123"
    // - Time only: "14:32:05" (use session date)
}
```

### 5. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/timeline/timeline-event.ts` | New: event model and parsers |
| `src/modules/timeline/timeline-loader.ts` | New: load and merge events from all sources |
| `src/modules/timeline/timestamp-parser.ts` | New: normalize timestamps |
| `src/ui/timeline/timeline-panel.ts` | New: webview panel provider |
| `src/ui/timeline/timeline-content.ts` | New: HTML/CSS for timeline view |
| `src/ui/timeline/timeline-script.ts` | New: webview script (virtual scroll, interactions) |
| `src/commands-session.ts` | Add `showTimeline` command |
| `package.json` | Add command, keybinding |
| `l10n.ts` + bundles | Add localization strings |

---

## Phases

### Phase 1: Core data model and basic view (MVP) ✅ COMPLETED
- ✅ TimelineEvent model (`src/modules/timeline/timeline-event.ts`)
- ✅ Timestamp parser (`src/modules/timeline/timestamp-parser.ts`)
- ✅ Timeline loader (`src/modules/timeline/timeline-loader.ts`)
- ✅ Basic timeline panel with click to navigate

### Phase 2: Full source support ✅ COMPLETED
- ✅ Parsers for all sources: debug, HTTP, terminal, events, docker, database, browser, perf
- ✅ Source filter checkboxes
- ✅ Color coding per source
- ✅ Keyboard navigation (arrow keys + Enter)
- ✅ Event types extracted to `src/modules/timeline/event-types.ts`
- ✅ Sidecar loaders extracted to `src/modules/timeline/sidecar-loaders.ts`

### Phase 3: Advanced UX ✅ COMPLETED
- ✅ Time range scrubber with draggable handles and zoom buttons (+/−/reset)
- ✅ Virtual scrolling for 100k+ events (only renders visible rows)
- ✅ Minimap showing event density with click-to-navigate
- ✅ Export timeline as JSON/CSV buttons

---

## Implementation Notes

**Files created:**
- `src/modules/timeline/event-types.ts` - Sidecar event type interfaces
- `src/modules/timeline/timeline-event.ts` - TimelineEvent interface and parsers
- `src/modules/timeline/timestamp-parser.ts` - Timestamp normalization
- `src/modules/timeline/timeline-loader.ts` - Load and merge events
- `src/modules/timeline/sidecar-loaders.ts` - Individual sidecar parsers

**Files modified:**
- `src/ui/panels/timeline-panel.ts` - Rewritten for unified view
- `src/ui/panels/timeline-panel-styles.ts` - New styles with source colors
- `src/l10n.ts` - Added timeline panel strings

---

## Considerations

- **Performance**: 10k events is fine; 100k needs virtual scrolling and lazy parsing
- **Timestamp quality**: Some sources have poor timestamps (terminal). Document limitations.
- **Session scope**: Timeline is per-session. Cross-session would require Investigation Mode (separate plan).
- **Memory**: Don't load full sidecar content into memory; stream and parse incrementally.
- **Reuse**: Timeline loading can feed both this view and Investigation Mode search.
- **Accessibility**: Ensure keyboard navigation, ARIA labels on event list.

---

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 3-4 days | None |
| Phase 2 | 2-3 days | Phase 1 |
| Phase 3 | 2-3 days | Phase 2 |
| **Total** | **7-10 days** | |

---

## Success Criteria

1. User opens timeline for a session with perf + HTTP sidecars
2. Events from all sources appear in chronological order
3. Clicking an event navigates to the source (log line or sidecar detail)
4. Filtering by source hides/shows events instantly
5. View handles 10k events without noticeable lag
