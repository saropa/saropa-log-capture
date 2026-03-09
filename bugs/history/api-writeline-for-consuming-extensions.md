# Feature Request: `writeLine()` API for Consuming Extensions

## Status: Implemented

### Resolution

`writeLine(text, options?)` added to `SaropaLogCaptureApi` with `category` and `timestamp` options. Lines flow through the same pipeline as DAP output: exclusion rules, flood protection, deduplication, file write, viewer push, watch patterns. Multi-line text is split on `\n`/`\r\n`. Empty strings produce blank lines. No-op when no session is active. The `level` and `sourceTag` options are deferred — auto-detection from text patterns handles both for now.

**Files:** `api-types.ts`, `api.ts`, `session-manager.ts`, `session-manager-events.ts`

## Summary

The public Extension API (`SaropaLogCaptureApi` in [api-types.ts](../src/api-types.ts)) exposes read-oriented events (`onDidWriteLine`, `onDidStartSession`, `onDidEndSession`), state queries (`getSessionInfo`), visual markers (`insertMarker`), and integration providers (`registerIntegrationProvider`). However, there is no way for a consuming extension to **write structured log lines** into the active capture session during its lifetime.

This gap blocks first-party extensions like **Saropa Drift Viewer** (database debugging for Dart/Flutter) from streaming real-time diagnostic data — such as slow query alerts — into the unified log timeline. The workarounds available today are all inadequate (see [Workarounds Considered](#workarounds-considered) below).

## Motivation: Saropa Drift Viewer Integration

Saropa Drift Viewer provides a Query Performance Panel (Feature 15) that monitors database queries during Dart debug sessions. During a debug session, the extension:

1. Polls the Drift debug server for query performance data every few seconds
2. Displays slow queries, recent queries, and aggregate stats in the Debug sidebar
3. Color-codes queries by duration (green < 100ms, yellow 100–500ms, red > 500ms)

**What we want to log to Saropa Log Capture:**

| Scenario | Log line example | Chattiness |
|----------|-----------------|------------|
| Slow query alert | `⚠ DRIFT SLOW (1250ms): SELECT * FROM posts WHERE ...` | Low — only threshold breaches |
| All queries | `DRIFT QUERY (15ms): SELECT * FROM users WHERE id=?` | High — every query |
| Performance summary | `DRIFT STATS: 47 queries, 3.2s total, 68ms avg, slowest 1250ms` | Low — periodic |
| Connection events | `DRIFT: Connected to debug server at 127.0.0.1:8642` | Very low — lifecycle only |

The extension would expose a user-facing setting to control verbosity:

```jsonc
{
    "driftViewer.performance.logToCapture": {
        "type": "string",
        "enum": ["off", "slow-only", "all"],
        "default": "slow-only",
        "description": "Log queries to Saropa Log Capture: off, slow queries only, or all queries."
    }
}
```

At `"slow-only"` (default), only threshold breaches and periodic summaries are written — a handful of lines per minute at most. At `"all"`, every query is logged — potentially hundreds per second in a busy app, which is why this must be opt-in.

## Workarounds Considered

### 1. `insertMarker(text)` — partially viable but semantically wrong

Markers are visual separators (horizontal rules with optional labels). Using them for data lines:
- Clutters the log with separator styling where plain text is intended
- No `category` or severity level — markers can't be filtered by level or source tag
- No `timestamp` control — the marker gets the current time, which may not match the query's actual execution time
- Inflates marker count metrics, misleading the user about actual manual markers vs automated ones

**Verdict:** Acceptable for rare threshold-breach alerts (1–2 per session) but not for per-query or periodic logging.

### 2. `registerIntegrationProvider` — session boundaries only

Integration providers contribute data at session start (`onSessionStartSync` / `onSessionStartAsync`) and session end (`onSessionEnd`). They cannot contribute data mid-session. This is by design for header/footer metadata (lockfile hash, git state, test results) but not useful for streaming runtime data.

**Verdict:** Good for session-level summary (we would use this regardless). Cannot replace real-time line writing.

### 3. `console.log()` from the extension host — not captured

Extension host `console.log` goes to the "Extension Host" output channel, not the Debug Console. Saropa Log Capture captures DAP `output` events from the debug adapter. Extension-host console output is invisible to the tracker.

**Verdict:** Non-starter.

### 4. VS Code `OutputChannel.appendLine()` — not captured

Same problem. OutputChannel content is not DAP output. Saropa Log Capture does not monitor output channels.

**Verdict:** Non-starter.

### 5. Write to a `.log` file and use saropa tail — indirect

Drift Viewer could write to a workspace file (e.g., `reports/drift-queries.log`) and the user could open it with "Saropa Log Capture: Open Tailed File". This gives live viewing via the tail feature.

Problems:
- Two separate log streams — the user must switch between the main debug log and the drift log
- No interleaving with debug output — the query timing can't be correlated visually with app log lines
- File I/O overhead on every query
- Requires user action to open the tailed file
- No integration with session lifecycle, markers, search, or export

**Verdict:** Functional but poor UX. The whole point of writing to the capture is unified timeline visibility.

### 6. Abuse DAP by injecting synthetic `output` events — dangerous

Theoretically, a `DebugAdapterTracker` could inject synthetic DAP output events. This is:
- Not part of the DAP spec
- Likely to break other extensions and VS Code's own Debug Console
- Undocumented and unsupported

**Verdict:** Rejected — fragile and potentially harmful.

## Proposed API Addition

### `writeLine(text, options?)`

Add to `SaropaLogCaptureApi`:

```typescript
/**
 * Write a line into the active capture session's log.
 *
 * The line is timestamped, written to the log file, and pushed to the
 * live viewer exactly like a DAP output line. It participates in all
 * viewer features: search, level filtering, source-tag filtering,
 * exclusion rules, export, session replay, and the scrollbar minimap.
 *
 * No-op if no capture session is active.
 *
 * @param text - The line text. Newlines are normalized (each becomes a
 *   separate line in the log). Empty strings produce a blank line.
 * @param options - Optional metadata for the line.
 */
writeLine(text: string, options?: WriteLineOptions): void;
```

### `WriteLineOptions`

```typescript
export interface WriteLineOptions {
    /**
     * DAP-style category for the line.
     *
     * Standard categories: 'stdout', 'stderr', 'console'.
     * Extensions may use custom categories (e.g., 'drift-perf', 'drift-query').
     * Custom categories appear in the category filter dropdown.
     *
     * @default 'console'
     */
    readonly category?: string;

    /**
     * Severity level for coloring and filtering.
     *
     * Maps to Saropa Log Capture's 7-level classification.
     * If omitted, the line is classified by the existing level-detection
     * heuristics (strict or loose mode).
     *
     * @default undefined (auto-detect)
     */
    readonly level?: 'error' | 'warning' | 'info' | 'performance' | 'debug';

    /**
     * Source tag shown as a filterable chip in the viewer.
     *
     * Analogous to logcat tags (e.g., 'D/FlutterJNI') or bracket prefixes
     * (e.g., '[API]'). If provided, the tag appears in the source-tag
     * filter panel and can be toggled on/off.
     *
     * @example 'DRIFT'
     * @default undefined
     */
    readonly sourceTag?: string;

    /**
     * Override the timestamp for this line.
     *
     * Useful when the event occurred earlier than the write call
     * (e.g., the query finished 200ms ago but was batched).
     * If omitted, the current time is used.
     *
     * @default new Date()
     */
    readonly timestamp?: Date;
}
```

### Corresponding event type update

The existing `SaropaLineEvent` (fired by `onDidWriteLine`) already has the fields needed to represent API-written lines. Lines written via `writeLine()` should fire the same event, so other subscribers see them too. The `category` field on `SaropaLineEvent` would carry the custom category.

No changes to `SaropaLineEvent` are needed — it already has `text`, `category`, `timestamp`, `isMarker` (would be `false` for written lines).

## Implementation Notes

### Where it fits in the architecture

The write path should mirror what `session-manager.ts` does when it receives a DAP output event:

1. Apply `exclusions` filter — if the line matches an exclusion pattern, drop it
2. Apply deduplication / flood protection — identical rapid lines get `(xN)` grouping
3. Timestamp the line (use `options.timestamp` if provided, otherwise `new Date()`)
4. Determine severity level — use `options.level` if provided; otherwise run the existing level-detection heuristic
5. Write to the log file via the file writer
6. Push to the webview viewer (sidebar + pop-out) via the existing line-push mechanism
7. Fire `onDidWriteLine` event for other API subscribers
8. Update status bar counters (line count, watch pattern matches)
9. Check watch patterns and fire alerts if matched

### Flood protection

The existing flood protection (>100/sec repeated messages suppressed) should apply to API-written lines too. A consuming extension writing hundreds of per-query lines at `"all"` verbosity should be subject to the same rate limiting as DAP output. No special treatment.

### File split rules

API-written lines count toward `splitRules.maxLines` and file size limits, same as DAP lines.

### Session replay

API-written lines should be persisted with their metadata so that session replay includes them at the correct timing offsets.

### Performance impact

`writeLine()` should be synchronous (fire-and-forget) from the caller's perspective. The implementation should buffer and batch file I/O internally, same as it does for DAP lines. A consuming extension should not need to `await` each write.

## How Saropa Drift Viewer Would Use This

```typescript
// In drift viewer's extension.ts activate()

import type { SaropaLogCaptureApi } from 'saropa-log-capture';

let logApi: SaropaLogCaptureApi | undefined;

const logExt = vscode.extensions.getExtension<SaropaLogCaptureApi>(
    'saropa.saropa-log-capture'
);
if (logExt) {
    logApi = logExt.isActive ? logExt.exports : await logExt.activate();

    // Register integration provider for session header/footer
    context.subscriptions.push(
        logApi.registerIntegrationProvider({
            id: 'saropa-drift-viewer',
            isEnabled: () => true,
            onSessionStartSync: () => [{
                kind: 'header',
                lines: [
                    `Drift Viewer: ${client.baseUrl}`,
                    `Slow query threshold: ${config.slowThresholdMs}ms`,
                ],
            }],
            onSessionEnd: async () => {
                const perf = await client.performance().catch(() => null);
                if (!perf) { return undefined; }
                return [{
                    kind: 'header',
                    lines: [
                        `Drift Queries: ${perf.totalQueries} total, ` +
                            `${perf.avgDurationMs}ms avg`,
                        `Slow queries: ${perf.slowQueries.length}`,
                        ...perf.slowQueries.slice(0, 5).map(
                            q => `  ${q.durationMs}ms: ${q.sql.slice(0, 80)}`
                        ),
                    ],
                }];
            },
        })
    );
}

// In the performance refresh loop — called every 3 seconds during debug
function onPerformanceData(data: PerformanceData): void {
    if (!logApi) { return; }

    const mode = vscode.workspace.getConfiguration('driftViewer')
        .get<string>('performance.logToCapture', 'slow-only');
    if (mode === 'off') { return; }

    // Log new slow queries
    for (const q of data.slowQueries) {
        if (alreadyLogged.has(q.at)) { continue; }
        alreadyLogged.add(q.at);

        logApi.writeLine(
            `⚠ SLOW QUERY (${q.durationMs}ms): ${q.sql.slice(0, 200)}`,
            {
                category: 'drift-perf',
                level: q.durationMs > 1000 ? 'error' : 'warning',
                sourceTag: 'DRIFT',
            }
        );
    }

    // Log all queries if mode is 'all'
    if (mode === 'all') {
        for (const q of data.recentQueries) {
            if (alreadyLogged.has(q.at)) { continue; }
            alreadyLogged.add(q.at);

            logApi.writeLine(
                `QUERY (${q.durationMs}ms): ${q.sql.slice(0, 200)}`,
                {
                    category: 'drift-query',
                    level: 'debug',
                    sourceTag: 'DRIFT',
                }
            );
        }
    }
}

// On connection change — lifecycle events
function onDriftConnected(url: string): void {
    logApi?.writeLine(`Connected to Drift debug server at ${url}`, {
        category: 'drift-perf',
        level: 'info',
        sourceTag: 'DRIFT',
    });
}

function onDriftDisconnected(): void {
    logApi?.writeLine('Drift debug server disconnected', {
        category: 'drift-perf',
        level: 'warning',
        sourceTag: 'DRIFT',
    });
}
```

## Alternatives Considered

### A. `writeLines(lines[])` — batch variant

A batch method that accepts an array of `{ text, options }` entries. Useful for dumping multiple query results at once. Could be added later if demand arises; a single `writeLine()` covers the common case and batching can happen internally.

### B. `createOutputStream()` — stream-oriented API

Return a writable stream or writer object scoped to a session. Overkill for the use case and harder to manage lifecycle (what happens when the session ends mid-write?). `writeLine()` with no-op-when-inactive is simpler.

### C. Extend `insertMarker()` with options

Add `level`, `category`, etc. to `insertMarker()` instead of a new method. This conflates two concepts (visual separators vs data lines) and would break existing consumers' expectations of what a marker looks like in the viewer.

## Impact on Existing Features

| Feature | Impact |
|---------|--------|
| Log file | API lines written to file like any other line |
| Viewer (sidebar + pop-out) | API lines appear in real-time stream |
| Search | API lines searchable by text, regex |
| Level filter | API lines filterable by their declared or detected level |
| Category filter | Custom categories (e.g., `drift-perf`) appear in category dropdown |
| Source tag filter | Custom tags (e.g., `DRIFT`) appear as filterable chips |
| Exclusion rules | API lines subject to exclusion patterns |
| Watch patterns | API line text checked against keyword watches |
| Deduplication | Identical rapid API lines grouped as `(xN)` |
| Flood protection | API lines subject to same rate limiting |
| Export (HTML/CSV/JSON/SLC) | API lines included in exports |
| Session replay | API lines replayed at correct timing |
| Scrollbar minimap | API lines reflected in minimap |
| Error alerts | API lines with error level trigger alerts |
| Cross-session search | API lines indexed and searchable across sessions |
| Line count / stats | API lines counted in all metrics |
| Split rules | API lines count toward split thresholds |

## Backward Compatibility

`writeLine` is a new optional method on the API interface. Consuming extensions that already use the API are unaffected. Extensions targeting older versions of Saropa Log Capture should check for the method's existence:

```typescript
if ('writeLine' in logApi) {
    logApi.writeLine('hello', { sourceTag: 'MY-EXT' });
}
```

The `SaropaLogCaptureApi` TypeScript interface would add `writeLine` as a required method in the next major or minor version. Older runtime versions simply won't have it, so the `in` check is sufficient for cross-version safety.

## Priority

**Medium** — Drift Viewer can ship Feature 15 without this (using `insertMarker` for critical alerts and `registerIntegrationProvider` for session summaries). But the unified-timeline experience is significantly better with `writeLine()`, and other Saropa extensions (or third-party consumers) would benefit from the same capability.

---

**Reporter:** Saropa Drift Viewer team
**Date:** 2026-03-09
**Consuming extension:** [saropa_drift_viewer](https://github.com/nickmeinhold/saropa_drift_viewer)
**Affected API file:** [src/api-types.ts](../src/api-types.ts)
