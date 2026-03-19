# Plan: Remove CSP `unsafe-inline` from viewer (and related webviews)

**Status: Implemented** (2026-03-13)

**Summary:** Removed `'unsafe-inline'` from `style-src` in viewer and session-comparison. Added `.u-hidden` utility in nonced viewer styles; session-perf chip and hidden-lines counter now toggle visibility via `classList.toggle('u-hidden')` instead of inline `style.display`. Changelog link in About panel only opens when `data-url` is set (guard for click before content load).

---

**Issue:** ROADMAP §3 — CSP `unsafe-inline` in viewer  
**Location:** `viewer-content.ts` (primary); `session-comparison.ts` also uses it  
**Severity:** Medium

---

## Current state (pre-implementation)

- **viewer-content.ts** (lines 112–114, 121): `style-src` includes both `'nonce-${nonce}'` and `'unsafe-inline'`. Styles are already injected via `<style nonce="...">`, so `unsafe-inline` weakens the policy without a documented reason.
- **session-comparison.ts** (lines 104–105): Same pattern — `style-src 'nonce-${nonce}' 'unsafe-inline'`.
- Other webviews (ai-explain-panel, bug-report-panel, insights-panel, investigation-panel, timeline-panel, analysis-panel-render) use `style-src 'nonce-${nonce}'` only (no `unsafe-inline`).

## Goal

Remove `'unsafe-inline'` from `style-src` in viewer and session-comparison so that all styles are nonce-based only, improving CSP strictness and alignment with other panels.

## Files modified

| File | Change |
|------|--------|
| `src/ui/viewer-styles/viewer-styles.ts` | Added `.u-hidden { display: none !important; }` |
| `src/ui/provider/viewer-content.ts` | Removed `'unsafe-inline'` from CSP; session-perf chip and hidden-lines counter use `u-hidden` class |
| `src/ui/session/session-comparison.ts` | Removed `'unsafe-inline'` from CSP |
| `src/ui/viewer/viewer-script-messages.ts` | Perf chip: `classList.toggle('u-hidden', !msg.has)` |
| `src/ui/viewer/viewer-hidden-lines.ts` | Hidden counter: `classList.add/remove('u-hidden')` |
