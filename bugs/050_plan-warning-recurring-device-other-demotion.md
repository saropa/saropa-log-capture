# Plan 050 — warning-recurring signal blocked by device-other tier demotion

## Status: Implemented

## Goal

Lines containing warning keywords (e.g., `"Known issue: caution"`) that repeat 5+ times in a session produce no `warning-recurring` signal — even though the keyword `caution` is in the default warning keyword list and the recurrence threshold is only 3. The root cause is a tier-based level demotion that silently converts warnings to `info` before the signal collector ever sees them.

This plan fixes the signal collector to capture warnings **before** demotion, and adds a "pre-demotion level" field so the original classification is preserved for signal analysis.

---

## Problem

### Symptom

User log contains 5 occurrences of:

```
🟠  330  » 2026-04-13T11:46:50.073Z  [INFO ]  Known issue: caution
🟠  373  » 2026-04-13T11:46:50.074Z  [INFO ]  Known issue: caution
🟠  831  » 2026-04-13T11:46:50.088Z  [INFO ]  Known issue: caution
🟠 1415  » 2026-04-13T11:46:50.073Z  [INFO ]  Known issue: caution
🟠 1458  » 2026-04-13T11:46:50.074Z  [INFO ]  Known issue: caution
```

Note the 🟠 color dot — the viewer already knows these are warning-adjacent (the highlight rule matches `caution`). But the signal system sees them as `info` and ignores them.

### Root cause — three-step trace

**Step 1: Classification is correct**

`classifyLevel()` in `viewer-level-classify.ts` line 27 checks:

```javascript
var kwWarn = /\b(warn|warning|caution|fail|failed|failure)\b/i;
```

The word "caution" matches → `classifyLevel()` returns `'warning'`.

**Step 2: Tier demotion silently overrides**

`viewer-data-add.ts` line 54 assigns tier:

```javascript
var lineTier = tier || (fw === true ? 'device-other' : (fw === false ? 'flutter' : undefined));
```

If the line arrives with `fw === true` (framework), tier becomes `'device-other'`.

Then line 131 **demotes the warning to info:**

```javascript
if (lineTier === 'device-other' && (lvl === 'error' || lvl === 'warning')) lvl = 'info';
```

This demotion exists for a legitimate reason: framework-level noise from Android system services (e.g., `E/MediaCodec: Service not found`) shouldn't appear as red/yellow in the viewer. But it has an unintended side effect: **it also suppresses signal detection**.

**Step 3: Signal collector only sees `info`**

`viewer-root-cause-hints-embed-collect-general.ts` line 77:

```javascript
if (row.level === 'warning') {
    // collect for warning-recurring signal
}
```

Since `row.level` is now `'info'` (demoted), this block never executes. The 5 occurrences of "Known issue: caution" are invisible to the signal system.

### Why demotion is too aggressive

The demotion policy makes a blanket decision: **all** warnings from device-other lines are noise. But this isn't always true:

- `"Known issue: caution"` — genuine warning from a tool analyzing dependencies
- `"E/MediaCodec: Service not found"` — harmless framework noise

The demotion should suppress **display styling** (color/icon) but should **not** suppress **signal analysis**. These are two different concerns:

1. **Display concern:** Don't show red/yellow for framework noise → demotion is correct
2. **Analysis concern:** Still detect patterns in warning-classified content → demotion blocks this

---

## Scope

### In scope

1. Preserve the original (pre-demotion) level on line items for signal analysis
2. Signal collector uses the original level, not the demoted level
3. Display continues to use the demoted level (no visual change)
4. Add tests covering the demotion + signal interaction

### Out of scope

- Changing the demotion policy itself (device-other warnings still display as info)
- Making demotion configurable (separate plan if needed)
- Changing how `fw` is assigned to lines
- Reclassifying what counts as device-other vs device-critical

---

## Detailed changes

### File 1: `src/ui/viewer/viewer-data-add.ts`

**Line 131 — Preserve original level before demotion:**

**Before:**
```javascript
/* Device-other: demote error/warning to info ... */
if (lineTier === 'device-other' && (lvl === 'error' || lvl === 'warning')) lvl = 'info';
```

**After:**
```javascript
/* Device-other: demote error/warning to info for display, but preserve original for signals. */
var originalLevel = lvl;
if (lineTier === 'device-other' && (lvl === 'error' || lvl === 'warning')) lvl = 'info';
```

Then when creating the line item object (later in the function), add `originalLevel`:

```javascript
item.originalLevel = originalLevel;
```

**Important:** `originalLevel` is only set when it differs from `lvl`. For non-demoted lines, `originalLevel` is undefined (saves memory on the vast majority of lines).

More precisely:

```javascript
var originalLevel = lvl;
if (lineTier === 'device-other' && (lvl === 'error' || lvl === 'warning')) lvl = 'info';
// ... later when building the item object:
if (originalLevel !== lvl) item.originalLevel = originalLevel;
```

### File 2: `src/ui/viewer/viewer-root-cause-hints-embed-collect-general.ts`

