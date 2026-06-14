# Signal panel — unify string localization on the standalone SignalScriptStrings object

The Signal panel's webview scripts rendered user-facing strings through three different mechanisms: the
panel-standalone `SignalScriptStrings` object (hero and empty-state strings), and two global `vt()`
namespaces — `viewer.signalPanel.*` (suggestion impact, session meta, recurring title, hero counts,
avg/max) and `viewer.signal.*` (the cross-session report section summaries, relative-time labels, and
co-occurrence rows). The split meant the same panel reached into the global `__VT` map for some strings
while carrying others in its own injected object, and it left two hardcoded English labels on the live
performance hero (`Errors:` / `Warnings:`) that only the Markdown export had localized.

## Finish Report (2026-06-14)

### Scope

(B) VS Code extension (TypeScript). A localization-mechanism consolidation in the Signal panel webview
scripts plus the host that builds them. No runtime behavior change — every string renders identically.

### Change

All Signal-panel display strings now flow through the one `SignalScriptStrings` object defined in
`viewer-signal-panel-script.ts`, injected as the `SIGNAL_STRINGS` JSON blob and read by the panel
scripts. A new `fillSignalString(tpl, a0, a1, a2)` helper in `viewer-signal-panel-script-part-a.ts`
performs the panel's own positional `{0}/{1}/{2}` substitution, since the injected object holds plain
strings rather than the substitution-capable `vt()` templates.

Thirty-four fields were folded into `SignalScriptStrings` + `DEFAULT_SIGNAL_STRINGS`, each populated from
a `signal.*` key in `strings-b.ts` via `t()` in `getSignalPanelScript()` (so they remain translatable
through the existing host pipeline): the suggestion-impact and session-meta labels, the recurring-title
and avg/max meta fragments, the hero error/warning count templates, the All-signals / in-log / hot-files
/ environment / related-signals / filter-suggestion section summaries, the relative-time labels, the
co-occurrence row title and meta, and the live "No log open" performance-scope label.

The call sites in `viewer-signal-panel-script-part-{b,c,d}.ts` were rewritten from
`vt('viewer.signal…')` / `vt('viewer.signalPanel…')` to `SIGNAL_STRINGS.*` (via `fillSignalString` for
the placeholder-bearing ones); the two earlier inline `split/join` substitutions (`openRuleTitle`,
`evidenceLineTitle`) were moved onto the same helper for consistency. The now-unused `viewer.signalPanel.*`
and `viewer.signal.*` report/co-occurrence keys were removed from `strings-webview.ts` and
`strings-webview-c.ts`; the error-rate, analysis-progress, and performance keys in `strings-webview-c.ts`
are unrelated and remain.

A hardcoded gap surfaced during the consolidation was closed: the live performance hero rendered its
`Errors:` and `Warnings:` labels in English (only the Markdown export used the localized template). Both
now use `SIGNAL_STRINGS.heroErrors` / `heroWarnings` with the styled count `<span>` substituted into the
`{0}` placeholder, so the count keeps its severity-colored emphasis while the label localizes.

### Why one mechanism

A single panel reaching into both the global `__VT` map and its own injected object is harder to reason
about and audit — a new affordance can be wired either way, and the live-hero gap is the kind of
inconsistency that hides in a split. Routing everything through `SignalScriptStrings` makes the panel
self-contained: its complete string inventory is one typed object, populated in one place
(`getSignalPanelScript()`), with one substitution helper.

### Verification

- `npm run compile` — exit 0 end to end, including `verify:l10n-keys` (2257 keys defined; all referenced
  `t()`/`vt()` keys resolve, none orphaned), `check-types` (the ~60-field interface / defaults / caller
  stay aligned by construction), `lint`, the catalog verifiers, `esbuild`, and `verify:dist-size`
  (4.79 MiB of a 12 MiB ceiling).
- The Signal panel scripts contain zero `vt()` calls and zero hardcoded user-facing strings.
- Existing tests pass unchanged: `signal-panel-row-click` (12), `viewer-webview-l10n` (5); the
  `signal-report-*` suites import none of the changed files. No test pinned a modified string.
- New regression test `signal-panel-string-mechanism.test.ts` (4 cases) pins the single-mechanism
  contract: the helper is present, the scripts read `SIGNAL_STRINGS.*`, no `vt('viewer.signal…')` remains,
  and the folded fields appear in the injected payload.
- English bundle synced (key alignment only); the machine-translation pipeline was not run.

### Relationship to other work

Closes the localization mechanism split for the Signal panel — the surface covered by the codebase
audit's localization-completeness workstream (`plans/104_plan-codebase-audit-2026-06-12.md`, WS-5 / H12).
That plan's remaining localization item is the `{0}`-interpolation cleanup (L13) in non-signal files
(`viewer-error-rate-tab.ts`, `analysis-frame-render.ts`, `signal-report-*.ts`,
`session-comparison-webview-script.ts`), which this task did not touch.

### Files changed

- `src/ui/panels/viewer-signal-panel-script.ts` — 34 fields added to `SignalScriptStrings` +
  `DEFAULT_SIGNAL_STRINGS`.
- `src/ui/panels/viewer-signal-panel.ts` — caller wires the 34 new fields from `t('signal.*')`.
- `src/ui/panels/viewer-signal-panel-script-part-a.ts` — `fillSignalString` helper.
- `src/ui/panels/viewer-signal-panel-script-part-{b,c,d}.ts` — call sites moved to `SIGNAL_STRINGS.*`;
  live-hero labels fixed.
- `src/l10n/strings-b.ts` — 34 `signal.*` source keys added.
- `src/l10n/strings-webview.ts`, `src/l10n/strings-webview-c.ts` — folded keys removed.
- `src/test/ui/signal-panel-string-mechanism.test.ts` — new contract test.

### Outstanding

None for the Signal panel. The unrelated L13 interpolation sites named above remain open under the audit
plan.
