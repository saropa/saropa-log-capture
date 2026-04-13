# Plan 047 — Structured line parsing and metadata extraction

## Status: Open

## Goal

Auto-detect known structured log line formats, extract metadata (timestamp, PID, TID, log level, tag), strip the prefix from displayed text, and use the extracted parts for filtering, coloring, and tooltips. Default on, user setting to disable.

This is **not limited to logcat** — any recognized structured format gets parsed.

---

## Scope

### In scope

1. **Timestamp extraction and suppression** — detect inline timestamps, use them for the existing timestamp decoration system (`decoShowTimestamp` / `decoShowSessionElapsed`), strip from displayed line text
2. **Log level extraction** — detect level indicators (logcat `V/D/I/W/E/F/A`, syslog priorities, etc.), feed into `classifyLevel()`, hide level prefix from displayed text (user toggle)
3. **PID & TID extraction** — parse process/thread IDs, store on line items, hide by default (user toggle to show)
4. **PID, TID & tag click-to-filter** — clicking any of these toggles an inclusive filter (same mechanism as existing keyword/category filters)
5. **Level tooltips** — hover over a log line shows the full level name (e.g., "Debug", "Warning")
6. **"Slow operation" as performance keyword** — add to `DEFAULT_SEVERITY_KEYWORDS.performance`

### Out of scope

- New log source integrations (Docker, Windows Event Log, etc. already handled as structured sidecars)
- Logcat live-capture changes (already works via `adb-logcat-parser.ts`)
- Custom user-defined format patterns (future work)

---

## Format detection strategy

### Three tiers

1. **Known source** — when the line source is known (e.g., live logcat, Docker integration), use that source's parser directly. Zero sniffing.
2. **File-loaded / unknown source** — sniff to detect format:
   - Sample first 50 lines
   - Sample ~10 lines from ~50% file offset
   - Pick the format that matches the most lines
   - Fast-path: apply only that format's regex to all remaining lines
3. **Fallback** — any line that doesn't match the detected format runs through the full pattern chain

### Recognized formats (initial set)

| Format | Example | Extracts |
|--------|---------|----------|
| Android threadtime | `04-12 20:47:05.621  485  485 D Zygote: msg` | timestamp, PID, TID, level, tag, message |
| Logcat shorthand | `D/Zygote: msg` | level, tag, message |
| Syslog (RFC 3164) | `Mar 12 14:32:05 host process[1234]: msg` | timestamp, process, PID, message |
| Syslog (RFC 5424) | `<165>1 2026-03-12T14:32:05.123Z host app 1234 - msg` | timestamp, app, PID, message |
| Bracketed timestamp | `[2026-03-12 14:32:05.123] [INFO] msg` | timestamp, level, message |
| ISO timestamp prefix | `2026-03-12T14:32:05.123Z INFO msg` | timestamp, level, message |
| Python logging | `2026-03-12 14:32:05,123 - module - INFO - msg` | timestamp, tag (module), level, message |
| Log4j/Logback | `2026-03-12 14:32:05.123 [thread] INFO class - msg` | timestamp, TID (thread name), level, tag, message |
| SDA log | `[log] 14:32:05.123 msg` | timestamp, tag ("log"), message |

Formats can be added incrementally. Each format is a self-contained detector: one regex, one extractor function.

---

## Data model changes

### New interface: `ParsedLinePrefix`

```typescript
interface ParsedLinePrefix {
    /** Epoch ms, fed into existing timestamp decoration system */
    timestamp?: number;
    /** Original timestamp string as it appeared in the line */
    rawTimestamp?: string;
    /** Process ID */
    pid?: number;
    /** Thread ID (numeric or thread name) */
    tid?: string;
    /** Raw level indicator (e.g., "D", "INFO", "warning") */
    rawLevel?: string;
    /** Normalized severity level */
    level?: SeverityLevel;
    /** Tag / component name (e.g., "Zygote", "ActivityManager") */
    tag?: string;
    /** The line text with the structured prefix stripped */
    message: string;
    /** Which format was detected */
    format: string;
}
```

### Line item additions

Add to line items in `addToData()`:

- `pid: number | undefined`
- `tid: string | undefined`
- `parsedTag: string | undefined` (distinct from existing `logcatTag` which stays for backward compat)

### Existing properties reused

- `timestamp` — already on line items, populated from `ParsedLinePrefix.timestamp`
- `level` — already on line items, use `ParsedLinePrefix.level` when available (higher confidence than text-pattern matching)
- `logcatTag` — already on line items, populated when format is logcat

---

## Settings

### New settings in `package.json`

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `saropaLogCapture.structuredLineParsing` | `boolean` | `true` | Auto-detect and parse structured log line prefixes |
| `saropaLogCapture.showPidTid` | `boolean` | `false` | Show PID/TID in log lines when detected |
| `saropaLogCapture.showLevelPrefix` | `boolean` | `false` | Show the raw level indicator (e.g., "D/", "INFO") in log lines |

### Existing settings reused

- `decoShowTimestamp` / `decoShowSessionElapsed` — already control timestamp display
- `severityKeywords.performance` — add "slow operation" to defaults

---

## Implementation phases

### Phase 1: Format detection engine + "slow operation" keyword

