# Plan 112 — Tag chip tooltips from the Android/Flutter tag glossary

**Status:** Proposed — not started.

## Problem

The user supplied a glossary — `plans/112_plan-tag-tooltip-descriptions_tag_mapping.json` (untracked, 40 entries) — mapping
common Android/Flutter/system log tags (`ActivityManager`, `HWUI`, `Zygote`, `flutter`, …)
to a system category and a plain-English description of what that subsystem does. Request:
"import this data into the app and use it for tooltips."

Today a tag chip carries no explanation of what it means:

- **Row tag-column chip** (`renderHeadTagChip`, `src/ui/viewer-bracket-head-tags/viewer-bracket-head-tags.ts:126-132`)
  has no `title` attribute at all. The cell itself gets `headTagsTitle` — a space-separated
  list of every tag name on the line, Title Cased — but that is a name list, not an
  explanation.
- **Message Tags sidebar chip** (`rebuildTagChips`, `src/ui/viewer-stack-tags/viewer-source-tags-ui.ts:33-59`)
  shows a label + line count, no `title` either.

A user unfamiliar with Android internals sees "BLAST Buffer Queue" or "Gralloc4" and has no
in-context way to learn what emitted it.

## Data model decision

`item.tags[].key` (the same lowercase identifier that already drives filtering, coloring,
and the Message Tags registry — see `buildUnifiedLineTags` in
`src/ui/viewer/viewer-data-add-tags.ts`) is the natural lookup key: it is the tag AFTER
bracket-suffix-strip, qualified-name-collapse, and `:metadata` stripping, i.e. exactly the
short form the glossary already documents (`ActivityManager`, `flutter`, `frame-stall`, …).

One glossary entry is unreachable under that key scheme and will be folded rather than
carried over 1:1:

- `"Important:flutter/shell/platform/android/android_context_vk_impeller.cc(62)"` — the
  chip's `key` for ANY `[IMPORTANT:...]` line is always `important` (metadata after the
  first colon is stripped before the key is computed, see `parseHeadTags`), so this
  metadata-specific entry can never be looked up. Its content folds into the generic
  `"IMPORTANT"` entry; the more specific Impeller/Vulkan description is dropped as
  unreachable data, not shipped as a second silently-dead dictionary entry.

`Gralloc4`/`gralloc4` and `Perf`/`perf` (case-alias duplicates in the source JSON) collapse
to one key each once lowercased — 39 distinct tag keys total.

## l10n decision

