# Bug 002 — Network Failure Signal Matches Android PIDs and System Noise

## Status: Fix Ready

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

The `network-failure` signal template produces false positives on Android logcat output. The HTTP status code regex `\b(400|401|...|502|...)\b` matches **process IDs (PIDs)** embedded in Android CPU usage dumps, causing system-level ActivityManager lines to be classified as network failures.

A real-world signal report from a Flutter app session shows **20 network failures** and a headline signal referencing a Bluetooth service start — none of which involve actual network activity. The report's evidence lines point to VS Code debug configuration text, further demonstrating incorrect evidence mapping.

```
Signal: Network failure: 04-15 19:00:41.400 690 720 I ActivityManager:
  Start proc 1041:com.google.android.bluetooth/1002 for service
  {com.google.android.bluetooth/com.android.bluetooth.btservice.AdapterService}
  (3 occurrences)
Confidence: low
```

### Concrete false positive examples from the log

**PID 502 matched as HTTP 502 "Bad Gateway":**

```
E ActivityManager:   3% 502/android.hardware.sensors-service.multihal: 0% user + 3% kernel
E ActivityManager:  14% 502/android.hardware.sensors-service.multihal: 0% user + 14% kernel
```

These are Error-level lines from an **ANR CPU usage dump** — Android's ActivityManager reporting which processes consumed CPU. The number `502` is a Linux PID, not an HTTP status code. The regex `\b502\b` matches because `/` is a word boundary.

**Evidence lines point to VS Code config (lines 29–30):**

```
showGettersInDebugViews: true
evaluateToStringInDebugViews: true
```

These contain no network patterns whatsoever — the `evidenceLineIds` mapping is producing nonsensical evidence for this hypothesis.

## Environment

- Extension version: saropa-log-capture v7.1.0
- VS Code version: 1.116.0
- OS: Windows 11 Pro (Android emulator target: Pixel 8 android-x64)
- Debug adapter: Dart (Flutter)
- Log file: `reports/20260415/20260415_224655_saropa_bangers.log` (~1027 lines of logcat)

## Reproduction

1. Run a Flutter app on an Android emulator long enough to trigger an ANR (or any ActivityManager CPU dump)
2. The logcat will contain lines like `E ActivityManager: 3% 502/some.process.name: 0% user + 3% kernel`
3. Open the session in Saropa Log Capture, or let the extension-side scanner process the log
4. The signal report will show "Network failure" with the HTTP code `502 Bad Gateway` as the matched pattern

**Frequency:** Always — any session containing an ANR dump with a PID matching an HTTP error code (400, 401, 403, 404, 405, 408, 409, 413, 422, 429, 500, 502, 503, 504) will trigger this false positive.

### Related PIDs that would also false-positive

Any Android process assigned one of the 14 HTTP error code PIDs will trigger. Common PIDs in this range on the emulator: `500`, `502`, `503`, `504`. These are small numbers frequently assigned to HAL (Hardware Abstraction Layer) services that start early in the Android boot sequence.

## Root Cause

Three separate issues combine to produce the false positives:

### Issue A: HTTP status code regex matches bare numbers in non-HTTP context

**File:** `src/ui/viewer/viewer-root-cause-hints-embed-collect-general.ts` (lines 44–61, 152–158)

The HTTP code regex is constructed as:

```javascript
var rchHttpCodeRe = new RegExp('\\b(' + Object.keys(rchHttpErrorCodes).join('|') + ')\\b');
```

This produces `\b(400|401|403|404|405|408|409|413|422|429|500|502|503|504)\b`, which matches any 3-digit number at a word boundary — including PIDs, percentages, and other numeric fields in logcat.

The HTTP code detection block runs at **any log level** (except `database`):

