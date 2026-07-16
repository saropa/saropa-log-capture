# ENH: surface active capture sources in the viewer Filters panel

Status: shipped (2026-07-16). Both parts implemented with the recommended options.
See the Finish Report at the end.

Bundles two related items the owner raised (2026-07-16) while reviewing the adb-logcat /
ANR work:

- **Part A (feature):** show which capture sources are actually feeding the log, inside the
  "Log Sources" tab of the viewer Filters panel.
- **Part B (bug):** the "adb Logcat" checkbox in Options → Integrations is misleading for
  Flutter apps — unchecking it does not stop capture.

## 1. Why

The Filters panel "Log Sources" tab today shows three fixed visibility groups — **Flutter
DAP**, **Device** (logcat), **External** — each with All / Warn+ / None radios
([viewer-toolbar-filter-drawer-html.ts:109-130](../src/ui/viewer-toolbar/viewer-toolbar-filter-drawer-html.ts)).
Those control **display** (which captured lines are shown). They say nothing about **capture**
(which sources are running and putting lines into the log in the first place).

So a user cannot tell, from the viewer, whether the Device group is empty because logcat is
off, because no Android device is attached, or because everything is filtered. Capture on/off
lives in a different surface (Options → Integrations) that the viewer never reflects.

## 2. Part B — the checkbox inconsistency (fix first; it changes Part A's copy)

### Current behavior (verified)
- The Options → Integrations checkboxes write the `saropaLogCapture.integrations.adapters`
  string array (`ADAPTERS_KEY` in
  [integrations-ui.ts:11](../src/modules/integrations/integrations-ui.ts); read at
  [config.ts:217-219](../src/modules/config/config.ts), default `["packages","performance"]`).
- The adb-logcat provider enables itself when the adapter is **explicitly listed OR** the
  debug session is Dart/Flutter (auto-detect):
  ```
  const explicit = (config.integrationsAdapters ?? []).includes('adbLogcat');
  const autoDetect = sessionContext.debugAdapterType === 'dart';
  return explicit || autoDetect;
  ```
  ([adb-logcat.ts:24-28](../src/modules/integrations/providers/adb-logcat.ts)).
- `adbLogcat` is **not** in the default adapters array, so its checkbox renders **unchecked**.
  For a Flutter app, auto-detect returns true anyway — so the feed runs while the box reads
  "off". Unchecking (or leaving unchecked) does nothing.

### The problem
An unchecked box that the code ignores. A user who explicitly does not want logcat cannot
express that, and the UI actively misinforms them. This is the same class of defect the
house rule "verify the EFFECTIVE state, not the declared default" warns about.

### Options (pick one in review)
1. **(Recommended) Make the checkbox authoritative + show auto-on state.** Keep auto-detect
   as the *default* for Flutter, but render the checkbox as **checked (auto)** whenever the
   provider would run, and honor an explicit uncheck as a real opt-out. Concretely: add a
   tri-state or an "auto" indicator, and change `checkEnabled` so an explicit *removal*
   (a sentinel like `!adbLogcat` in the adapters array, or a dedicated
   `integrations.adbLogcat.enabled` override) suppresses auto-detect. This preserves the
   zero-config Flutter experience while making the toggle truthful.
2. **Add a plain `integrations.adbLogcat.enabled` boolean** (default true) that gates the
   provider ahead of auto-detect, and bind the checkbox to it. Simpler, but adds a second
   on/off concept next to the adapters array.
3. **Leave capture as-is; only fix the label** to read "adb Logcat (auto for Flutter)" and
   disable the checkbox. Lowest effort, least honest — documents the quirk instead of fixing
   it. Not recommended.

Recommendation: option 1. It keeps one source of truth (the adapters set) and makes the
displayed state match the effective state.

## 3. Part A — surface active sources in "Log Sources"

### What to show
Under the existing three tier radio groups, add a compact, read-only **"Capture sources"**
block listing each source currently feeding this log, with an on/off dot and a one-click jump
to its Options toggle. Example rows: `adb Logcat — on`, `Terminal — on`,
`Browser / DevTools — off`. This is status, not a second set of toggles — capture on/off stays
in Options → Integrations (one source of truth; see Part B).

### Where the data comes from
The host already tracks contributing providers: `IntegrationRegistry.getLastEndContributorIds()`
and the per-session streaming starts in `runOnSessionStartStreaming`
([registry.ts:166-196](../src/modules/integrations/registry.ts)). But there is **no live push**
of "sources active for the current session" to the webview today. Needed:

1. Host computes the active/enabled capture-source list at session start (which streaming
   providers passed `isEnabled`, plus adb availability / device attached for adbLogcat).
2. New host → webview message (e.g. `type: 'captureSources'`, payload
   `[{ id, label, on, optionKey }]`). Add via the outbound message path and run
   `npm run generate:host-outbound-catalog` (verified on compile).
