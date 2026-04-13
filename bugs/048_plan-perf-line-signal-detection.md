# Plan 048 — Detect PERF lines as slow-operation signals

## Status: Done

## Goal

The signal system cannot detect `[log] PERF operationName: Nms` lines as slow operations because the duration regex in the webview collector doesn't recognize the `PERF` keyword syntax. Additionally, the 2000ms threshold means sub-second operations (503ms) and even 1-second operations (1023ms, 1032ms) are silently ignored — even when multiple slow operations cluster together and indicate a systemic performance problem.

This plan adds PERF-line recognition to the slow-operation signal collector and introduces a configurable threshold with a lower default that catches real-world performance issues.

---

## Problem

### Symptom

User log contains these lines, none of which produce a signal:

```
[log] PERF _loadBadgeCount: 503ms (count=3)
[log] PERF dbEventCountForDate: 1023ms (fast=0ms, parallel=1023ms) contacts=0, holidays=0, static=0, count=3
[log] PERF _getEventCountForDate: 1032ms (count=3, date=2026-04-13 07:54:39.171100)
```

### Root cause (two separate issues)

**Issue 1: Regex mismatch**

The duration extractor in `viewer-root-cause-hints-embed-collect-general.ts` line 39 uses:

```javascript
var rchDurationRe = /(?:took|elapsed|duration[=:]?|in)\s*(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i;
```

This matches `took 500ms`, `duration=500ms`, `elapsed: 500ms`, `in 500ms` — but **not** `PERF operationName: 500ms`. The keyword set (`took|elapsed|duration|in`) does not include `PERF` or the `name: Nms` pattern.

**Issue 2: Threshold too high**

`ROOT_CAUSE_SLOW_OP_MIN_MS` in `root-cause-hint-eligibility.ts` line 16 is `2000`. All three PERF lines (503ms, 1023ms, 1032ms) fall below this threshold. A 1-second database query is a meaningful performance problem in a mobile app, especially when three cluster within 5 seconds.

---

## Scope

### In scope

1. Add `PERF` keyword recognition to the duration regex
2. Lower the default slow-op threshold to 500ms
3. Make the threshold a user setting (`saropaLogCapture.signalSlowOpThresholdMs`)
4. Include the operation name in the signal text (e.g., "Slow operation (1023ms): dbEventCountForDate")

### Out of scope

- Aggregating multiple PERF lines into a single "performance cluster" signal (future work)
- The `perf-fingerprint.ts` module — it already parses PERF lines for its own purposes (sidecar metadata), no changes needed there
- Changing ANR risk scoring — PERF lines are a different signal category

---

## Detailed changes

### File 1: `src/ui/viewer/viewer-root-cause-hints-embed-collect-general.ts`

**Line 39 — Duration regex**

The regex needs a second alternative that captures the `PERF name: Nms` pattern. The operation name should be captured for use in the signal text.

**Before:**
```javascript
var rchDurationRe = /(?:took|elapsed|duration[=:]?|in)\s*(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i;
```

**After — add a PERF-specific alternative:**
```javascript
var rchDurationRe = /(?:took|elapsed|duration[=:]?|in)\s*(\d+(?:\.\d+)?)\s*(ms|s|seconds?|milliseconds?)/i;
var rchPerfRe = /\bPERF\s+([\w.]+):\s*(\d+(?:\.\d+)?)\s*(ms|s)/i;
```

Two regexes are cleaner than one combined mega-regex. Try `rchPerfRe` first (more specific), fall back to `rchDurationRe`.

**Duration extraction function** (currently lines 48–55):

Update to try `rchPerfRe` first, extracting both the operation name and duration. Return a `{ durationMs: number; operationName?: string }` object instead of a bare number, so the operation name can flow into the hypothesis text.

**Before (conceptual):**
```javascript
function rchExtractDurationMs(text) {
    var m = text.match(rchDurationRe);
    if (!m) return -1;
    var val = parseFloat(m[1]);
    if (m[2].startsWith('s')) val *= 1000;
    return val;
}
```

**After:**
```javascript
function rchExtractDuration(text) {
    var pm = text.match(rchPerfRe);
    if (pm) {
        var val = parseFloat(pm[2]);
        if (pm[3].startsWith('s')) val *= 1000;
        return { durationMs: val, operationName: pm[1] };
    }
    var m = text.match(rchDurationRe);
    if (!m) return null;
    var val2 = parseFloat(m[1]);
    if (m[2].startsWith('s')) val2 *= 1000;
    return { durationMs: val2, operationName: undefined };
}
```

**Slow operation collection** (around line 111):

Update to use the new return type and pass `operationName` into the `SignalSlowOperation` entry. The `excerpt` field should include the operation name when available.