```javascript
// Lines 152-158 — no signalLevel guard
var httpMatch = plain.match(rchHttpCodeRe);
if (httpMatch && row.level !== 'database' && networkFailures.length < 20) {
    var httpCode = httpMatch[1];
    var httpReason = rchHttpErrorCodes[httpCode] || httpCode;
    networkFailures.push({ lineIndex: i, excerpt: rchExcerpt(plain), pattern: httpCode + ' ' + httpReason });
}
```

Compare with the text-pattern network detection (lines 126–129) which correctly requires `signalLevel === 'error'`. The HTTP code block has no level guard, so even Info-level system lines are scanned.

### Issue B: Extension-side scanner has zero level filtering

**File:** `src/modules/analysis/general-signal-scanner.ts` (lines 91–97, 156–167)

The extension-side scanner reads raw log lines and calls `classifyLine()` on every line without parsing or filtering by log level:

```typescript
for (let i = 0; i < scanLimit; i++) {
    classifyLine(lines[i], i, entryMap, rawCounts);
}
```

Inside `classifyLine()`, network pattern matching runs unconditionally:

```typescript
const netMatch = firstMatch(line, networkPatterns);
if (netMatch) {
    counts.networkFailures = (counts.networkFailures ?? 0) + 1;
    // ...
}
```

The webview-side collector at least gates text-pattern matching behind `signalLevel === 'error'`, but the extension-side scanner applies no level filter at all. This means Info-level and Debug-level system lines contribute to signal counts even when they carry no diagnostic value.

Note: the extension-side scanner does **not** have HTTP code regex matching (only the webview side does), but it still suffers from matching text patterns like `'Connection reset'` against arbitrary system log lines at any level.

### Issue C: Evidence line mapping produces nonsensical evidence

**File:** `src/modules/root-cause-hints/build-hypotheses-general.ts` (lines 71–74)

The hypothesis builder passes `evidenceLineIds: lines.slice(0, 8)` where `lines` comes from the grouped network failure entries' `lineIndex` values. The signal report's evidence section renders lines 29–30 (VS Code debug config) as evidence for a network failure hypothesis. This suggests either:

1. An off-by-one or index-space mismatch between the viewer's `allLines` array indices and the rendered line numbers, or
2. The evidence line IDs are being populated from the wrong signal group

Either way, the evidence section shows content that has zero relation to network activity, which undermines the report's credibility even when real network failures are present.

## Suggested Fixes

### Fix A: Require HTTP context around status code matches

The HTTP code regex should require surrounding HTTP-related context rather than matching bare numbers. Options (in order of preference):

1. **Require HTTP keyword proximity** — only match if the same line contains `HTTP`, `status`, `response`, `request`, `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, or a URL pattern. This eliminates PID/percentage matches entirely.

2. **Require the code to appear after an HTTP-related keyword** — more restrictive: `/(HTTP|status|response)\s*[:=]?\s*(4\d{2}|5\d{2})/i`

3. **Exclude lines from known noisy tags** — if the line contains `ActivityManager:` or other known system tags, skip HTTP code matching. Less robust because it's a blocklist approach.

### Fix B: Add level parsing to the extension-side scanner

Either:
- Parse the logcat level letter (`I`, `W`, `E`, `D`, `V`) from each line and only run network pattern matching on error-level lines (matching the webview's behavior), or
- Accept that the extension-side scanner is intentionally broader and document that its counts are approximate

### Fix C: Audit evidence line mapping

Trace the `evidenceLineIds` flow from `collectGeneralSignals()` through `networkHypotheses()` to the rendered report to find where the index mismatch occurs. The viewer's `allLines` array may use a different indexing scheme than the rendered line numbers.

## Tests Added

- `src/test/modules/analysis/general-signal-scanner.test.ts` — verifies logcat level detection (`getLogcatLevel`) and level filtering (`isErrorLevelOrNonLogcat`): tag-format and threadtime-format parsing, error/non-error level filtering, non-logcat passthrough.

## Commits

<!-- Add commit hashes as fixes land. -->