3. Webview renders the block in the Log Sources panel and re-renders on the message.
4. Clicking a row posts an incoming message that opens Options at that integration (reuse the
   existing "Configure integrations" command). New incoming case →
   `npm run generate:webview-catalog`.

### Scope guards
- **Read-only.** No capture toggling from the filters panel — avoids a second, divergent
  on/off surface.
- **Only "log-relevant" sources.** The owner asked specifically for *important log-relevant*
  integrations — the ones that stream lines into the log (adb logcat, terminal, browser/CDP,
  external log tailers, database tail). Do **not** list header/sidecar-only or metadata-only
  integrations (git, coverage, build/CI) — they never contribute viewer lines and would be
  noise. Gate on: provider implements `onSessionStartStreaming` (or otherwise emits lines).
- **File-length limit.** `viewer-toolbar-filter-drawer-html.ts` is 182 lines; the source-status
  block + its script likely pushes past the 300-line cap. Extract the block into a sibling
  (`viewer-filter-capture-sources.ts`) per the house split pattern rather than growing the
  drawer file.
- **l10n.** All new labels go through the webview string catalog (`strings-webview-*.ts` + the
  manual `__VT` sync list in `l10n.ts`), never hardcoded.

## 4. Interaction with the ANR / captureAnr work (context)

- ANR and crash lines are tier **device-critical** and always display regardless of the Device
  radio ([viewer-stack-filter.ts:79](../src/ui/viewer-stack-tags/viewer-stack-filter.ts)). The
  new `captureAnr` setting governs *capture*, the Device radio governs *display* — two layers.
- The "Capture sources" block makes this legible: if `adb Logcat — on`, the user knows ANR
  lines can arrive even when Device is set to Warn+/None.

## 5. Open questions
1. Part B option — 1, 2, or 3? (Recommend 1.)
2. Live vs. session-boundary refresh of the source list — push once at session start, or update
   as providers start/stop (device attach/detach mid-session)? Start with session-start push;
   live device reconnect is a follow-up.
3. Exact "log-relevant" set — confirm the streaming providers to include (adb logcat, terminal,
   browser, external logs, database tail).

## 6. First concrete steps
1. Resolve Part B (option 1): make the adb-logcat checkbox truthful; confirm effective vs.
   displayed state agree. Small, self-contained.
2. Host: build the active capture-source list and add the outbound `captureSources` message.
3. Webview: extract `viewer-filter-capture-sources.ts`, render the read-only block, wire the
   click-to-Options action; regenerate both catalogs.
4. l10n keys + English sync (no machine translation).

## Finish Report (2026-07-16)

Both parts shipped with the recommended options (owner approved "go with your picks").

**Part B — checkbox is now authoritative (option 1).**
- New `saropaLogCapture.integrations.adbLogcat.enabled` boolean (default true) is the master
  allow the Options → Integrations checkbox binds to. `checkEnabled` gates on it, so an explicit
  uncheck truly disables the feed; zero-config Flutter behavior is unchanged (auto-detect still
  runs when enabled). Files: config type + reader, package.json + NLS ×11, providers/adb-logcat.ts.
- adbLogcat became a UI-only merged id like `explainWithAi`: `mergeIntegrationAdaptersForWebview`
  gained an `adbLogcatEnabled` arg (reflects the checkbox from the boolean), and the
  `setIntegrationsAdapters` handler routes the checkbox to `integrations.adbLogcat.enabled` instead
  of the adapters array. `stripUiOnlyIntegrationAdapterIds` intentionally does NOT strip adbLogcat
  (the config READ path still honors an explicit array entry as a non-Dart power-user force).
  Unit tests updated to the 3-arg signature + new adbLogcat cases.

**Part A — "Capture sources" status block (session/config-derived; the 5 streaming sources).**
- Host helper `src/modules/integrations/capture-source-states.ts` builds the log-relevant source
  list (adb Logcat, Terminal, Browser, App/File Logs, Database) with on/off from config.
- New outbound `captureSources` message pushed at viewer load (`log-viewer-provider-setup.ts`) and
  on any `integrations.*` change (`activation-listeners.ts`); catalog regenerated.
- Webview: `viewer-filter-capture-sources.ts` renders the read-only rows (built via textContent);
  a row click opens Options → Integrations (in-page `openOptionsPanel` + `openIntegrationsView`,
  so no new incoming message). HTML container in the Log Sources tab, CSS in
  `viewer-styles-filter-drawer.ts`, message case in `viewer-script-messages.ts`, l10n keys for the
  heading (host `t()`) and On/Off (webview `vt()`).

Refresh cadence is config-derived (open question 2): the block shows the CONFIGURED on/off, not a
per-session runtime probe. Deferred follow-ups: runtime "streaming now / device attached" state,
live device reconnect refresh, and a possible tri-state (auto/on/off) for adbLogcat if forcing on
a non-Dart session from the UI is ever requested.

Verification: full `npm run compile` green (check-types, lint, all catalog verifies, NLS parity +
coverage, l10n-keys, dist-size), production bundle builds, adapter-constants unit suite passes.
