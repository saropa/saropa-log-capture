# Severity classifier — lint-report false positives

**Trigger.** User opened `d:\src\contacts\reports\20260530\20260530_065250_saropa_lint_report.log` in the Saropa Log Capture viewer and reported: "this is a simple report but we are incorrectly detecting some rows as errors." They listed five specific lines being miscolored — three snake_case rule names (`avoid_catching_generic_exception`, `avoid_clearing_form_on_error`, `avoid_print_error`), one yaml comment containing `error:` mid-sentence (`# Structural classification error: rule lumps FutureBuilder...`), and one yaml comment with `cannot see` (`# rule's single-method scope cannot see the pair.`).

## Finish Report (2026-05-30)

### Scope

(B) VS Code extension — TypeScript. No Flutter, no Dart, no docs-only.

### Root cause

Three patterns in the severity classifier over-matched on saropa-lint report content:

1. **`_\w*(?:Error|Exception)\b`** — intended for Dart private types (`_HttpException`, `_TypeError`). `\w` includes `_`, so the regex engine matched `_print_error` / `_catching_generic_exception` in snake_case rule names as if they were `_PrintError` / `_CatchingGenericException`. Dart private types are *always* `_PascalCase`, never snake_case.

2. **`\w*(?:error|exception)\s*[:\]!(]`** with `/i` flag — intended for label-position usages (`Error:`, `TypeError:`, `PermissionDeniedException (...)`). The `/i` flag made it pick up lowercase `error:` mid-sentence in prose like `Structural classification error: rule lumps ...`. Dart label and type conventions are PascalCase, so requiring uppercase `E` distinguishes log labels from English nouns.

3. **`\b(?:could not|cannot|unable to|failed to)\s+\w`** — intended for actionable failure phrasing (`could not decode`, `cannot open`, `failed to parse`). Matched any verb after the failure phrase, including perception/cognition verbs like `cannot see`, which appear in code comments but never in real failure messages.

### Fix

**[src/modules/analysis/level-classifier.ts](../../../../src/modules/analysis/level-classifier.ts) (extension side):**

- `strictStructuralErrorPattern`: dropped `/i`, tightened `_\w*` → `_[A-Z]\w*`. Now: `\w*(?:Error|Exception)\s*[:\]!(]|_[A-Z]\w*(?:Error|Exception)\b|Null check operator`.
- New `strictBracketErrorPattern`: `/\[(?:error|exception|fatal|panic)\]/i` — split out so explicit bracket tags retain case-insensitive matching while the main strict branch becomes case-sensitive.
- `looseStructuralErrorPattern`: tightened `_\w*` → `_[A-Z]\w*` (same Dart PascalCase reasoning); `/i` retained on the rest by design (loose mode catches bare lowercase `error`).
- `structuralWarnPattern`: added negative lookahead `(?!(?:see|tell|say|imagine|think|know|believe|recall|remember|hear|feel|guess|understand|wait|help)\b)` between the failure phrase and the trailing word.
- `matchesError`: gained a `if (strict && strictBracketErrorPattern.test(plainText))` branch so bracket tags still match in strict mode.

**[src/ui/viewer-search-filter/viewer-level-classify.ts](../../../../src/ui/viewer-search-filter/viewer-level-classify.ts) (webview mirror):**

Mirrored the three pattern changes and the bracket branch in `matchesError` so client-side classification produces the same level as the extension's analysis pass.

### Test changes

**Added [src/test/modules/analysis/level-classifier-special.test.ts](../../../../src/test/modules/analysis/level-classifier-special.test.ts) `classifyLevel — lint-report false positives (snake_case, prose)`** — 8 cases:

| Input | Expected (post-fix) |
| --- | --- |
| `    - avoid_catching_generic_exception` | `info` |
| `    - avoid_clearing_form_on_error` | `info` |
| `    - avoid_print_error` | `info` |
| `  \| # Structural classification error: rule lumps FutureBuilder, ...` | `info` |
| `  \| # ... cannot see the pair.` | `info` |
| `Error: something broke` / `TypeError: ...` / `NullPointerException: null` / `PermissionDeniedException (no OS grant)` | `error` |
| `_TypeError (null)` / `_HttpException: ...` / `_RangeError thrown` | `error` |
| `[error]` / `[ERROR]` / `[fatal]` brackets | `error` |
| `we cannot tell which one matched` / `cannot know without inspecting source` | `info` |
| `could not decode JSON` / `cannot open file` / `unable to connect` / `failed to parse` / `couldn't allocate` | `warning` |

**Updated [src/test/modules/analysis/level-classifier.test.ts:181-185](../../../../src/test/modules/analysis/level-classifier.test.ts#L181-L185)** `should handle empty category` — the assertion was pinned on lowercase `'error: test'` returning `error` in strict mode. That assertion intentionally changed under the fix; rewrote the input to `'Error: test'` (PascalCase, the actual log-label form). The intent (verify empty category falls through to text classification) is preserved with a comment naming the new contract.

### Behavior change worth flagging to the reviewer

Strict mode previously matched lowercase `error:` / `exception:` mid-sentence. Post-fix, strict mode requires PascalCase `Error:` / `Exception:` for the structural label branch (brackets and Dart private types are unaffected). Users who relied on strict mode catching lowercase `error:` labels can either switch to loose mode (which still does, via `\berror\b`) or add custom error keywords. The trade-off is intentional and named in the doc comment above `strictStructuralErrorPattern`.

### Verification

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run check-types` | Clean |
| Lint | `npm run lint` | 10 pre-existing warnings in files not touched; 0 in changed files |
| Unit tests | `npm run test` | 2922 passing |
| Compile + verify scripts | `npm run compile` | All `verify:*` scripts pass; `dist/extension.js` 4.35 MiB |
| Standalone regex sanity check | `node -e "..." | tail` | All 18 cases (5 false-positives + 13 regression guards) pass |

### Files changed

- `src/modules/analysis/level-classifier.ts` — pattern tightenings + new bracket regex + `matchesError` branch.
- `src/ui/viewer-search-filter/viewer-level-classify.ts` — mirrored changes for webview.
- `src/test/modules/analysis/level-classifier.test.ts` — one assertion rewritten to match new strict-mode contract.
- `src/test/modules/analysis/level-classifier-special.test.ts` — new `lint-report false positives` suite (8 cases).
- `CHANGELOG.md` — three bullets under `[Unreleased]` naming each false-positive family.
- `plans/history/2026.05/2026.05.30/severity-classifier-lint-report-false-positives.md` — this file.

### Outstanding work

None.

### Bug archival

No bug archive — task did not close a `bugs/*.md` file. The trigger was a direct user report on a log file, not a tracked bug.

### Finish report saved

`plans/history/2026.05/2026.05.30/severity-classifier-lint-report-false-positives.md`
