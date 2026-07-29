# Plan 115b — Signal Visual Design Pass: Remaining Items

## Status: Proposed

Split from plan 115 after W1, W3, and W4 shipped. These items were deferred because they depend on data pipeline verification or are independent feature-scope expansions.

## Deferred items

### D2. Stat card delta indicators

Show a delta below each stat card count (e.g., "+200%", "-25%", "improving") comparing the current log's counts to the average of the previous N logs. Data source: `signal-co-occurrence.ts` per-session counts. Requires cross-session comparison data in the overview payload — verify availability before implementing.

### D4 / W2. Sparklines for cross-session signal trends

Small inline sparkline (50x16px SVG) per signal entry showing occurrence count over the last N logs. Reuse `renderSparkline()` from `src/ui/panels/vitals-sparkline.ts` for host-side HTML; embed a minimal helper in the webview script for the signal panel.

**Blocker:** the `timeline` data on `RecurringSignalEntry` needs to be verified as reaching the webview in the `signalData` message payload. If stripped for bandwidth, that pipeline change is out of scope for a pure-rendering plan.

Sparkline tokens already defined in plan 115 token table but not yet added to `viewer-styles-tokens.ts`: `--sparkline-up`, `--sparkline-down`, `--sparkline-flat`.

### D6. Signal panel entry density redesign

Redesign signal panel rows from single-line to structured two-line rows:
```
[ERROR]  NullPointerException            sparkline  x12
         Cannot read property 'length'         3 logs
```

Row contains: type badge (D5, already shipped), signal title, sparkline (D4), occurrence count, subtitle/excerpt, log count. Depends on D4 (sparklines) for the full layout.
