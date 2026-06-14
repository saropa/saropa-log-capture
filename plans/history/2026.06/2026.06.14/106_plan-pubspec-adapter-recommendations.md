# 106 Manifest-driven integration recommendations

## Status

**Implemented 2026-06-14.** All five slices landed:

- Slice 1 — `readPubspecDependencies` + pure `parsePubspecDependencies` ([manifest-dependencies.ts](../src/modules/misc/manifest-dependencies.ts)), unit-tested.
- Slice 2 — pure engine `suggestAdaptersFromPubspec` ([adapter-recommendations.ts](../src/modules/misc/adapter-recommendations.ts)), unit-tested.
- Slice 3 — gated activation toast `maybeRecommendAdapters` ([recommend-adapters-notice.ts](../src/modules/integrations/recommend-adapters-notice.ts)), wired in [extension-activation.ts](../src/extension-activation.ts).
- Slice 4 — l10n keys `msg.adapterRecommend.*` in [strings-a.ts](../src/l10n/strings-a.ts) (English source only).
- Slice 5 — `package.json` reader + `suggestAdaptersFromPackageJson`, merged in the notice.

Deviation from the plan: the `flutter` marker maps to `adbLogcat` only, **not** `flutterCrashLogs`.
A guard test surfaced that `flutterCrashLogs` is a registered provider but absent from the
integrations picker table (`INTEGRATION_ADAPTERS`), so recommending it would name a raw id the user
could not then manage. Adding it to the picker is a separate product decision, deliberately not taken
here.

## Goal

When a workspace's package manifest (`pubspec.yaml` first; `package.json` as a fast follow)
declares a dependency that a Log Capture integration adapter knows how to enrich, **offer to turn
that adapter on** with a one-tap action — instead of leaving the user to discover the
`saropaLogCapture.integrations.adapters` array by hand.

Today nothing connects detected packages to adapters:

- The `packages` adapter ([package-lockfile.ts](../src/modules/integrations/providers/package-lockfile.ts))
  only hashes `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` for reproducibility. It never reads
  pubspec, never parses dependency names, never recommends anything.
- [package-detector.ts](../src/modules/misc/package-detector.ts) locates the nearest manifest root
  (including `pubspec.yaml`) but returns only the directory — it never opens the file.
- The only activation-time advisory pattern that exists is the one-time NLS coverage notice
  ([nls-coverage-notice.ts](../src/l10n/nls-coverage-notice.ts)) — the gating model to copy.

This is **discovery only**. It never enables an adapter silently; the user always taps to confirm.

## Requirements

- **R1 — Parse manifest dependencies.** Read the workspace `pubspec.yaml` and extract the union of
  `dependencies`, `dev_dependencies`, and `dependency_overrides` keys. Tolerate malformed YAML (catch,
  log to the output channel, contribute nothing). Bounded read (reuse the lockfile cap pattern —
  2 MB max). No new YAML dependency: parse the flat top-level dependency keys with a small line scanner,
  not a full YAML library (blast-radius: avoid adding a parser package for one feature).
- **R2 — Map packages → adapter ids.** A static table from dependency name (or prefix) to one or more
  canonical adapter ids (the strings each provider's `isEnabled` tests via
  `integrationsAdapters.includes(...)`). See the mapping table below.
- **R3 — Recommend only what is OFF.** Compute `suggested = mapped(adapters) − alreadyEnabled`. If the
  set is empty, do nothing — no toast.
- **R4 — Surface as a gated, opt-in prompt.** One information toast naming the detected package(s) and
  the adapter(s) it would enable, with an **Enable** action that appends the ids to
  `saropaLogCapture.integrations.adapters` (workspace scope), a **Settings** action that opens the
  setting, and an implicit dismiss. The toast names the concrete items (which package, which adapter) —
  never a generic "integrations available" message.
- **R5 — Gate once per workspace, per suggestion set.** Persist a "offered/dismissed" marker in
  workspace state keyed so a newly-added dependency can re-trigger, but the same unchanged set never
  re-nags. Follow the NLS coverage notice's gating shape.
- **R6 — All copy externalized.** Toast title, body (with `{package}` / `{adapters}` interpolation),
  and action labels go through the runtime l10n catalog (`t()` host-side), never hardcoded. Brand names
  stay literal.

## Mapping table (R2)

Adapter ids are the exact strings checked in each provider's `isEnabled`.

| Manifest dependency (pubspec) | Suggest adapter id(s) |
|---|---|
| `firebase_crashlytics` | `crashlytics` |
| `drift` / `moor` / `sqflite` / `sqlite3` | `database`, `driftAdvisor` |
| `dio` / `http` / `chopper` / `retrofit` | `http` |
| `flutter_test` / `test` / `integration_test` | `testResults` |
| `coverage` | `coverage` |
| Android target present (`flutter` SDK app) | `adbLogcat`, `flutterCrashLogs` |

`package.json` fast-follow mapping (separate slice): `@sentry/*` / `firebase` → `crashlytics`-class,
`jest` / `vitest` / `mocha` → `testResults`, `axios` / `node-fetch` → `http`, `pg` / `mysql2` /
`better-sqlite3` → `database`. Out of scope for the first slice — list here so it isn't lost.

## Non-goals

- No automatic enabling. Detection never flips a setting without a tap (R4).
- No deep dependency-tree / transitive resolution — top-level declared deps only.
- No new third-party YAML/parser dependency (R1).
- Adapters with credential or path prerequisites (e.g. `buildCi` GitHub/Azure, `security` Windows
  channel) are **not** auto-suggested — turning the adapter on alone does nothing useful without the
  sub-config, so suggesting it would be noise.

