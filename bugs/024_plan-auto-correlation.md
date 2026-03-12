# Plan: Auto-Correlation Detection

**Feature:** Automatically detect and highlight events that appear related across sources (e.g., HTTP 500 and memory spike occurring within 1 second).

**Depends on:** Unified Timeline (Task 102) for timestamped events from all sources.

---

## What exists

- Timeline View (planned) provides events from all sources with timestamps
- Error fingerprinting identifies recurring error patterns
- Performance fingerprinting identifies slow operations
- Session metadata stores integration data with `capturedAt` timestamps

## What's missing

1. **Correlation algorithm**: Detect events that co-occur within a time window
2. **Correlation types**: Define what relationships to look for
3. **Confidence scoring**: Rank correlations by likelihood
4. **UI indicators**: Show correlation badges/links in viewer and timeline
5. **Correlation panel**: View all detected correlations for a session

---

## Sub-features

### 1. Correlation Model

**Data structure:**

Create `src/modules/correlation/correlation-types.ts`:

```typescript
interface Correlation {
    id: string;
    type: CorrelationType;
    confidence: 'high' | 'medium' | 'low';
    events: CorrelatedEvent[];
    description: string;
    timestamp: number;  // Center time of correlation
}

interface CorrelatedEvent {
    source: 'debug' | 'http' | 'perf' | 'terminal' | 'events' | 'docker';
    timestamp: number;
    summary: string;
    location: {
        file: string;
        line?: number;
    };
}

type CorrelationType =
    | 'error-http'        // Error + HTTP failure
    | 'error-memory'      // Error + memory spike
    | 'error-cpu'         // Error + CPU spike
    | 'error-terminal'    // Error + terminal error
    | 'timeout-network'   // Timeout + network issue
    | 'crash-resource'    // Crash + resource exhaustion
    | 'perf-cascade';     // Slow operation → downstream effects
```

### 2. Correlation Detection Algorithm

**Implementation:**

Create `src/modules/correlation/correlation-detector.ts`:

```typescript
interface DetectorConfig {
    windowMs: number;           // Default 2000ms
    minConfidence: 'low' | 'medium' | 'high';
    enabledTypes: CorrelationType[];
}

async function detectCorrelations(
    events: TimelineEvent[],
    config: DetectorConfig
): Promise<Correlation[]> {
    const correlations: Correlation[] = [];
    
    // Sort events by timestamp
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    
    // Sliding window approach
    for (let i = 0; i < sorted.length; i++) {
        const anchor = sorted[i];
        
        // Skip non-interesting anchors
        if (!isAnchorCandidate(anchor)) continue;
        
        // Find events within window
        const windowStart = anchor.timestamp - config.windowMs;
        const windowEnd = anchor.timestamp + config.windowMs;
        const nearby = sorted.filter(e => 
            e !== anchor && 
            e.timestamp >= windowStart && 
            e.timestamp <= windowEnd
        );
        
        // Check for correlation patterns
        const correlation = matchCorrelationPattern(anchor, nearby, config);
        if (correlation && correlation.confidence >= config.minConfidence) {
            correlations.push(correlation);
        }
    }
    
    // Deduplicate overlapping correlations
    return deduplicateCorrelations(correlations);
}

function isAnchorCandidate(event: TimelineEvent): boolean {
    // Errors, warnings, and anomalies are anchor candidates
    return event.level === 'error' || 
           event.level === 'warning' ||
           isAnomaly(event);
}

function matchCorrelationPattern(
    anchor: TimelineEvent,
    nearby: TimelineEvent[],
    config: DetectorConfig
): Correlation | undefined {
    // Pattern: Error + HTTP failure
    if (anchor.level === 'error' && config.enabledTypes.includes('error-http')) {
        const httpFailure = nearby.find(e => 
            e.source === 'http' && 
            isHttpError(e)
        );
        if (httpFailure) {
            return buildCorrelation('error-http', [anchor, httpFailure], 'high');
        }
    }
    
    // Pattern: Error + Memory spike
    if (anchor.level === 'error' && config.enabledTypes.includes('error-memory')) {
        const memSpike = nearby.find(e => 
            e.source === 'perf' && 
            isMemorySpike(e)
        );
        if (memSpike) {
            return buildCorrelation('error-memory', [anchor, memSpike], 'medium');
        }
    }
    
    // Pattern: Timeout + Network issue
    if (isTimeoutError(anchor) && config.enabledTypes.includes('timeout-network')) {
        const networkIssue = nearby.find(e => 
            (e.source === 'http' && isHttpTimeout(e)) ||
            (e.source === 'terminal' && isNetworkError(e))
        );
        if (networkIssue) {
            return buildCorrelation('timeout-network', [anchor, networkIssue], 'high');
        }
    }
    
    // ... more patterns
    
    return undefined;
}
```

### 3. Anomaly Detection Helpers

**Implementation:**

Create `src/modules/correlation/anomaly-detection.ts`:

```typescript
interface PerfBaseline {
    avgMemory: number;
    avgCpu: number;
    stdDevMemory: number;
    stdDevCpu: number;
}

function isMemorySpike(event: TimelineEvent, baseline?: PerfBaseline): boolean {
    // Memory increase > 50% from baseline or > 100MB jump
    const memMb = extractMemoryMb(event);
    if (!memMb) return false;
    
    if (baseline) {
        return memMb > baseline.avgMemory + 2 * baseline.stdDevMemory;
    }
    return memMb > 500; // Fallback: absolute threshold
}

function isCpuSpike(event: TimelineEvent, baseline?: PerfBaseline): boolean {
    const cpu = extractCpuLoad(event);
    if (!cpu) return false;
    
    if (baseline) {
        return cpu > baseline.avgCpu + 2 * baseline.stdDevCpu;
    }
    return cpu > 0.8; // Fallback: 80% CPU
}

function isHttpError(event: TimelineEvent): boolean {
    const status = extractHttpStatus(event);
    return status !== undefined && status >= 400;
}

function isHttpTimeout(event: TimelineEvent): boolean {
    const duration = extractHttpDuration(event);
    return duration !== undefined && duration > 10000; // > 10 seconds
}

function isTimeoutError(event: TimelineEvent): boolean {
    const text = event.summary.toLowerCase();
    return text.includes('timeout') || 
           text.includes('timed out') ||
           text.includes('etimedout');
}

function isNetworkError(event: TimelineEvent): boolean {
    const text = event.summary.toLowerCase();
    return text.includes('network') ||
           text.includes('econnrefused') ||
           text.includes('enotfound') ||
           text.includes('socket');
}
```

### 4. UI Integration

**Timeline View badges:**

In Timeline View, show correlation indicator on correlated events:

```
14:32:05 ⚠ [Debug] ERROR: Connection timeout        🔗
         🔗 [HTTP]  POST /api/auth → 500 (3002ms)   🔗
         🔗 [Perf]  Memory spike: 450MB → 890MB     🔗
```

Click 🔗 badge → highlight all correlated events.

**Log Viewer indicators:**

Add correlation badge to log lines that are part of a correlation:

```typescript
// In viewer-data-helpers-render.ts
if (line.correlationId) {
    html += `<span class="correlation-badge" data-correlation="${line.correlationId}" 
             title="Related to ${line.correlationDescription}">🔗</span>`;
}
```

**Correlation Panel:**

Create `src/ui/panels/correlation-panel.ts`:

- List all correlations for the session
- Click to jump to correlated events
- Filter by correlation type
- Toggle types on/off

### 5. Configuration

**Settings:**

```json
{
    "saropaLogCapture.correlation.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable automatic correlation detection"
    },
    "saropaLogCapture.correlation.windowMs": {
        "type": "number",
        "default": 2000,
        "minimum": 500,
        "maximum": 10000,
        "description": "Time window for correlation detection (milliseconds)"
    },
    "saropaLogCapture.correlation.minConfidence": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "default": "medium",
        "description": "Minimum confidence level to show correlations"
    },
    "saropaLogCapture.correlation.types": {
        "type": "array",
        "default": ["error-http", "error-memory", "timeout-network"],
        "description": "Correlation types to detect"
    }
}
```

### 6. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/correlation/correlation-types.ts` | New: data model |
| `src/modules/correlation/correlation-detector.ts` | New: detection algorithm |
| `src/modules/correlation/anomaly-detection.ts` | New: anomaly helpers |
| `src/modules/correlation/correlation-store.ts` | New: cache correlations per session |
| `src/ui/timeline/timeline-content.ts` | Add correlation badges |
| `src/ui/viewer/viewer-data-helpers-render.ts` | Add correlation indicators |
| `src/ui/panels/correlation-panel.ts` | New: correlation list panel |
| `package.json` | Add settings |
| `l10n.ts` + bundles | Add localization strings |

---

## Phases

### Phase 1: Core detection
- Correlation model and types
- Basic detection algorithm (error-http, error-memory)
- Store correlations with session

### Phase 2: UI integration
- Timeline badges
- Log viewer indicators
- Click to highlight related events

### Phase 3: Advanced patterns
- More correlation types (cascade, resource exhaustion)
- Anomaly baseline calculation
- Correlation panel

### Phase 4: Learning
- Track user feedback (dismiss/confirm correlation)
- Adjust confidence based on feedback
- Suggest new correlation patterns

---

## Considerations

- **Performance**: Run detection async after timeline loads. Don't block UI.
- **False positives**: Start with high confidence patterns only. Let users tune.
- **Timestamp quality**: Correlation depends on good timestamps. Warn if low quality.
- **Large sessions**: Cap events scanned (e.g., 10k) to bound CPU time.
- **Storage**: Store correlations in session metadata for persistence.

---

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 3-4 days | Unified Timeline |
| Phase 2 | 2-3 days | Phase 1 |
| Phase 3 | 2-3 days | Phase 2 |
| Phase 4 | 3-4 days | Phase 3 + usage data |
| **Total** | **10-14 days** | |

---

## Success Criteria

1. User opens a session with HTTP error + memory spike within 2s
2. Correlation is automatically detected and both events show 🔗 badge
3. Clicking badge highlights both events
4. Correlation panel shows "Error correlated with memory spike"
5. User can disable/tune correlation types