**Files:**
- New: `src/modules/analysis/structured-line-parser.ts` — format registry, `parseStructuredLine()` function
- New: `src/modules/analysis/structured-line-formats.ts` — individual format definitions (regex + extractor per format)
- New: `src/modules/analysis/structured-line-sniffer.ts` — file-level format sniffing (sample first 50 + middle 10 lines)
- Edit: `src/modules/config/config-normalizers.ts` — add `"slow operation"` to `DEFAULT_SEVERITY_KEYWORDS.performance`

**Deliverable:** Given a line string, returns `ParsedLinePrefix | null`. No UI changes yet.

**Tests:**
- Each format: happy path, partial match, no match
- Sniffer: single-format file, mixed-format file, empty file, file with preamble
- "Slow operation" classified as performance

### Phase 2: Wire into data pipeline

**Files:**
- Edit: `src/ui/viewer/viewer-data-add.ts` — call `parseStructuredLine()` before `classifyLevel()`. Use extracted level (if any) as authoritative, strip prefix from displayed `html`
- Edit: `src/modules/config/config.ts` — add new settings to `Config` interface and `getConfig()`
- Edit: `package.json` — register new settings

**Data flow:**
1. Raw line arrives at `addToData()`
2. If `structuredLineParsing` enabled → `parseStructuredLine(rawText, detectedFormat)`
3. If result is non-null:
   - Use `result.timestamp` for `item.timestamp` (overrides any other source)
   - Use `result.level` for `item.level` (skip `classifyLevel()` keyword fallback, still allow structural override)
   - Store `result.pid`, `result.tid`, `result.tag` on item
   - Replace displayed text with `result.message` (stripped prefix)
4. If result is null → existing pipeline unchanged

**Tests:**
- Line with known format: metadata extracted, prefix stripped
- Line with unknown format: passes through unchanged
- Setting off: no parsing applied
- Known-source lines skip sniffing

### Phase 3: Display toggles (PID/TID, level prefix)

**Files:**
- Edit: `src/ui/viewer-decorations/viewer-decorations.ts` — extend `getDecorationPrefix()` to optionally include PID/TID and level prefix
- Edit: `src/ui/viewer-decorations/viewer-deco-settings.ts` — add toggle functions and checkbox UI
- Edit: `src/ui/viewer-context-menu/viewer-context-menu-html.ts` — add context menu items
- Edit: `src/ui/viewer-context-menu/viewer-context-menu-actions.ts` — wire toggle actions

**Behavior:**
- PID/TID shown as decoration prefix when `showPidTid` is on: `[485:485]` or `[485:main]`
- Level prefix shown when `showLevelPrefix` is on: `D` or `INFO` before the message
- Both off by default — metadata is extracted and used for coloring/filtering but not displayed

**Tests:**
- Toggle on: prefix appears in rendered output
- Toggle off: prefix absent
- No PID/TID available: graceful no-op

### Phase 4: Click-to-filter for PID, TID, and tag

**Files:**
- Edit: `src/ui/viewer/viewer-data-helpers-render.ts` — wrap PID/TID/tag values in clickable `<span>` elements when visible
- Edit: `src/ui/viewer/viewer-script-click-handlers.ts` — add click handler for `.filter-toggle` spans
- New: `src/ui/viewer-search-filter/viewer-metadata-filter.ts` — `activeMetadataFilters` Map (key → Set of values), `applyMetadataFilter()`, `toggleMetadataFilter(key, value)`
- Edit: `src/ui/viewer/viewer-data-helpers.ts` — add `metadataFiltered` flag check in `calcItemHeight()`

**Filter behavior:**
- First click on a PID: show only lines with that PID (inclusive)
- Click same PID again: remove filter (show all)
- Click a different PID while one is active: switch to the new PID
- Same pattern for TID and tag
- Filter chips shown in the active-filters bar (same as existing category chips)
- Markers never filtered

**Tests:**
- Toggle on: only matching lines visible
- Toggle off: all lines visible
- Multiple filters: AND logic (PID=485 AND tag=Zygote)
- Markers always visible

### Phase 5: Level tooltips

**Files:**
- Edit: `src/ui/viewer/viewer-data-helpers-render.ts` — add `title` attribute to line elements with the full level name

**Tooltip text mapping:**
- `V` → "Verbose"
- `D` / `debug` → "Debug"
- `I` / `info` → "Info"
- `W` / `warning` → "Warning"
- `E` / `error` → "Error"
- `F` → "Fatal"
- `A` → "Assert"
- `performance` → "Performance"
- `database` → "Database"
- `todo` → "Todo"
- `notice` → "Notice"

**Tests:**
- Each level produces correct tooltip
- No level: no title attribute
- Tooltip doesn't interfere with existing hover behavior

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| Regex chain too slow for huge files | Hybrid sniffing: fast-path single regex for 95%+ of lines |
| Wrong format detected | Sniffer requires majority match (>60% of sampled lines); fallback chain catches misses |
| Stripped prefix loses information | Raw text preserved on `item.rawText`; PID/TID/level/tag stored as metadata; user can toggle display back on |
| Breaking existing level classification | Parsed level is a hint, not override — `classifyLevel()` structural patterns still run and can promote/demote |
| Line count limits on new files | Format registry is data-driven (array of objects), not one-function-per-format |

---

## Quality gates

- [ ] `npm run check-types` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run compile` — succeeds
- [ ] Tests pass
- [ ] Manual test: open logcat `.log` file, verify prefix stripped, metadata shown in decorations, click-to-filter works
- [ ] Manual test: open non-structured log file, verify no regression
- [ ] Manual test: toggle `structuredLineParsing` off, verify raw lines shown
