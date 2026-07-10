# Signal Classification Analysis: False Positives vs. False Negatives

Status: Fixed

## Problem Summary

The severity keyword classifier has conflicting requirements:
- **False Positive (reported):** Generic English text containing "Performance" as a noun (e.g., "Performance settings") classifies log lines as severity level `performance` when they are actually informational
- **False Negative (risk):** Removing the bare "performance" keyword to eliminate false positives might miss legitimate developer performance logs

## Example of False Positive

**Log line:** `[log] No videos returned from YouTube API for emergency education resource. URL: https://www.youtube.com/@VibrantForAll - This could be due to: 1) API rate limiting, 2) Channel privacy settings, or 3) Performance settings filtering (maxResults=50)`

**Actual severity:** `info` (describing API behavior and possible causes)  
**Classified as:** `performance` (because bare word "Performance" triggered the keyword match)  
**Root cause:** The word "Performance" appears as a noun phrase ("Performance settings filtering") unrelated to system performance metrics

## Current Classification Rules

### Extension-side defaults (`src/modules/config/config-normalizers.ts:107-121`)
```typescript
export const DEFAULT_SEVERITY_KEYWORDS: SeverityKeywords = {
  performance: [
    "perf", "dropped frame", "fps", "framerate",
    "jank", "stutter", "choreographer", "doing too much work",
    "anr", "application not responding", "slow operation",
  ],
  // ... other levels
};
```

### Webview-side defaults (`src/ui/viewer-search-filter/viewer-level-classify.ts:107`)
```javascript
var kwPerf = /\b(perf|dropped\s+frame|fps|framerate|jank|stutter|choreographer|doing\s+too\s+much\s+work|anr|application\s+not\s+responding)\b/i;
```

### Structural patterns (both sides)
```
structuralPerfPattern = /\b(skipped\s+\d+\s+frames?|gc\s+(?:pause|freed|concurrent))\b/i
```

**Status:** The bare "performance" keyword has been **removed** from both lists. The question is: is this sufficient to catch all real performance logs?

## False Negative Risk Assessment

### How Developers Actually Log Performance Issues

**Structured forms (catch all real perf logs):**

1. **Bracket tag:** `[perf] operation took 500ms` → caught by `matchesTagLevel()` in `tag-level-dictionary.ts`
2. **Colon prefix:** `perf: frame drop detected` → caught by `"perf"` keyword
3. **Quantified metrics:** `jank detected`, `dropped 12 frames` → caught by specific keywords
4. **Vendor patterns:** `choreographer: ...`, `GC pause: 45ms` → caught by specific keywords
5. **Framework markers:** `anr`, `slow operation` → caught by specific keywords

**Unstructured forms (what bare "performance" was catching):**

- Plain prose: "The performance of the system is..." — NOT something a well-instrumented app would emit as a log
- Generic descriptions: "Performance settings filtering" — this is the problem line from the bug; it's documentation, not a metrics signal

### Real Perf Logging Patterns in Production

- **Flutter/Dart performance logs** use `[perf]` tags or emit metrics with `"jank"`, `"frame"`, `"GC"` keywords
- **Android logcat** uses `W/Choreographer: Skipped N frames` (caught by "choreographer")
- **Custom perf instrumentation** would use `perf:`, `[perf]`, or include quantified keywords like `"took Xms"`, `"throughput"`, etc.
- No real performance instrumenter would rely on the **bare word "Performance"** appearing in English prose

### Verdict

Removing bare "performance" is **low risk** because:
1. The structural patterns are intact (`skipped N frames`, `gc pause/freed/concurrent`)
2. The `"perf"` keyword covers prefixed patterns and abbreviations
3. App-emitted bracket tags `[perf]` and similar are handled by `tag-level-dictionary.ts`, independent of keyword matching
4. Specific keywords (`jank`, `fps`, `dropped frame`, `choreographer`, `anr`, `slow operation`) cover all known performance frameworks and libraries

