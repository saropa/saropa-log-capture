# 058 — Expand translation locales (next 15 developer languages)

## Status: Phase 0 shipped · Phases 1–2 not started

## Goal

Grow the shipped UI locale set from **10** to **25** by adding the next 15
languages with the largest developer populations. Two are right-to-left (RTL)
and are split into a separate, gated phase — they need webview bidi work, not
just string translation.

## Current state (verified 2026-09-03)

- **10 locales:** `de es fr it ja ko pt-br ru zh-cn zh-tw` (+ English source).
- **Runtime UI** — `l10n/bundle.l10n.<locale>.json` (**2244 keys**) plus a
  `l10n/provenance/<locale>.json` sidecar. Produced by
  `scripts/translate_l10n.py`. The locale set is discovered by scanning disk
  (`get_translation_locales()`), so a locale exists once its bundle does —
  there is no central registry to edit.
- **Static contributions** — `package.nls.<locale>.json` (command titles,
  setting descriptions), 10 files today. Gated by `npm run verify-nls`, which
  fails CI when a file is missing any `%key%` referenced from `package.json`.
  `verify-nls` checks **key alignment only** — it does not translate.

### Engine: Qwen via Ollama (NLLB is gone)

The NLLB/CTranslate2 path described by earlier revisions of this plan **no
longer exists**. `l10n_nllb_engine.py` has been removed, and
`l10n_translator.py` no longer carries a `_LOCALE_MAP`. The current engine is:

- `scripts/modules/verify/l10n_qwen_engine.py`
- Model ladder, selected by detected GPU VRAM (best → smallest):
  `qwen3:14b` (~9.3 GB) → `qwen3:8b` (~5.2 GB) → `qwen3:4b` (~2.6 GB).
  Non-NVIDIA machines fall through to the 8B default, which is correct on CPU,
  only slower.
- Locale registry: **`_LOCALE_INFO`** — maps a locale to
  `(language name, script constraint or None)`. The script constraint forces
  the model to stay in the target writing system (e.g. `ru` → `"Cyrillic"`,
  `ko` → `"Korean (Hangul)"`).

**There are no FLORES codes.** Adding a locale means adding one `_LOCALE_INFO`
entry, not two map entries in two files.

## The 15 new languages

`_LOCALE_INFO` entries to add. The script constraint is `None` for Latin-script
languages and explicit wherever the model could drift out of the writing system.

| Locale | Language name | Script constraint | Dir | Phase |
|--------|---------------|-------------------|-----|-------|
| `hi` | Hindi | `Devanagari` | LTR | 1 |
| `pl` | Polish | `None` | LTR | 1 |
| `tr` | Turkish | `None` | LTR | 1 |
| `vi` | Vietnamese | `None` | LTR | 1 |
| `id` | Indonesian | `None` | LTR | 1 |
| `uk` | Ukrainian | `Cyrillic` | LTR | 1 |
| `cs` | Czech | `None` | LTR | 1 |
| `nl` | Dutch | `None` | LTR | 1 |
| `bn` | Bengali | `Bengali` | LTR | 1 |
| `hu` | Hungarian | `None` | LTR | 1 |
| `th` | Thai | `Thai` | LTR | 1 |
| `ro` | Romanian | `None` | LTR | 1 |
| `el` | Greek | `Greek` | LTR | 1 |
| `fa` | Persian (Farsi) | `Arabic` | **RTL** | 2 |
| `ar` | Arabic | `Arabic` | **RTL** | 2 |

`tr pl cs hu` are the safest picks — VS Code itself ships in those, so the
audience already expects them.

## Phase 0 — Cancellable, resumable long runs — SHIPPED

Graceful CTRL-C: the orphan-prune and save moved into `translate_locale`'s
`finally`, with `KeyboardInterrupt` caught at the `run_translate` loop, so an
aborted run persists the in-progress locale instead of losing it. Because
already-translated keys are skipped on re-run, cancellation is a pause rather
than a loss.

## Phase 1 — 13 LTR locales — NOT STARTED

1. **Registry (code):** add the 13 LTR entries to `_LOCALE_INFO` in
   `scripts/modules/verify/l10n_qwen_engine.py`. This is the only code change.
2. **Runtime bundles (OPERATOR-RUN ONLY — see the prohibition below):** run
   `scripts/translate_l10n.py` and scope it to the new locales. 13 × 2244 ≈
   **29,000 strings**; all 15 ≈ 33,700.
3. **Static NLS files:** create `package.nls.<locale>.json` for each of the 13.
   **Open question, unchanged and still unanswered:** nothing in `scripts/`
   currently *writes* a `package.nls.<locale>.json` — `verify-nls` only checks
   alignment and `sync-nls-title-keys.js` only aligns keys. Either extend the
   tooling to translate the NLS key set through the same engine, or accept
   hand-translation. **Resolve this before starting Phase 1** — it decides
   whether Phase 1 is one operator run or thirteen manual files.
4. **Gates:** `npm run verify-nls`, `npm run verify:nls-coverage`,
   `npm run compile`, and the `translate_l10n.py` audit all clean.

## Phase 2 — 2 RTL locales (`fa`, `ar`) — GATED, NOT STARTED

RTL is not a drop-in. VS Code's own chrome handles RTL, but the **webview log
viewer** needs bidi work first: `dir="rtl"`, CSS logical properties
(`margin`/`padding-inline`, `start`/`end` instead of `left`/`right`), mirrored
chrome (gutters, severity bar, toolbars), and proof that the virtualized row
layout and column grid survive.

Translate the strings so the data exists, but keep `fa`/`ar` flagged as
not-yet-shipped quality until the webview is bidi-clean. The bidi work is its
own scoped plan and blocks this phase.

## Hard constraint — the MT pipeline is operator-run only

**Never run the machine-translation pipeline unattended, from a build, or at
publish.** Adding English source keys and running the English sync is fine; the
translation step is launched by the operator, deliberately, for one specific
run. This is a standing project rule, not a phase-scoped one.

## Risks / considerations

- **Bundle size:** 15 × 2244-key JSON bundles ship as `l10n/*.json`, separate
  from `dist/extension.js` — `verify:dist-size` does **not** catch them.
  Measure the `.vsix` after Phase 1; do not raise any ceiling silently.
- **Quality is unverified until reviewed.** Coverage % is a floor (strings
  present), not a ceiling (strings correct). Never call a locale "done" on
  coverage alone — only on native review or an explicit MT-quality label.
- **Provenance:** fresh locales come out stamped with the Qwen model that
  produced them. No identity backfill needed.
- **No registry edit for the bundle set:** locales are disk-discovered. Do not
  invent a central list. (`_LOCALE_INFO` is the *engine's* registry — different
  thing, and it does need the new entries.)

## Out of scope

- Running the translation job (operator-launched, per the constraint above).
- Webview RTL implementation — its own plan; Phase 2 depends on it.