### File 2: `src/modules/root-cause-hints/root-cause-hint-types.ts`

**Line 72 — `SignalSlowOperation` interface:**

Add optional `operationName` field:

```typescript
export interface SignalSlowOperation {
  readonly lineIndex: number;
  readonly excerpt: string;
  readonly durationMs: number;
  readonly operationName?: string;
}
```

### File 3: `src/modules/root-cause-hints/root-cause-hint-eligibility.ts`

**Line 16 — Threshold constant:**

Change from hardcoded constant to a function that reads the setting:

```typescript
export const ROOT_CAUSE_SLOW_OP_MIN_MS_DEFAULT = 500;
```

The actual threshold should be read from config at collection time (see File 5).

### File 4: `src/modules/root-cause-hints/build-hypotheses-general.ts`

**Lines 95–114 — `slowOpHypotheses()` function:**

Update hypothesis text to include the operation name when available:

**Before:**
```
Slow operation (1023ms): <excerpt>
```

**After:**
```
Slow operation (1023ms): dbEventCountForDate
```

When `operationName` is present, use it as the primary label instead of the raw log excerpt. This is much more readable.

### File 5: `package.json` + `config.ts`

**New setting:**

```json
"saropaLogCapture.signalSlowOpThresholdMs": {
    "type": "number",
    "default": 500,
    "minimum": 100,
    "maximum": 60000,
    "description": "Minimum duration (ms) for a slow-operation signal. Operations faster than this are ignored.",
    "title": "Signal: slow operation threshold (ms)"
}
```

**Config reader** — add to `getConfig()`:

```typescript
signalSlowOpThresholdMs: clamp(cfg.get("signalSlowOpThresholdMs"), 100, 60000, 500),
```

**Config type** — add to `SaropaLogCaptureConfig`:

```typescript
readonly signalSlowOpThresholdMs: number;
```

### File 6: `package.nls.json`

Add localization strings for the new setting.

---

## Data flow (end to end)

```
Log line: "[log] PERF dbEventCountForDate: 1023ms ..."
                    │
                    ▼
viewer-root-cause-hints-embed-collect-general.ts
    rchPerfRe matches → { durationMs: 1023, operationName: "dbEventCountForDate" }
    1023 >= signalSlowOpThresholdMs (500) → push to slowOperations[]
                    │
                    ▼
RootCauseHintBundle.slowOperations
    [{ lineIndex: 2367, excerpt: "PERF dbEventCountForDate: 1023ms ...",
       durationMs: 1023, operationName: "dbEventCountForDate" }]
                    │
                    ▼
build-hypotheses-general.ts → slowOpHypotheses()
    text: "Slow operation (1023ms): dbEventCountForDate"
    confidence: "low", tier: 2
    templateId: "slow-operation"
                    │
                    ▼
Signal report panel shows the hypothesis
```

---

## Test plan

### Unit tests (`src/test/`)

1. **PERF regex match:** `"[log] PERF _loadBadgeCount: 503ms (count=3)"` → `{ durationMs: 503, operationName: "_loadBadgeCount" }`
2. **PERF regex with seconds:** `"PERF init: 2.5s"` → `{ durationMs: 2500, operationName: "init" }`
3. **PERF regex no match:** `"some other line"` → `null`
4. **Existing duration regex still works:** `"Query took 3200ms"` → `{ durationMs: 3200, operationName: undefined }`
5. **Threshold boundary:** 499ms line with 500ms threshold → not collected. 500ms → collected.
6. **Operation name in hypothesis text:** when `operationName` present, text uses it; when absent, falls back to excerpt
7. **Multiple PERF lines sorted by duration:** highest duration first in hypothesis list

### Manual test

- Open a `.log` file containing PERF lines at various durations (200ms, 500ms, 1500ms, 3000ms)
- Verify signals appear for 500ms+ lines
- Change `signalSlowOpThresholdMs` to 1000 in settings
- Verify only 1500ms+ and 3000ms lines produce signals
- Verify hypothesis text shows operation name

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| PERF regex conflicts with other log formats | `\bPERF\s+` word boundary + whitespace is specific enough; tested against logcat, syslog, SDA formats |
| Lower threshold floods signals | Cap at 3 slow-op hypotheses already exists (line 100–102); user can raise threshold |
| Breaking existing duration detection | PERF regex is tried first but existing regex is unchanged as fallback |
| `operationName` undefined for non-PERF lines | All consumers use `operationName ?? excerpt` pattern |

---

## Quality gates

- [ ] `npm run check-types` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run compile` — succeeds
- [ ] Tests pass
- [ ] Manual test in Extension Development Host (F5)
- [ ] Verify existing slow-op signals (non-PERF format) still work
