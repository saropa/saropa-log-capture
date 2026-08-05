# Plan 118 — Preview a suggested breadcrumb rule before accepting it

**Status:** Proposed (2026-08-05) — not started
**Depends on:** the empty-state diagnostic (`flow-map-empty-diagnostic.ts`, commits 6d52f05b /
08bc9ab0) and the phase-D custom-pattern settings (plan 117, commit b7b95ce6).

## Problem

The empty-state offers suggested rules as a regex plus one sample line and a frequency count. That
asks the reader to evaluate a regex in the abstract: they cannot tell whether accepting it produces
a useful map or twelve junk nodes until after it is written to their settings and the report
re-renders. If the answer is junk, undoing means hand-editing `settings.json` — a worse position
than before they clicked.

The information needed to answer "what will this do?" is already in memory at render time: the log
lines and the rule. Nothing needs to be persisted to find out.

## Proposal

Each suggestion row gains an outcome preview: how many nodes the rule WOULD create, and the first
few labels it would produce. The decision moves from "does this regex look right" to "is this the
map I wanted".

### 1. Pure computation (`flow-map-empty-diagnostic.ts` or a sibling module)

```
export interface RulePreview {
    readonly nodeCount: number;      // distinct normalized labels the rule yields
    readonly matchCount: number;     // total lines matched (repeat visits included)
    readonly labels: string[];       // first N distinct labels, in first-seen order
    readonly truncated: boolean;     // more labels exist than `labels` holds
}
export function previewRule(lines, pattern, label, maxLabels = 4): RulePreview
```

Reuse the real pipeline rather than re-implementing matching: build the one-entry
`CustomPatterns` via `compileCustomPatterns`, run `parseLog(lines, undefined, patterns)`, then count
distinct `normalizeKey(event.label)` values among the resulting `nav` events. Using the actual
parser is the point — a preview computed by a parallel implementation can disagree with what
accepting the rule really does, which is worse than no preview.

Cost control: previews run for at most 3 suggestions and reuse the already-read `lines` array.
`parseLog` over a capped 5000-line window is the same work the diagnostic already does; if profiling
shows it matters, cap the preview scan separately rather than caching across renders (the report is
regenerated per refresh anyway).

### 2. Presentation

Computed in `commands-flow-map.ts` alongside the suggestions and carried on the existing
`BreadcrumbSuggestion` (add an optional `preview` field) so no new plumbing crosses the panel
boundary. Render under each suggestion row, muted and smaller:

```
Route pushed: HomePage                        12x   [ Add rule ]
  → 5 screens: HomePage, Settings, Profile, Contact View +2
```

Zero-node previews are the valuable case: render `no screens — this rule would not add anything`
and disable that row's button (`aria-disabled` + `disabled`), because accepting it is strictly
pointless. This is the main reason to build the feature.

### 3. l10n

New keys: `flowMap.previewNodes` (`{0} screens: {1}`), `flowMap.previewNone`
(`no screens — this rule would not add anything`), `flowMap.previewMore` (`+{0}`). English source
only; translation is operator-run.

### 4. Tests

Pure-module tests in a new `flow-map-rule-preview.test.ts`: a rule over a synthetic log yields the
expected `nodeCount`/`labels`; repeat visits raise `matchCount` but not `nodeCount`; a rule matching
nothing yields `nodeCount: 0`; `truncated` set when labels exceed the cap; malformed pattern returns
a zero preview instead of throwing. HTML tests: the preview line renders per row, and a zero-node
row renders the disabled button.

## Explicitly out of scope

- Editing a suggested rule inline before accepting (a settings-editor concern).
- Previewing rules the user typed by hand — the trigger is the suggestion list only.
- Persisting or caching previews across report refreshes.

## Risks

- **Preview/reality drift** — mitigated by computing through `parseLog` rather than a parallel
  matcher. Any future divergence would be a parser change, which the preview would then track.
- **Cost on large logs** — three extra `parseLog` passes over a capped window. Measure before
  optimizing; the report already re-reads the whole log per refresh.
- **Label noise** — a too-loose rule can yield hundreds of distinct labels. The node count is the
  signal that catches this, which is precisely the outcome the feature exists to surface.
