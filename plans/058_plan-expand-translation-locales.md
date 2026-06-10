# 058 — Expand translation locales (next 15 developer languages)

## Status: Open

<!-- Status: Open → In progress → Done -->

## Goal

Grow the shipped UI locale set from the current **10** to **25** by adding the
next 15 languages with the largest developer populations, using the now-working
offline NLLB-200-3.3B GPU path. Two of the 15 are right-to-left (RTL) and are
split into a separate, gated phase because they need webview bidi work, not just
string translation.

## Current state (baseline)

- **10 locales:** `de es fr it ja ko pt-br ru zh-cn zh-tw` (+ English source).
- **Two localization layers, both must be filled per locale:**
  1. **Runtime UI** — `l10n/bundle.l10n.<locale>.json` (~1558 keys) + a
     `l10n/provenance/<locale>.json` sidecar. Produced by
     `scripts/translate_l10n.py`. Locale set is discovered by scanning disk
     (`get_translation_locales()`), so a locale "exists" once its bundle does —
     no central registry to edit.
  2. **Static contributions** — `package.nls.<locale>.json` (command titles,
     setting descriptions). Gated by `npm run verify-nls`, which fails CI if a
     `package.nls.*.json` is missing any `%key%` referenced from `package.json`.
     `verify-nls` only checks **key alignment**; it does NOT translate. A new
     locale's NLS file must contain every key, translated.
- GPU path: fixed in this branch — `nvidia-cublas-cu12` DLL dir is now registered
  so NLLB runs on CUDA instead of silently falling to CPU.

## The 15 new languages

Ordered by developer population / dev-tooling localization norms. FLORES code is
for `_FLORES_MAP` (NLLB); deep-translator code is for `_LOCALE_MAP` (Google
fallback). Both keyed by the VS Code bundle locale code.

| Locale | Language | FLORES (NLLB) | Google code | Dir | Phase |
|--------|----------|---------------|-------------|-----|-------|
| `hi`    | Hindi               | `hin_Deva` | `hi` | LTR | 1 |
| `pl`    | Polish              | `pol_Latn` | `pl` | LTR | 1 |
| `tr`    | Turkish             | `tur_Latn` | `tr` | LTR | 1 |
| `vi`    | Vietnamese          | `vie_Latn` | `vi` | LTR | 1 |
| `id`    | Indonesian          | `ind_Latn` | `id` | LTR | 1 |
| `uk`    | Ukrainian           | `ukr_Cyrl` | `uk` | LTR | 1 |
| `cs`    | Czech               | `ces_Latn` | `cs` | LTR | 1 |
| `nl`    | Dutch               | `nld_Latn` | `nl` | LTR | 1 |
| `bn`    | Bengali             | `ben_Beng` | `bn` | LTR | 1 |
| `hu`    | Hungarian           | `hun_Latn` | `hu` | LTR | 1 |
| `th`    | Thai                | `tha_Thai` | `th` | LTR | 1 |
| `ro`    | Romanian            | `ron_Latn` | `ro` | LTR | 1 |
| `el`    | Greek               | `ell_Grek` | `el` | LTR | 1 |
| `fa`    | Persian (Farsi)     | `pes_Arab` | `fa` | **RTL** | 2 |
| `ar`    | Arabic              | `arb_Arab` | `ar` | **RTL** | 2 |

`tr pl cs hu` are the safest picks — VS Code itself ships in those, so its
audience already expects them.

## Phase 0 — Make long runs cancellable and resumable (PREREQUISITE)

Adding 15 locales means a full `gaps` run translates 15 × 1558 ≈ 23,370 strings.
On GPU this is practical; on CPU it is the 20-hour run the operator keeps having
to abort. Today a CTRL-C mid-locale loses that locale's in-progress work, because
`translate_locale` saves the bundle only after its loop completes.

- **Graceful CTRL-C:** persist the bundle + provenance for the in-progress locale
  on `KeyboardInterrupt`, then stop the whole run with a clean message (no
  traceback). Implemented by moving the orphan-prune + save into
  `translate_locale`'s `finally`, and catching `KeyboardInterrupt` at the
  `run_translate` loop. Because already-translated keys are kept (`gaps` skips
  `value != English`; `low_quality` skips `nllb`-provenance keys), a re-run
  resumes where it stopped — cancellation becomes a pause, not a loss.
- **Optional follow-up (not in scope unless asked):** periodic mid-locale save
  every N strings so even a hard kill / power loss loses ≤ N strings. The
  graceful path above covers operator CTRL-C, which is the stated need.

**This phase is implemented in the same change as this plan** (it is the only
part that does not require launching a translation run).

## Phase 1 — 13 LTR locales

1. **Engine maps (code):**
   - Add the 13 LTR entries to `_FLORES_MAP` in
     `scripts/modules/verify/l10n_nllb_engine.py`.
   - Add the 13 LTR entries to `_LOCALE_MAP` in
     `scripts/modules/verify/l10n_translator.py`.
2. **Runtime bundles (operator-run translation):** run `translate_l10n.py`,
   choose **option 3 (translate gaps — all locales)** or scope to the new
   locales. NLLB on GPU produces high-quality, provenance-stamped output.
   Verify per-locale coverage in the audit table (target 100% minus brand /
   identity strings).
3. **Static NLS strings:** create `package.nls.<locale>.json` for each of the 13.
   Open item: confirm how the existing 10 NLS files were produced (no script in
   `scripts/` currently *writes* `package.nls.<locale>.json` — `verify-nls` only
   checks alignment, `sync-nls-title-keys.js` aligns keys). Either extend the
   tooling to translate the NLS key set, or generate the files from the same
   engine. Must pass `npm run verify-nls`.
4. **Gates:** `npm run verify-nls`, `npm run compile`, and the `translate_l10n.py`
   audit all clean.

## Phase 2 — 2 RTL locales (`fa`, `ar`) — gated

RTL is not a drop-in. The VS Code command-palette / settings UI handles its own
RTL, but the **webview log viewer** needs bidi support before `fa`/`ar` look
right: `dir="rtl"`, CSS logical properties (margin/padding-inline, `start`/`end`
instead of `left`/`right`), mirrored chrome (gutters, severity bar, toolbars),
and verification that the virtualized row layout and column grid don't break.

- Translate the strings (same engine maps + run as Phase 1) so the data exists.
- Do the webview bidi work as its own scoped plan before enabling RTL display.
- Until the webview is bidi-clean, keep `fa`/`ar` bundles present but treat them
  as not-yet-shipped quality.

## Risks / considerations

- **Bundle size:** 15 × ~1558-string JSON bundles add to the packaged `.vsix`
  (these ship as `l10n/*.json`, separate from `dist/extension.js`, so
  `verify:dist-size` does not catch them). Estimate and sanity-check the `.vsix`
  size after Phase 1; raise no ceiling silently.
- **Translation quality is unverified until reviewed.** NLLB output is machine
  translation. Coverage % from the audit is a floor (strings present), not a
  quality ceiling (strings correct). Do not describe a locale as "done" on
  coverage alone — only on native/human review or an explicit "MT-quality"
  label.
- **Provenance:** new locales come out `nllb` (high quality in the model). No
  untracked/identity backfill needed for fresh locales.
- **No registry edit needed:** locales are disk-discovered; do not invent a
  central list.

## Out of scope

- Running the translation job (operator launches it; the model load / run is not
  done from this workflow).
- Webview RTL implementation (its own plan; Phase 2 depends on it).
