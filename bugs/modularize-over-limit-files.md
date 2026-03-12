# Modularize Files Exceeding 300-Line Limit

**Status:** Completed  
**Priority:** Low  
**Type:** Refactoring

## Problem

6 files exceed the 300-line quality limit:

| File | Lines |
|------|-------|
| `src/extension-activation.ts` | 307 |
| `src/modules/context/context-loader.ts` | 321 |
| `src/ui/investigation/investigation-panel.ts` | 346 |
| `src/ui/panels/timeline-panel.ts` | 324 |
| `src/ui/shared/viewer-panel-handlers.ts` | 349 |
| `src/ui/viewer-context-menu/viewer-context-popover.ts` | 468 |

---

## Modularization Plan

### 1. `extension-activation.ts` (307 → ~150 lines)

**Current:** Monolithic activation function with 15+ setup concerns.

**Split into:**

| New File | Lines | Contents |
|----------|-------|----------|
| `extension-activation.ts` | ~150 | Main `runActivation()` orchestrator |
| `activation-providers.ts` | ~80 | `setupWebviewProviders()` — LogViewerProvider, VitalsPanelProvider, CodeLens |
| `activation-listeners.ts` | ~70 | `setupListeners()` — line/split listeners, config change handlers, scope context |

**Changes:**
- Extract provider registration (lines 76-98)
- Extract listener setup (lines 139-192, 267-275)

---

### 2. `context-loader.ts` (321 → ~180 lines)

**Current:** Interfaces, sidecar loaders, and loading functions mixed together.

**Split into:**

| New File | Lines | Contents |
|----------|-------|----------|
| `context-loader-types.ts` | ~70 | All interfaces: `ContextWindow`, `PerfContextEntry`, `HttpContextEntry`, etc. |
| `context-loader.ts` | ~180 | Main loading logic, sidecar discovery |
| `context-sidecar-parsers.ts` | ~70 | `loadPerfContext()`, `loadHttpContext()`, `loadTerminalContext()`, `extractTimestamp()` |

**Changes:**
- Move interface definitions (lines 12-78) to types file
- Extract parsing functions (lines 170-282) to parsers file

---

### 3. `investigation-panel.ts` (346 → ~120 lines)

**Current:** Panel management, message handling, search, and HTML generation.

**Split into:**

| New File | Lines | Contents |
|----------|-------|----------|
| `investigation-panel.ts` | ~120 | Panel lifecycle, message routing, exports |
| `investigation-panel-handlers.ts` | ~100 | Source handlers + search handlers |
| `investigation-panel-html.ts` | ~80 | `buildInvestigationHtml()`, `buildNoInvestigationHtml()`, `renderSourceItem()` |

**Changes:**
- Extract source/search handlers (lines 114-261)
- Extract HTML building (lines 263-345)

---

### 4. `timeline-panel.ts` (324 → ~170 lines)

**Current:** Panel management with large inline JavaScript (~150 lines).

**Split into:**

| New File | Lines | Contents |
|----------|-------|----------|
| `timeline-panel.ts` | ~170 | Panel lifecycle, HTML building, render helpers |
| `timeline-panel-script.ts` | ~160 | `getAdvancedScript()` function |

**Changes:**
- Extract `getAdvancedScript()` (lines 170-323) — matches existing pattern (`investigation-panel-script.ts`)

---

### 5. `viewer-panel-handlers.ts` (349 → ~60 lines)

**Current:** Four distinct handler categories in one file.

**Split into:**

| New File | Lines | Contents |
|----------|-------|----------|
| `viewer-panel-handlers.ts` | ~60 | Re-exports, shared state, `disposeHandlers()` |
| `handlers/crashlytics-handlers.ts` | ~90 | Crashlytics: request, detail, action, gcloud auth, browse, auto-refresh |
| `handlers/recurring-handlers.ts` | ~30 | `handleRecurringRequest`, `handleSetErrorStatus` |
| `handlers/context-handlers.ts` | ~100 | Integration context handlers |
| `handlers/crashlytics-serializers.ts` | ~40 | `serializeContext()`, `buildDiagnosticHtml()` |

**Changes:**
- Create `handlers/` subdirectory
- Main file becomes barrel re-export

---

### 6. `viewer-context-popover.ts` (468 → ~10 lines)

**Current:** Two large template literal functions (script ~240 lines, styles ~180 lines).

**Split into:**

| New File | Lines | Contents |
|----------|-------|----------|
| `viewer-context-popover.ts` | ~10 | Re-exports |
| `viewer-context-popover-script.ts` | ~245 | `getContextPopoverScript()` |
| `viewer-context-popover-styles.ts` | ~190 | `getContextPopoverStyles()` |

**Changes:**
- Direct split — each export becomes its own file

---

## Summary

| File | Current | Target | New Files |
|------|---------|--------|-----------|
| `extension-activation.ts` | 307 | ~150 | 2 |
| `context-loader.ts` | 321 | ~180 | 2 |
| `investigation-panel.ts` | 346 | ~120 | 2 |
| `timeline-panel.ts` | 324 | ~170 | 1 |
| `viewer-panel-handlers.ts` | 349 | ~60 | 4 |
| `viewer-context-popover.ts` | 468 | ~10 | 2 |

**Total new files: 13**

---

## Implementation Order

1. **`viewer-context-popover.ts`** — Simplest (just move template literals)
2. **`timeline-panel.ts`** — Extract script function
3. **`context-loader.ts`** — Extract types and parsers
4. **`investigation-panel.ts`** — Extract handlers and HTML
5. **`viewer-panel-handlers.ts`** — Create handlers subdirectory
6. **`extension-activation.ts`** — Extract providers and listeners last (highest risk)

---

## Resolution

Completed 2026-03-12. All 6 files modularized into 13 new files, all under 300 lines. TypeScript compiles and all 1,462 tests pass.

| Original File | Before | After |
|--------------|--------|-------|
| `viewer-context-popover.ts` | 468 | 7 |
| `timeline-panel.ts` | 324 | 148 |
| `context-loader.ts` | 321 | 130 |
| `investigation-panel.ts` | 346 | 100 |
| `viewer-panel-handlers.ts` | 349 | 33 |
| `extension-activation.ts` | 307 | 180 |

Also fixed duplicated `escapeHtml` by importing from shared `ansi.ts` module.