Per direct instruction (2026-07-10 — asked as an `AskUserQuestion`, user chose **"Route
through l10n catalog"** over hardcoding English): tooltip text is real user-facing prose and
must go through the existing runtime l10n pipeline (`vt()` / `src/l10n/strings-webview-*.ts`),
not live as hardcoded English inside a TS dictionary. This is the standard runtime-l10n path
already used for every other tooltip in the viewer — no exception for volume.

To avoid duplicating English text in two places (the TS dictionary AND the l10n catalog),
the TS dictionary holds **only** a stable per-tag l10n-id (camelCase, since `.` and `-`
already appear in some raw tag keys and are unsuitable as an l10n key segment); the category
and description strings live solely in the l10n catalog, keyed off that id.

## Changes

1. **New host module** `src/modules/analysis/tag-description-dictionary.ts` (mirrors the
   existing `tag-level-dictionary.ts` pattern — hardcoded constant, single source of truth,
   no JSON import: `tsconfig.json` has no `resolveJsonModule` and `rootDir` is `src`, so
   `plans/112_plan-tag-tooltip-descriptions_tag_mapping.json` cannot be imported directly and is transcribed instead):
   - `TAG_DESCRIPTION_IDS: Readonly<Record<string, string>>` — lowercase raw tag key → l10n
     id, e.g. `activitymanager: 'activityManager'`, `'frame-stall': 'frameStall'`,
     `'aropamobile.app': 'aropamobileApp'`, `'awesome notifications': 'awesomeNotifications'`,
     `important: 'important'`, … (39 entries).
   - `lookupTagDescriptionId(tagKey: string): string | null`.
   - `tagDescriptionIdMapJson(): string` — `JSON.stringify(TAG_DESCRIPTION_IDS)`, for
     injection into the webview template (it cannot import), same pattern as
     `tagLevelMapJson()`.

2. **New l10n keys** in `src/l10n/strings-webview-c.ts` (35 lines today — has room; a further
   split to `strings-webview-d.ts` only if this addition would push it over the 300-line
   file cap, which ~80 added lines will not): for each of the 39 ids,
   `viewer.tags.desc.<id>.category` and `viewer.tags.desc.<id>.description`, English text
   transcribed verbatim from `plans/112_plan-tag-tooltip-descriptions_tag_mapping.json`'s `system_category` / `description`
   fields (minus the folded-in Impeller entry above).

3. **Webview injection + helper**, added to `getHeadTagsParserScript()` in
   `viewer-bracket-head-tags.ts` (already the shared home of `formatTagLabel`/
   `escapeHeadTag`/tag-key helpers used by both the row column and the sidebar, and loaded
   before `getSourceTagsScript()` per `viewer-content-scripts.ts`'s script order):
   ```js
   var TAG_DESCRIPTION_IDS = <tagDescriptionIdMapJson()>;
   function tagDescriptionTooltip(key) {
       var id = key ? TAG_DESCRIPTION_IDS[String(key).toLowerCase()] : null;
       if (!id) return '';
       return vt('viewer.tags.desc.' + id + '.category') + ': ' + vt('viewer.tags.desc.' + id + '.description');
   }
   ```
   Dynamic `vt()` key composition from a variable already has precedent in this codebase
   (`viewer-trouble-chart.ts:189`, `vt('viewer.troubleChart.legend.' + level, count)`), so
   this is not a new pattern. `vt()` fails soft (returns the raw key string) if a mapping id
   and a catalog key ever drift apart — the cross-check test below is what actually catches
   that, since `verify:l10n-keys`' static literal-scan cannot see a composed key.

4. **Row tag-column chip** — `renderHeadTagChip` gains a `title` attribute built from
   `tagDescriptionTooltip(key)`, HTML-escaped via the existing `escapeHeadTag`, only when
   non-empty (an unmapped tag keeps today's no-title behavior — no fabricated tooltip text).

5. **Message Tags sidebar chip** — `rebuildTagChips` (`viewer-source-tags-ui.ts`) adds the
   same `title` attribute to each `.source-tag-chip` button.

6. Cell-level `headTagsTitle` (the multi-tag name list on the tag-column cell) is left
   unchanged — it is a name list for the tags hidden behind the `+N` badge, not a
   per-tag description slot.

## Tests

- `src/test/modules/analysis/tag-description-dictionary.test.ts` (new): case-insensitive
  lookup, unknown tag → `null`, JSON round-trip.
- Extend `src/test/ui/viewer-head-tag-cell.test.ts`: `renderHeadTagChip` on a mapped tag
  (e.g. `db`) emits a `title` containing the expected category/description; on an unmapped
  tag, no `title` attribute at all.
- Extend the sidebar chip test (`viewer-tag-panel-search.test.ts` or a new file):
  `rebuildTagChips` output carries the same tooltip on the matching chip button.
- **Catalog-parity test** (host-side, importing both `TAG_DESCRIPTION_IDS` and
  `getWebviewL10nMap()`): every id in the dictionary has both a `.category` and
  `.description` key present in the merged map. This is the safety net `verify:l10n-keys`
  cannot provide for a dynamically-composed key — without it, a typo'd id would silently
  render the literal string `viewer.tags.desc.foo.category` in a tooltip instead of failing
  a build check.

## Out of scope

- Translating the new keys into non-English locales now — that stays on the existing
  operator-run `python scripts/translate_l10n.py` cadence (English-only sync is fine and
  will be run as part of landing this plan; NLLB translation itself is not triggered here).
- Editing `plans/112_plan-tag-tooltip-descriptions_tag_mapping.json` itself — kept as-is, the source the TS dictionary and new
  l10n keys are transcribed from.
- Any change to `headTagsTitle`, tag coloring, filtering, or the `+N` badge — this plan only
  adds tooltip text to chips that already render today.

## Finish Report (2026-07-10)

Deliverable for this session was the plan itself, not an implementation: the source
glossary (`plans/112_plan-tag-tooltip-descriptions_tag_mapping.json`) was reviewed against
the current tag pipeline (`buildUnifiedLineTags`, `parseHeadTags`, `renderHeadTagChip`,
`rebuildTagChips`) to determine a lookup key, one unreachable glossary entry was identified
and its handling decided, and the l10n routing question was put to the owner and resolved
("Route through l10n catalog"). No source files were edited. Status remains **Proposed —
not started**; the six numbered items under Changes are the implementation task list for a
future session.
