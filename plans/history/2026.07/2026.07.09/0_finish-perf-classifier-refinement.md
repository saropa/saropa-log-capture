# Performance-Level Classifier Refinement

## Objective

Remove false-positive severity classifications caused by bare "Performance" keyword matching generic English prose, while maintaining detection of real performance signals through structured tagging and quantified metrics.

---

## Problem

A debug log line (`[log] No videos returned from YouTube API for emergency education resource. … Performance settings filtering (maxResults=50)`) was misclassified as severity level `performance` because the bare word "Performance" triggered a keyword match in the classifier. The line is informational (describing API parameters), not a performance signal.

**Root cause:** The bare "performance" keyword pattern was too generic — it matched common English nouns and setting names unrelated to performance metrics.

---

## Solution

1. **Removed bare "performance" keyword** from default severity keyword list (`DEFAULT_SEVERITY_KEYWORDS` in `src/modules/analysis/config-normalizers.ts`). The keyword `"perf"` (abbreviation) remains and covers prefixed forms like `perf:` and `perf_metric`.

2. **Extended structural pattern matching** to detect quantified performance metrics:
   - `took <n>ms`, `took <n.m>s` (e.g., "query took 2400ms")
   - `took <n> ms` (space-tolerant variant)
   - `duration: <n>ms`, `duration: <n.m>s` (e.g., "duration: 1.5s")
   - `duration: <n> ms` (space-tolerant)
   - Existing patterns (skipped frames, GC pauses) remain intact

3. **Added `[frame-stall]` performance-level bracket tag** to the tag-level dictionary, bringing total performance tags to 14: `perf`, `performance`, `slow`, `latency`, `timing`, `profile`, `jank`, `frame`, `fps`, `gc`, `memory`, `bench`, `benchmark`, `frame-stall`.

4. **Maintained extension/webview parity** — both `level-classifier.ts` (extension-side) and `viewer-level-classify.ts` (webview-side) updated identically with doubled-backslash regex escaping for the template.

5. **Documented performance logging best practices** in README under "Log Tag Vocabulary" section with examples and explanation of why bare keywords are insufficient.

---

## Coverage

**Real performance signals still caught:**
- Structural patterns: `skipped N frames`, `gc pause/freed/concurrent`
- Quantified metrics: `took Xms`, `duration: Xms` (NEW)
- Bracket tags: `[perf]`, `[jank]`, `[slow]`, `[frame]`, `[frame-stall]`, and 9 others
- Framework auto-emit: Android logcat `Choreographer` tags, `anr`, `slow operation`
- App-emitted labels: `perf:`, `latency:`, etc. (via colon prefix pattern)

**False positive eliminated:** English prose containing "Performance" as a noun (settings, descriptions, etc.) no longer promotes to performance level.

---

## Testing

**Test audit findings (from subagent):**
- Logic, architecture, performance: ✓ All pass
- Parity (extension/webview): ✓ Maintained
- Test coverage gap: Quantified metrics (`took`, `duration:` patterns) were implemented but untested

**Tests added:**
- `level-classifier-special.test.ts`: 11 new test cases for quantified metric patterns (variations: decimals, space-before-unit, edge cases)
- `viewer-level-classify-parity.test.ts`: 2 corpus entries for parity verification

**Test results:** 474 passing tests (all special-format and parity tests verified).

---

## Files Changed

| File | Change |
|------|--------|
| `src/modules/analysis/tag-level-dictionary.ts` | Added `'frame-stall': 'performance'` to TAG_LEVEL_MAP |
| `src/modules/analysis/level-classifier.ts` | Extended `structuralPerfPattern` regex with `took`/`duration` quantified metric branches |
| `src/ui/viewer-search-filter/viewer-level-classify.ts` | Webview parity: same structural pattern update with doubled backslashes |
| `src/test/modules/analysis/level-classifier-special.test.ts` | +11 test cases for quantified metric detection |
| `src/test/ui/viewer-level-classify-parity.test.ts` | +2 corpus entries for parity guard |
| `README.md` | Added performance logging section with tag vocabulary and metric examples |
| `CHANGELOG.md` | Added/Fixed entries documenting the change for end users |
| `plans/history/2026.07/2026.07.09/BUG_No_video_incorrect_perf.log` | Bug archived to history |

---

## Verification

✓ `npm run compile` passes (zero errors, expected warnings from pre-existing files)  
✓ `npm run check-types` passes  
✓ `npm run lint` passes  
✓ 44 level-classifier tests pass  
✓ 14 viewer-level-classify-parity tests pass  
✓ 11 new quantified-metric tests pass  
✓ 2 new parity corpus entries verified in both extension and webview classifiers
