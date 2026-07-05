# Signals panel formatting

The Signals sidebar rendered as a visually inconsistent list: severity rows jogged their text right, labels were truncated at a fixed character count well short of the panel width, clickable and inert rows were indistinguishable, an all-zero "workspace pulse" strip showed vacuous data, and opening a cross-session signal gave no feedback during the (sometimes slow) session load. This change reformats the panel for visual consistency and adds the missing affordances, touching CSS-in-TS styles, the webview panel scripts, and the host pulse-composition module.

## Finish Report (2026-07-05)

### Scope
VS Code extension (TypeScript). Webview CSS-in-TS + concatenated webview panel scripts + one pure host module and its unit test. No Flutter/Dart. No new dependencies.

### Defects addressed
1. **Inconsistent indenting.** Severity accents were painted with `border-left: 3px`, which widened only the critical/high rows and shifted their label text right relative to plain rows. Section subtitles and empty states used a `.signal-margin-emoji` span that had no CSS rule, so emoji spacing was undefined.
2. **Labels truncated before the real width.** The "All signals" and "Signals in this log" renderers sliced labels to 60 and 50 characters respectively (`s.label.slice(0, 57) + '...'`), cutting text off regardless of the available column width and stranding an ellipsis mid-column on a wide panel.
3. **Clickable vs inert rows were indistinguishable.** Every trend row opens a session and some in-log rows jump or expand detail, but nothing marked which rows were interactive; users could only discover it by clicking.
4. **Vacuous "workspace pulse" strip.** `computeWorkspacePulse` returned a pulse whenever a fix-rate number was present, so a `velocityPct` of 0 with no improving/worsening/stable counts rendered an all-zero "▲ 0 · ▼ 0 · ● 0 · Fixed 0%" strip that carried no information.
5. **No feedback on slow signal open.** Clicking a cross-session signal posts `openSessionForSignalType`; the host then resolves and loads that session's log file (the slow step) before echoing `scrollToSignal`. During that window the click looked dead.

### Changes
- **`viewer-styles-signal-list.ts`** — severity accents switched from `border-left` to `box-shadow: inset 3px 0` so the accent occupies zero layout width and no row shifts. Added a shared indent rail (`padding-left: var(--space-2)` on rows, narrative subtitles, and empty states) with a fixed-width `.signal-margin-emoji` cell so every icon/emoji starts on one left edge. Added real-width ellipsis (`overflow/text-overflow/white-space`) to the label cell, relying on the `min-width: 0` already set in `viewer-styles-signal-sections.ts`. Added a trailing `›` chevron (`::after`) to clickable rows only (all trend rows; jumpable/detail-toggle in-log rows), rotating on detail expansion; inert rows get none. Added a row shimmer keyframe and a slim indeterminate loading bar style.
- **`viewer-signal-panel.ts`** — added the `#signal-loading-bar` element between the panel header and the scroll region (`flex-shrink: 0`).
- **`viewer-signal-panel-script-part-a.ts`** — added `signalSetOpening(row)` / `signalClearOpening()` plus a safety-timeout var. `signalSetOpening` shimmers the clicked row and shows the loading bar; the 6 s timeout guarantees the shimmer clears even if the host resolves no session and posts nothing.
- **`viewer-signal-panel-script-part-b.ts`** — removed the JS character caps; labels now pass through in full and the CSS ellipsis governs truncation. Full label text was already carried on `data-label`/`title`, so no data path changed.
- **`viewer-signal-panel-script-part-c.ts`** — the panel's own message listener clears the open-in-progress state on `scrollToSignal` (the host's completion echo). The main viewer message bus is a separate listener and still performs the scroll.
- **`viewer-signal-panel-script-part-d.ts`** — calls `signalSetOpening(row)` immediately before posting `openSessionForSignalType`, so the click is acknowledged before the slow host round-trip.
- **`workspace-pulse.ts`** — `computeWorkspacePulse` now returns `undefined` (strip hidden) when there are no improving/worsening/stable counts and the fix-rate is 0% or absent. A positive fix-rate still shows on its own; a 0% fix-rate still shows when there are recurring issues it measures against.

### Verification
- `npm run check-types` — clean.
- `npm run compile` — succeeds; all verify gates pass (nls parity + coverage, webview incoming/outbound catalogs, list-commands, l10n-keys, dist-size 4.97 MiB).
- `npx eslint` on all touched files — zero warnings (all files within the 300-line limit).
- `node --test out/test/modules/misc/workspace-pulse.test.js` — 8/8 pass, including two new cases: a bare 0% fix-rate with no tracked issues stays hidden; a 0% fix-rate with stable issues still shows.
- `signal-panel-row-click.test.ts` (Mocha, Extension Host) audited by inspection: it asserts the `openSessionForSignalType` payload shape, which is unchanged (the new `signalSetOpening` call sits before the postMessage). Not executed in this environment.

### Out-of-scope items noted, not changed
- Pre-existing dead CSS rule `.signal-signal-trend-row` (doubled `signal-` prefix) in `viewer-styles-signal-list.ts` matches no rendered element. Predates this work; left untouched.
- The per-row error/warning triage actions (Close / Mute) — the actual "resolve a signal" mechanism the fix-rate measures — remain hover-revealed by existing deliberate design. Making them always-visible is a product decision left open.

### Commit note
These changes were committed as part of 05a6dcaa (bundled with concurrent icon-bar work in the same working tree).
