# 047 - Configurable Severity Keywords

## Problem

Severity classification uses hardcoded regex patterns to map log lines to levels (`error`, `warning`, `performance`, `todo`, `debug`, `notice`). Users cannot customize which keywords trigger which severity. This causes false positives — e.g. "failed" was classified as `error` when many codebases treat it as informational or warning-level.

The classification logic is opaque: users see colored lines but have no way to discover *why* a line was classified the way it was, or to adjust it for their codebase.

## Goal

Expose the severity keyword lists as a user-editable VS Code setting, with a UI in the viewer options panel. Users can see exactly what keywords drive each severity level, and add/remove/move keywords between levels.

## Design Decisions

### D1: Word lists vs regex

| Option | Pros | Cons |
|--------|------|------|
| **A. Plain word lists** | Simple UI, no broken regex risk, easy to explain | Can't express structural patterns like `Error:` or negative lookaheads |
| **B. Full regex per level** | Maximum power | Intimidating UI, users can break classification, hard to validate |
| **C. Word lists + structural patterns stay hardcoded** | Best of both — users control keywords, we keep smart matching | Two-tier system may confuse power users |

**Recommendation:** Option C for v1. The setting controls **keywords** (plain words matched as `\b{word}\b`). Structural patterns (bracket notation `[error]`, colon suffix `Error:`, logcat prefixes `E/`, Dart `_TypeError`, `Null check operator`) remain hardcoded — they're format-aware, not keyword-aware, and breaking them would degrade classification.

The options panel should show both the editable keywords *and* the hardcoded structural rules (read-only) so users understand the full picture.

### D2: What's configurable vs hardcoded

**Configurable (keyword lists):**
- `error`: `["fatal", "panic", "critical"]`
- `warning`: `["warn", "warning", "caution", "fail", "failed", "failure"]`
- `performance`: `["perf", "performance", "dropped frame", "fps", "framerate", "jank", "stutter", "choreographer", "doing too much work", "anr", "application not responding"]`
- `todo`: `["TODO", "FIXME", "HACK", "XXX", "BUG", "KLUDGE", "WORKAROUND"]`
- `debug`: `["breadcrumb", "trace", "debug"]`
- `notice`: `["notice", "note", "important"]`

**Hardcoded (structural — shown read-only in UI):**
- Logcat prefixes: `E/` `F/` `A/` → error, `W/` → warning, `V/` `D/` → debug
- Bracket notation: `[error]` `[fatal]` `[panic]` `[critical]` → error
- Colon/bang suffix: `SomeError:` `SomeException!` → error
- Dart private types: `_TypeError` `_RangeException` → error
- `Null check operator` → error
- Drift SQL: `Drift: Sent SELECT|INSERT|...` → database
- Generic SQL: `SELECT...FROM`, `INSERT INTO`, etc. → database
- `stderr` category → controlled by existing `stderrTreatAsError` setting
- Loose mode negative lookahead: `error` not followed by `handler`, `recovery`, etc. — stays as-is
- Flutter/Dart memory phrases with context check → performance
- `skipped N frames` → performance (stays in perf pattern, not keyword list)
- GC phrases → performance

### D3: Keyword matching semantics

- Each keyword is matched as a case-insensitive whole word: `\b{keyword}\b`
- Multi-word phrases allowed (e.g. `"dropped frame"`, `"application not responding"`)
- A keyword in a higher-priority level wins (priority order: error > warning > performance > todo > debug > notice)
- Duplicate keywords across levels: last-writer-wins at config read time — `getConfig()` warns and assigns to highest-priority level
- Empty keyword strings are silently dropped during normalization

### D4: Interaction with `levelDetection` strict/loose setting

- **Strict mode** currently requires structural context for `error`/`exception` (colon, bracket, etc.). With configurable keywords, strict mode continues to apply *only* to the hardcoded structural patterns. User-defined keywords are always matched as whole words regardless of strict/loose — the user explicitly chose them.
- **Loose mode** currently matches bare `error`/`exception` with a negative lookahead. This stays hardcoded. If a user adds `"error"` to their keyword list, the keyword match fires first (no lookahead). This is intentional — if they explicitly add it, they want it.

### D5: Error sub-classification (transient/critical/bug)

The error sub-classification patterns in `viewer-error-classification.ts` (e.g. `TimeoutException` → transient, `NullPointerException` → critical) are a separate concern. They only apply *after* a line is already classified as error-level.

**Not in scope for v1.** These could become configurable in a follow-up, using the same pattern. Mention in the UI that sub-classification exists but isn't yet editable.

### D6: Settings UI in options panel

Add a **"Severity Keywords"** section to the existing viewer options panel:

- One collapsible group per severity level (error, warning, performance, todo, debug, notice)
- Each group shows:
  - Editable keyword pills/tags with remove buttons
  - An "Add keyword" input field
  - Read-only section showing hardcoded structural rules for that level (dimmed, with tooltip explaining these are built-in)
- Visual indicator showing the severity color next to each group header
- "Reset to defaults" button per level and globally
- Changes write to `settings.json` and take effect immediately (existing config change listener)

