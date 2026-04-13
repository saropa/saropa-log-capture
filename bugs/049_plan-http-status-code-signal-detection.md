# Plan 049 — Detect HTTP error status codes as network-failure signals

## Status: Implemented

## Goal

The `network-failure` signal only detects socket-level and connection-level errors (SocketException, ECONNREFUSED, ETIMEDOUT, etc.). HTTP application-level errors like `404 Not Found`, `500 Internal Server Error`, and `503 Service Unavailable` are completely invisible to the signal system — even when they repeat 5+ times in a session and clearly indicate an API integration problem.

This plan extends the network-failure signal collector to recognize HTTP error status codes (4xx and 5xx), with intelligent grouping to avoid flooding the signal panel with one hypothesis per status code.

---

## Problem

### Symptom

User log contains repeated API errors that produce no signal:

```
5 × Repeated: 2026-04-13T11:46:50.416Z  [API  ]  404 Not Found (338ms)
```

Five identical 404 errors in one session clearly indicate a broken API endpoint or missing resource, but the signal system ignores them entirely.

### Root cause

The network pattern list in `viewer-root-cause-hints-embed-collect-general.ts` lines 16–20 is:

```javascript
var rchNetworkPatterns = [
    'SocketException', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
    'ECONNRESET', 'EPIPE', 'Connection refused', 'Network error',
    'Connection reset', 'Connection timed out', 'TimeoutException'
];
```

These are all **transport-layer** errors. There is no pattern for **application-layer** HTTP status codes. The collector does a simple `text.indexOf(pattern) >= 0` check (line 89) against this list. A line containing `404 Not Found` matches none of these strings.

### Why this matters

HTTP errors are the most common failure signal in mobile apps:
- **404** — missing API endpoint, wrong URL, deleted resource
- **401/403** — expired token, permission revoked
- **429** — rate limiting, retry needed
- **500** — server-side crash
- **502/503** — service down, deployment in progress

When 5 identical 404s cluster in a session, that's a strong signal of a systemic problem. The user shouldn't need to manually scan thousands of lines to find it.

---

## Scope

### In scope

1. Add HTTP status code detection to the network-failure collector
2. Recognize standard HTTP error codes (4xx and 5xx) with their reason phrases
3. Group by status code — one signal per unique code, not one per occurrence
4. Include occurrence count in the signal text
5. Differentiate confidence: 5xx = medium (server problem), 4xx = low (may be expected)

### Out of scope