**False negative scenario:** A developer writes `"Performance: metric=500"` with bare Performance and expects it to classify as performance. This would only happen if:
- They don't use a structured format (`[perf]`, `perf:`)
- They rely on a side-effect of bare keyword matching
- This is an **anti-pattern**, not documented or recommended

## Structural Pattern Coverage

| Performance Signal | Caught By | Type |
|---|---|---|
| `[perf] ...` | `matchesTagLevel()` | Structural (tag) |
| `perf: ...` | `"perf"` keyword | Keyword |
| `Skipped 42 frames` | `structuralPerfPattern` | Structural |
| `GC pause: ...` | `structuralPerfPattern` | Structural |
| `jank` | `"jank"` keyword | Keyword |
| `fps` | `"fps"` keyword | Keyword |
| `W/Choreographer: ...` | `"choreographer"` keyword | Keyword |
| `anr` | `"anr"` keyword | Keyword |
| `slow operation` | `"slow operation"` keyword | Keyword |
| `dropped frame` | `"dropped frame"` keyword | Keyword |
| `stutter` | `"stutter"` keyword | Keyword |
| `doing too much work` | `"doing too much work"` keyword | Keyword |
| `application not responding` | `"application not responding"` keyword | Keyword |

## Implementation Status

**Commit applied:** Removed "performance" from both default keyword lists (extension + webview)
- `src/modules/config/config-normalizers.ts`: removed from line 113-117
- `src/ui/viewer-search-filter/viewer-level-classify.ts`: removed from line 107
- Parity maintained between both sides
- Tests pass: 44 level-classifier + 14 parity tests

## Recommendation for Review

**Does this fix correctly balance false positives and false negatives?**

The fix is **safe** if:
1. Real perf logs in the target domain (Flutter/Dart, Android) use one of the structural/keyword patterns in the coverage table above
2. No instrumentation relies on bare "Performance" as the sole signal
3. Developers using this extension understand that perf logging requires `[perf]` tags or recognized keywords

**Needs validation:**
- Audit a sample of real perf logs from the user's app to confirm they use covered patterns
- If any real perf signal is being missed, the pattern causing the miss must be identified and added to `structuralPerfPattern` or `DEFAULT_SEVERITY_KEYWORDS.performance`

## Review Findings (2026-07-09)

The review found the fix described above was **incomplete** — two defects remained (items 1 and 2; item 3 is the regression coverage added alongside):

1. **The false positive was still live.** There are THREE copies of the default keyword lists, and the third — the `saropaLogCapture.severityKeywords` setting default in `package.json` — still contained bare `"performance"`. Because VS Code resolves `cfg.get("severityKeywords")` to the `package.json` default whenever the user has not overridden the setting, and `normalizeSeverityKeywords()` keeps any non-empty array as-is, the **effective runtime keyword list still included bare "performance"** for every real user. The in-code `DEFAULT_SEVERITY_KEYWORDS` (where the word was removed) only applies when the config value is missing or malformed. Fixed: removed `"performance"` from the `package.json` default.

2. **Parity was NOT maintained.** The webview's built-in default perf regex (`kwPerf` in `viewer-level-classify.ts:111`) was missing `slow\s+operation`, which the extension-side default includes. This default is live from webview load until the first settings broadcast overwrites it. The existing parity test could not catch this because its corpus deliberately avoided keyword defaults. Fixed: added `slow\s+operation` to the webview default and added keyword-default cases to the parity corpus (the bug's example noun-phrase line → `info`, and a `W/ActivityManager: Slow operation` line → `performance`).

3. **Regression test added.** `level-classifier.test.ts` now asserts the bug's example line (`…3) Performance settings filtering (maxResults=50)`) classifies as `info`.

The false-negative analysis in this report stands: `[perf]` tags, the `perf`/`jank`/`fps`/`choreographer`/`slow operation` keywords, and the structural patterns (`Skipped N frames`, `GC pause/freed/concurrent`, `took Nms`, `duration: Nms`) cover the known real-world perf log shapes. Note also that the head-tag dictionary (`tag-level-dictionary.ts`) still maps a bracket tag `[performance]` to the performance level — that is unaffected and correct, since a bracket tag is an explicit structured signal, not prose.