### D7: Setting shape in package.json

```jsonc
"saropaLogCapture.severityKeywords": {
    "type": "object",
    "default": {
        "error": ["fatal", "panic", "critical"],
        "warning": ["warn", "warning", "caution", "fail", "failed", "failure"],
        "performance": ["perf", "performance", "dropped frame", "fps", "framerate", "jank", "stutter", "choreographer", "doing too much work", "anr", "application not responding"],
        "todo": ["TODO", "FIXME", "HACK", "XXX", "BUG", "KLUDGE", "WORKAROUND"],
        "debug": ["breadcrumb", "trace", "debug"],
        "notice": ["notice", "note", "important"]
    },
    "properties": {
        "error": { "type": "array", "items": { "type": "string" } },
        "warning": { "type": "array", "items": { "type": "string" } },
        "performance": { "type": "array", "items": { "type": "string" } },
        "todo": { "type": "array", "items": { "type": "string" } },
        "debug": { "type": "array", "items": { "type": "string" } },
        "notice": { "type": "array", "items": { "type": "string" } }
    },
    "description": "Keywords that trigger each severity level. Each keyword is matched as a case-insensitive whole word. Structural patterns (logcat prefixes, bracket notation, Dart types) are built-in and shown read-only in the options panel."
}
```

## Implementation

### Phase 1: Setting + classifier wiring

1. **package.json** — add `saropaLogCapture.severityKeywords` setting with default values
2. **config-types.ts** — add `SeverityKeywords` interface and add to `SaropaLogCaptureConfig`
3. **config-normalizers.ts** — add `normalizeSeverityKeywords()` that validates arrays, lowercases, deduplicates, resolves cross-level conflicts
4. **config.ts** — read and normalize the setting in `getConfig()`
5. **level-classifier.ts** — replace hardcoded keyword patterns with dynamic regex built from config. Keep structural patterns hardcoded. Export a `buildKeywordPattern(keywords: string[]): RegExp` helper
6. **viewer-level-classify.ts** — receive keyword config via message, rebuild patterns in webview JS
7. **config-types.ts** — extend `ErrorClassificationSettings` to include `severityKeywords`
8. **log-viewer-provider-state.ts** — include keywords in the settings message
9. **activation-listeners.ts** — existing config change listener already triggers `setErrorClassificationSettings`, just needs to include new field

### Phase 2: Options panel UI

1. **viewer-options-panel-html.ts** — add "Severity Keywords" section with collapsible groups
2. **viewer-options-panel-script.ts** — add keyword pill rendering, add/remove handlers, settings write-back via `postMessage`
3. **log-viewer-provider.ts** / **pop-out-panel.ts** — handle `updateSeverityKeywords` message from webview, write to workspace config
4. **Styling** — keyword pills with severity-colored borders, read-only structural rules dimmed

### Phase 3: Tests

1. **level-classifier.test.ts** — parametrize tests to pass keyword config; test custom keywords override defaults
2. **config-normalizers.test.ts** — test normalization: empty strings, duplicates, cross-level conflicts
3. **New: severity-keywords-config.test.ts** — integration test: config change → classifier behavior change

## Files touched

| File | Change |
|------|--------|
| `package.json` + NLS files | New setting definition |
| `src/modules/config/config-types.ts` | `SeverityKeywords` interface |
| `src/modules/config/config-normalizers.ts` | `normalizeSeverityKeywords()` |
| `src/modules/config/config.ts` | Read new setting |
| `src/modules/analysis/level-classifier.ts` | Accept keywords param, build dynamic patterns |
| `src/ui/viewer-search-filter/viewer-level-classify.ts` | Receive keywords via message, rebuild patterns |
| `src/ui/provider/log-viewer-provider-state.ts` | Include keywords in settings message |
| `src/ui/viewer-panels/viewer-options-panel-html.ts` | Keywords UI section |
| `src/ui/viewer-panels/viewer-options-panel-script.ts` | Pill add/remove logic |
| `src/ui/provider/log-viewer-provider.ts` | Handle keyword update message |
| `src/ui/provider/pop-out-panel.ts` | Handle keyword update message |
| `src/activation-listeners.ts` | Pass keywords through existing listener |
| Tests (multiple) | New + updated tests |

## Risks

- **Performance**: rebuilding regex from word lists on every config change is cheap; doing it per-line would not be. Build once on config change, cache the compiled `RegExp`.
- **Migration**: existing users have no setting → defaults match current behavior (post fail→warning change). No migration needed.
- **Keyword conflicts**: a word in both `error` and `warning` lists. Normalizer resolves by highest priority and logs a warning.
- **Multi-word phrases**: `"application not responding"` needs `\b` at start/end only, with internal spaces matched literally. Test carefully.
- **Webview sync**: keywords must arrive before first lines render. Use the existing settings-push-on-webview-ready pattern.

## Out of scope (future)

- Regex support in keyword lists (v2 — if users request it)
- Configurable error sub-classification (transient/critical/bug)
- Per-workspace keyword profiles
- Import/export keyword configs
- "Classify this line as..." right-click action that auto-adds the keyword