**Line 77 — Warning collection:**

**Before:**
```javascript
if (row.level === 'warning') {
```

**After:**
```javascript
var signalLevel = row.originalLevel || row.level;
if (signalLevel === 'warning') {
```

**Lines 97–100 — Error collection (same pattern):**

Apply the same change to error collection so demoted errors also get signal analysis:

**Before:**
```javascript
if (row.level === 'error') {
```

**After:**
```javascript
if (signalLevel === 'error') {
```

Use a single `signalLevel` variable at the top of the per-row loop to avoid computing it twice.

### File 3: Line item type definition

Add `originalLevel` to whatever type/interface describes the line item data structure in the webview. Since webview code uses `/* javascript */` template literals (not TypeScript interfaces), this is likely just documented in comments.

If there's a TypeScript interface for the webview message (e.g., `PendingLine`), add:

```typescript
readonly originalLevel?: SeverityLevel;
```

---

## Data flow (before and after)

### Before (current — broken)

```
classifyLevel("Known issue: caution") → 'warning'
                    │
                    ▼
viewer-data-add.ts line 131: tier = 'device-other' → demote to 'info'
                    │
                    ▼
row.level = 'info'
                    │
                    ▼
collector line 77: if (row.level === 'warning') → FALSE → skipped
                    │
                    ▼
No warning-recurring signal. Line is invisible to analysis.
```

### After (fixed)

```
classifyLevel("Known issue: caution") → 'warning'
                    │
                    ▼
viewer-data-add.ts: originalLevel = 'warning', then demote lvl to 'info'
                    │
                    ▼
row.level = 'info' (display)    row.originalLevel = 'warning' (preserved)
                    │                           │
                    ▼                           ▼
Display: line shows as info      collector: signalLevel = 'warning' → COLLECTED
(no color change)                                │
                                                 ▼
                                    warning-recurring signal fires!
                                    "Warning repeated 5x: Known issue: caution"
```

---

## Impact analysis

### What changes for the user

**Signals panel:** warnings from device-other lines now appear as `warning-recurring` signals when they repeat 3+ times. This is purely additive — no existing signals are removed or changed.

**Viewer display:** zero change. The demotion to `info` for display purposes is preserved. Lines still show with info styling (not yellow/warning).

**Signal report:** the hypothesis text includes the real warning content, and the evidence lines link to the correct log line numbers.

### What doesn't change

- Viewer line coloring (still demoted to info display)
- Level filter behavior (still filtered as info)
- Level counts in the status bar (still counted as info)
- Error demotion display (still demoted to info display)
- Any line that was NOT demoted (originalLevel is undefined, signalLevel falls through to row.level)

### Edge case: device-other errors becoming signals

The same fix also means demoted errors from device-other lines can appear as `error-recent` signals. This is intentional — if `E/SomeService: critical failure` repeats across a session, it's worth flagging even if it's framework code. The confidence on these signals is already low/medium, and the user can dismiss them.

---

## Test plan

### Unit tests

1. **Demoted warning preserved:** line with `fw=true` and keyword "caution" → `item.level === 'info'`, `item.originalLevel === 'warning'`
2. **Non-demoted warning unchanged:** line with `fw=false` and keyword "caution" → `item.level === 'warning'`, `item.originalLevel === undefined`
3. **Signal collector uses originalLevel:** 5 lines with `level='info'` and `originalLevel='warning'` → `warningGroups` has 1 entry with count=5
4. **Signal collector fallback:** lines with no `originalLevel` → uses `row.level` as before
5. **Demoted error preserved:** line with `fw=true` and error classification → `item.level === 'info'`, `item.originalLevel === 'error'`
6. **Hypothesis generated:** 5 warning-demoted lines → `warning-recurring` hypothesis with `(5x)` count and `medium` confidence

### Manual test

- Open a log with device-other lines containing warning keywords (e.g., SDA output with "Known issue: caution")
- Verify the lines still display as info (not yellow/warning)
- Open the signals panel
- Verify a `warning-recurring` signal appears for the repeated warning
- Click the signal to open the signal report
- Verify the evidence lines point to the correct log line numbers
- Verify that regular (non-demoted) warnings still produce signals as before

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| Device-other noise floods signals | Signal threshold is 3+ repetitions — one-off framework warnings won't trigger. High-count repetitions ARE meaningful. |
| Memory overhead of `originalLevel` field | Only set when demotion occurs; undefined otherwise. Device-other lines are typically a minority of total lines. |
| Breaking existing signal behavior | Change is additive — existing `row.level` checks still work; `originalLevel` is only consulted when present. |
| Demotion bypass for display | Display code uses `row.level` (the demoted value); only the signal collector reads `originalLevel`. |

---

## Quality gates

- [ ] `npm run check-types` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run compile` — succeeds
- [ ] Tests pass
- [ ] Manual test in Extension Development Host (F5)
- [ ] Verify demoted lines still display as info (not warning/error colors)
- [ ] Verify signal appears for repeated demoted warnings