- Detecting HTTP 3xx redirects (these aren't errors)
- Detecting HTTP 2xx with error bodies (would require parsing response content)
- Rate-limit-specific logic (429 + Retry-After header parsing)
- Adding a new `http-error` template — reuse `network-failure` to keep the signal taxonomy simple
- Creating a separate `api-failure` signal category (future work if needed)

---

## Detailed changes

### File 1: `src/ui/viewer/viewer-root-cause-hints-embed-collect-general.ts`

**New regex for HTTP status codes** (add near line 20, after `rchNetworkPatterns`):

```javascript
var rchHttpErrorRe = /\b(4\d{2}|5\d{2})\s+([\w\s]+?)(?:\s*\(|$|\s*\|)/;
```

This matches patterns like:
- `404 Not Found` → code=404, reason="Not Found"
- `500 Internal Server Error (23ms)` → code=500, reason="Internal Server Error"
- `503 Service Unavailable` → code=503, reason="Service Unavailable"

The trailing `(?:\s*\(|$|\s*\|)` anchors the match to avoid false positives like "I have 404 items in my cart".

**Alternative: known status code map (more precise, fewer false positives):**

```javascript
var rchHttpErrorCodes = {
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '403': 'Forbidden',
    '404': 'Not Found',
    '405': 'Method Not Allowed',
    '408': 'Request Timeout',
    '409': 'Conflict',
    '413': 'Payload Too Large',
    '422': 'Unprocessable Entity',
    '429': 'Too Many Requests',
    '500': 'Internal Server Error',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    '504': 'Gateway Timeout'
};
var rchHttpCodeRe = new RegExp('\\b(' + Object.keys(rchHttpErrorCodes).join('|') + ')\\b');
```

**Recommendation: use the known-code map approach.** A regex matching any 4xx/5xx will produce false positives on lines like `"processed 412 records"` or `"port 5000"`. The known-code map is explicit and eliminates ambiguity.

**Collection logic** (add after the existing network pattern loop, around line 92):

```javascript
// HTTP status code detection
var httpMatch = text.match(rchHttpCodeRe);
if (httpMatch && row.level !== 'database') {
    var code = httpMatch[1];
    var reason = rchHttpErrorCodes[code] || code;
    rchNetworkFailures.push({
        lineIndex: row.lineIndex,
        excerpt: text.slice(0, 200),
        pattern: code + ' ' + reason
    });
}
```

**Important guard:** skip lines classified as `level === 'database'` — SQL result sets can contain numeric values that match status codes.

**Deduplication concern:** the existing network failure collector pushes every matching line. For HTTP errors that repeat 5+ times (like the user's 404s), this creates 5 entries with the same pattern. The hypothesis builder already groups by `pattern` field (see File 3), so deduplication happens downstream. No change needed here.

### File 2: `src/modules/root-cause-hints/root-cause-hint-types.ts`

No changes needed. The existing `SignalNetworkFailure` interface already has a `pattern` field that will carry the status code:

```typescript
export interface SignalNetworkFailure {
  readonly lineIndex: number;
  readonly excerpt: string;
  readonly pattern: string;  // ← will be "404 Not Found"
}
```

### File 3: `src/modules/root-cause-hints/build-hypotheses-general.ts`

**Lines 51–75 — `networkHypotheses()` function:**

This function already groups network failures by `pattern` and includes occurrence counts. Review the grouping to confirm HTTP codes group correctly:

```typescript
// Existing logic (conceptual):
// Group by pattern → for each group with 1+ entries → create hypothesis
```

The existing text template is:
```
Network failure: <pattern> (Nx)
```

For HTTP codes this becomes:
```
Network failure: 404 Not Found (5x)
```

This reads well. No text template change needed.

**Confidence differentiation:** currently all network failures are `medium` confidence. HTTP 4xx codes may be expected (e.g., 404 on optional resource check). Adjust:

- **5xx codes** → `medium` confidence (server-side problem, always actionable)
- **4xx codes** → `low` confidence (may be expected application behavior)
- **Transport-level errors** (existing patterns) → `medium` confidence (unchanged)

Detection logic: check if `pattern` starts with `'5'` for the code:

```typescript
const is5xx = /^5\d{2}/.test(pattern);
const confidence = is5xx ? 'medium' : 'low';
```

### File 4: `package.nls.json`

No new settings, so no localization changes needed.

---

## Data flow (end to end)

```
Log line: "5 × Repeated: 2026-04-13T11:46:50.416Z  [API  ]  404 Not Found (338ms)"
                    │
                    ▼
viewer-root-cause-hints-embed-collect-general.ts
    rchHttpCodeRe matches "404"
    rchHttpErrorCodes["404"] = "Not Found"
    pattern = "404 Not Found"
    Push to rchNetworkFailures[]
    (repeated 5 times → 5 entries with same pattern)
                    │
                    ▼
RootCauseHintBundle.networkFailures
    [{ lineIndex: 853, excerpt: "5 × Repeated: ...", pattern: "404 Not Found" },
     ... (4 more with same pattern)]
                    │
                    ▼
build-hypotheses-general.ts → networkHypotheses()
    Group by pattern: { "404 Not Found": [5 entries] }
    text: "Network failure: 404 Not Found (5x)"
    confidence: "low" (4xx)
    tier: 1
    templateId: "network-failure"
                    │
                    ▼
Signal report panel shows the hypothesis
```

---

## False positive analysis

HTTP status codes are 3-digit numbers. They can appear in non-HTTP contexts:

| False positive scenario | Mitigation |
|---|---|
| `"processed 404 records"` | Known-code map requires exact code match, not arbitrary 3-digit numbers. Additionally, "404 records" doesn't match the reason phrase pattern. |
| `"port 5000"` | 5000 is not in the known-code map (only 500, 502, 503, 504). |
| `"error code 500"` | This IS a legitimate match — if a log line says "error code 500", that's worth flagging. |
| SQL result: `"SELECT 404 FROM..."` | Guarded by `row.level !== 'database'` check. |
| `"HTTP 200 OK"` | 200 is not in the known-code map (only 4xx and 5xx). |
| Repeated log line: `"5 × Repeated: ... 404 Not Found"` | Correctly matched — the repeat prefix is just presentation, the 404 is the real content. |
| Stack frame: `"at line 500"` | "500" alone won't match because the regex uses `\b` word boundary and the known-code map requires an exact match to a known code. However, `"at line 500"` would match `500`. Mitigation: only match if the line is not a stack frame (check `row.isStackFrame` or prefix pattern). |

**Additional guard for stack frames:**

```javascript
if (httpMatch && row.level !== 'database' && !rchIsStackFrame(text)) {
    // ...
}
```

Where `rchIsStackFrame` checks for the `⠀ »` prefix or `at ` prefix patterns already detected elsewhere in the extension.

---

## Test plan

### Unit tests

1. **404 Not Found detection:** `"[API] 404 Not Found (338ms)"` → pattern = `"404 Not Found"`
2. **500 Internal Server Error:** `"HTTP 500 Internal Server Error"` → pattern = `"500 Internal Server Error"`
3. **503 with repeated prefix:** `"5 × Repeated: ... 503 Service Unavailable"` → pattern = `"503 Service Unavailable"`
4. **Non-HTTP line:** `"processed 404 records successfully"` → no match (reason phrase doesn't match known codes' expected context)
5. **Database line skipped:** line with `level === 'database'` containing `"500"` → no match
6. **Stack frame skipped:** `"  ⠀ » at line 500 of..."` → no match
7. **Existing transport patterns still work:** `"SocketException: Connection refused"` → pattern = `"Connection refused"` (unchanged)
8. **Grouping:** 5 entries with pattern `"404 Not Found"` → 1 hypothesis with `(5x)` suffix
9. **Confidence 5xx vs 4xx:** `"500 Internal Server Error"` → medium, `"404 Not Found"` → low
10. **429 Too Many Requests:** `"429 Too Many Requests"` → pattern = `"429 Too Many Requests"`, confidence low

### Manual test

- Open a log file containing `404 Not Found` lines (5+)
- Verify a `network-failure` signal appears with `(5x)` count
- Open a log file containing `500 Internal Server Error` lines
- Verify the signal has `medium` confidence
- Open a log file with only transport-level errors
- Verify existing signals still appear unchanged
- Open a log file with SQL queries containing numeric values
- Verify no false positive network signals

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| False positives on numeric values in non-HTTP context | Known-code map (14 specific codes) + database-level guard + stack-frame guard |
| Flooding with repeated HTTP errors | Existing grouping-by-pattern in `networkHypotheses()` deduplicates; cap of 3 hypotheses per category |
| Changing confidence for existing network signals | Only HTTP-code signals get differentiated confidence; existing transport patterns unchanged |
| Performance: additional regex per line | Single regex with `\b` anchors; known-code map is O(1) lookup; negligible overhead |

---

## Quality gates

- [ ] `npm run check-types` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run compile` — succeeds
- [ ] Tests pass
- [ ] Manual test in Extension Development Host (F5)
- [ ] Verify existing transport-level network signals still work
- [ ] Verify no false positives on SQL or stack-frame lines