## Implementation slices

1. **Manifest reader** — extend [package-detector.ts](../src/modules/misc/package-detector.ts) (or a
   sibling `manifest-dependencies.ts` if it pushes the file over the 300-line limit) with
   `readPubspecDependencies(rootUri): Promise<Set<string>>`. Unit-tested: normal deps, dev+override
   merge, malformed YAML → empty set, missing file → empty set.
2. **Recommendation engine** — pure function `suggestAdapters(deps: Set<string>, enabled: string[]):
   string[]` driven by the mapping table. Fully unit-testable, no VS Code API. Covers R2/R3.
3. **Activation surface** — a `maybeOfferAdapterRecommendations()` called once on activation (after
   the workspace is known), mirroring the NLS coverage notice: gate check (R5) → reader (R1) → engine
   (R2/R3) → l10n toast with Enable/Settings actions (R4/R6) → write adapters + set gate marker.
4. **l10n keys** — add the source strings to the appropriate `src/l10n/strings-*.ts`; English sync only
   (never run the MT pipeline here).
5. **`package.json` mapping** — fast follow, same engine, second mapping table.

## Verification

- `npm run check-types`, `npm run lint`, targeted `npm run test:file` on the two new test files.
- Unit tests for the reader (slice 1) and engine (slice 2) are the success criteria — the toast wiring
  is covered by a wiring assertion, not an Extension Host UI test.
- Manual F5: open a Flutter workspace with `drift` + `firebase_crashlytics`, confirm a single toast
  naming both, confirm Enable appends `database`, `driftAdvisor`, `crashlytics` and does not re-fire on
  reload.

## Open question

Default-on vs surfaced-only: should the recommendation toast appear for everyone, or only when the
`packages` adapter is already enabled (treating recommendations as part of that adapter's remit)?
Recommendation: **surface for everyone** — discovery shouldn't require first finding the adapter that
discovers things. Revisit if it proves noisy. Resolved: surfaces for everyone.

## Finish Report (2026-06-14)

### Summary

Integration adapters previously required the user to discover the
`saropaLogCapture.integrations.adapters` array by hand and know which adapter id matched which
package. The capture now inspects a workspace's `pubspec.yaml` and `package.json` at activation,
maps declared packages to the adapters that enrich them, and shows a single gated notification
offering to enable any that are not already on. The notification names the triggering package and
the adapter in plain terms and never changes a setting without an explicit tap.

### Scope

(B) VS Code extension (TypeScript). No Flutter/Dart app code touched.

### Files added

- `src/modules/misc/manifest-dependencies.ts` — pure `parsePubspecDependencies` (a small
  indentation-aware line scanner, chosen over adding a YAML parser dependency) and
  `parsePackageJsonDependencies` (JSON), each with a thin `vscode.workspace.fs` reader that returns
  an empty set on any failure so activation never throws.
- `src/modules/misc/adapter-recommendations.ts` — pure mapping engine. Two static dependency→adapter
  tables (pubspec and npm) share one dedupe-and-exclude core; `suggestAdaptersFromPubspec` and
  `suggestAdaptersFromPackageJson` return adapters not already enabled, each paired with the
  dependency that triggered it.
- `src/modules/integrations/recommend-adapters-notice.ts` — `maybeRecommendAdapters`, the gated
  activation surface. Reads both manifests, merges recommendations (pubspec wins per-adapter ties),
  gates on a workspace-state key derived from the sorted suggested-id set so an unchanged set never
  re-prompts while a newly-added package surfaces a fresh one, and offers Turn On / Choose… / dismiss.
  Reuses `INTEGRATION_ADAPTERS` for friendly labels and `showIntegrationsPicker` for the Choose path.
- `src/test/modules/misc/manifest-dependencies.test.ts` (10 cases) and
  `src/test/modules/misc/adapter-recommendations.test.ts` (11 cases).

### Files changed

- `src/extension-activation.ts` — import + one `void maybeRecommendAdapters(context, folder)` call
  inside the existing `if (folder)` block.
- `src/l10n/strings-a.ts` — four keys: `msg.adapterRecommend.prompt` / `.enable` / `.choose` /
  `.enabled` (English source only; translation is left to the operator-run pipeline).
- `CHANGELOG.md` — Unreleased → Added entry.
- `README.md` — extended the integration-adapters bullet with the auto-suggestion behavior.

### Design notes for review

- The `flutter` marker maps to `adbLogcat` only. A guard test
  (`should only map to adapter ids known to the integrations UI table`) surfaced that
  `flutterCrashLogs` is a registered provider absent from `INTEGRATION_ADAPTERS`, so recommending it
  would name a raw id the user could not manage from the picker. Adding it to the picker is a separate
  product decision and was deliberately not taken.
- Credential- or path-gated adapters that do nothing on toggle alone (build/CI, security, Windows
  events) are excluded from both tables.
- `database` and `http` need configured sources but are kept as discovery hints; the integrations
  picker carries the setup guidance.
- Recommendations surface for every workspace, not only when the `packages` adapter is enabled.

### Verification

- `npm run check-types` — clean.
- `npx eslint` on all five new/changed source + test files — clean.
- `npm run compile` (full gate: esbuild + webview catalogs + `verify:l10n-keys` confirming the four
  new keys resolve + `verify:dist-size`) — passing.
- `npm run test:file` on both new test files — 10 and 11 passing.
- `npm run test:smoke` — activation completes (the new reader runs against this repo's own
  `package.json` without error).
- Existing-test audit: the only non-new test matching the touched symbols is
  `src/test/ui/log-viewer-auto-load.test.ts`, which references `extension-activation` in comments
  only; no assertion is affected.
