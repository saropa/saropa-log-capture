# 046 — Android System Noise Misclassified as Actionable Errors

## Status: In Progress

## Created: 2026-04-03

## Problem

Several categories of Android system log lines are displayed with misleading severity, badges, or classifications in the viewer. The device-tier demotion system (045) handles some cases but three actionable gaps remain.

---

### 1. gralloc4 / GraphicBufferAllocator / AHardwareBuffer — false badges in loose mode

**Log lines:**
```
E/gralloc4(22302): ERROR: Format allocation info not found for format: 38
E/GraphicBufferAllocator(22302): Failed to allocate (4 x 4) layerCount 1 format 56 usage b00: 5
```

**Current behavior:** Tags are `device-other`, `E/` prefix → `error` → demoted to `info` on line 113 of `viewer-data-add.ts`. However:

- In **loose mode** (`!strictLevelDetection`), `classifyError()` on line 322 runs on ALL lines regardless of tier. Text containing `"Failed"` or `"error"` can match `bugPatterns`, producing false error badges on harmless GPU driver probe messages.
- `checkCriticalError()` on line 326 also runs on ALL lines regardless of tier — device-other gralloc lines matching `criticalPatterns` (e.g. `"Out of memory"`) could fire VS Code notifications and flash the viewer border.

**Root cause:** GPU/HAL probes pixel buffer formats and logs errors for unsupported ones before falling back. Normal Android behavior on emulators and many physical devices.

**Fix:** Add `lineTier !== 'device-other'` guard to both `classifyError()` and `checkCriticalError()` calls.

---

### 2. Choreographer frame skips — tier/level contradiction

**Log lines:**
```
I/Choreographer(22302): Skipped 52 frames!  The application may be doing too much work on its main thread.
I/Choreographer(22302): Skipped 207 frames!  The application may be doing too much work on its main thread.
```

**Current behavior:** `Choreographer` tag → `device-other`. `I/` prefix → text matches `perfPattern` → `performance` level. But demotion on line 113 only checks `error`/`warning`, so `performance` bypasses demotion.

**Decision:** Choreographer frame skips ARE app-relevant — they report main thread jank caused by the developer's app code. The tag is system-issued but the signal is about app behavior. **Promote `choreographer` to `criticalTags`** so it keeps its `performance` level legitimately, resolving the tier/level contradiction.

---

### 3. DriftDebugServer SocketException — misclassified as TRANSIENT

**Log line:**
```
I/flutter (22302): [DriftDebugServer] FAILED TO START: SocketException: Failed to create server socket (OS Error: ...), address = 0.0.0.0, port = 8642
```

**Current behavior:** `SocketException` matches `transientPatterns[1]` → `classifyError()` returns `'transient'` → line gets `⚡ TRANSIENT` badge. But this is a deterministic server startup failure (port conflict on hot-restart), not a transient network error.

**Fix:** Replace the broad `SocketException` pattern with an allowlist approach — only match when followed by known-transient indicators (connection refused, timeout, reset, unreachable) rather than excluding known-permanent ones.

---

## Fixes

### Fix 1: Guard `classifyError()` for device-other lines (line 322 of `viewer-data-add.ts`)

```js
// Before
var errorClass = (typeof classifyError === 'function' && (!strictLevelDetection || lvl === 'error')) ? classifyError(plain) : null;

// After — skip error classification for device-other lines entirely
var errorClass = (typeof classifyError === 'function' && lineTier !== 'device-other' && (!strictLevelDetection || lvl === 'error')) ? classifyError(plain) : null;
```

### Fix 2: Guard `checkCriticalError()` for device-other lines (line 326)

```js
// Before
if (typeof checkCriticalError === 'function') {

// After
if (typeof checkCriticalError === 'function' && lineTier !== 'device-other') {
```

### Fix 3: Promote `choreographer` to `criticalTags` (`device-tag-tiers.ts`)

```ts
const criticalTags = new Set([
    ...existing tags...
    'choreographer',        // Main thread jank — reports app behavior, not device state
]);
```

### Fix 4: Refine SocketException transient pattern (`viewer-error-classification.ts`)

```js
// Before
/SocketException/i,

// After — only match transient socket errors (connection/send failures, not bind/listen)
/SocketException(?=.*(?:Connection refused|timed?\s*out|reset|unreachable|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|broken pipe))/i,
```

## Files to Modify (execution order)

| File | Change |
|------|--------|
| `src/modules/analysis/device-tag-tiers.ts:22` | Add `choreographer` to `criticalTags` |
| `src/ui/viewer-decorations/viewer-error-classification.ts:27` | Refine `SocketException` pattern |
| `src/ui/viewer/viewer-data-add.ts:322` | Add `lineTier !== 'device-other'` guard to `classifyError()` |
| `src/ui/viewer/viewer-data-add.ts:326` | Add `lineTier !== 'device-other'` guard to `checkCriticalError()` |

## Test Plan

- **gralloc `E/` lines with device-other tier:** Verify `classifyError()` is NOT called → no badge
- **gralloc `E/` lines with device-other tier:** Verify `checkCriticalError()` is NOT called → no VS Code notification
- **Choreographer `I/` lines:** Verify tier is `device-critical` (not `device-other`) after promotion
- **Choreographer lines keep `performance` level:** Not demoted since tier is now `device-critical`
- **`SocketException: Failed to create server socket`:** Verify NOT classified as transient
- **`SocketException: Connection refused`:** Verify still classified as transient
- **`SocketException: ... timed out`:** Verify still classified as transient
- **`SocketException: ... reset`:** Verify still classified as transient

## Related

- 045 — Device Log Triage (established the tier system this bug extends)
