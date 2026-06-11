# Localization (l10n) — Saropa Log Capture

How this extension translates every user-facing string: the two pipelines, the
source-of-truth files, the runtime utilities, the translation toolchain, the
coverage gates, and the exact workflows for adding strings, auditing, and
translating.

> **Hard rule first:** the machine-translation pipeline (NLLB / Google) is **never**
> run unattended and **never** runs at publish time. An unattended NLLB GPU job once
> locked a developer's machine mid-release. Translation is a deliberate, operator-run
> step (`python scripts/translate_l10n.py`). See [Never translate unattended](#never-translate-unattended).

---

## 1. Two independent systems

The extension localizes through **two separate pipelines**. They share neither
storage nor tooling, and a string lives in exactly one of them depending on where
VS Code renders it.

| | **Manifest NLS** | **Runtime l10n** |
|---|---|---|
| Renders | Command palette titles, settings, menus, walkthrough metadata — VS Code **chrome** | The log viewer / webview UI — toolbars, tooltips, panels, dynamic labels |
| Selected by | VS Code itself, from the editor's display language | `vscode.l10n` + `vscode.env.language` at runtime |
| Source of truth | `package.nls.json` (flat `key: value`) | `src/l10n/strings-*.ts` (symbolic key → English) |
| Translated files | `package.nls.<locale>.json` | `l10n/bundle.l10n.<locale>.json` |
| Referenced as | `%key%` inside `package.json` | `t('key')` (host) / `vt('key')` (webview) |
| Key count | 487 | 1608 |
| Translation tool | **none** — hand-edited / `sync-nls-title-keys.js` | `scripts/translate_l10n.py` (NLLB/Google) |
| Coverage today | 22–37% per locale | ~98% per locale |
| Guards | `verify-nls`, `verify:nls-coverage`, activation notice | publish-time audit + `translate_l10n.py` audit |

The asymmetry is deliberate to understand, not aspirational: the **heavy viewer UI
is effectively complete** because it flows through the Python translation pipeline;
the **manifest chrome lags** because it is hand-maintained and has no MT path. A user
whose VS Code is in German gets a fully-German log viewer but largely-English menus.

The locale set is identical across both systems — **10 translated locales plus the
English source**:

```
de  es  fr  it  ja  ko  pt-br  ru  zh-cn  zh-tw      (en = source, always 100%)
```

---

## 2. System A — Manifest NLS (VS Code chrome)

### Files

- `package.nls.json` — English source, flat `{ "command.clear.title": "…" }`.
- `package.nls.<locale>.json` — one per locale, **same keys**, translated values.
- `package.json` — references each string as `%key%` (e.g. `"title": "%command.clear.title%"`).

VS Code reads the `package.nls.<displayLanguage>.json` automatically; the extension
never chooses. There is **no language picker** — gating which language a user "gets"
is not possible here, only which `.json` files ship.

### Maintenance

There is no machine-translation path for the manifest. Strings are translated by
hand. The one helper is:

- [`scripts/modules/fix/sync-nls-title-keys.js`](../../scripts/modules/fix/sync-nls-title-keys.js)
  — copies missing `config.*.title` keys from the English base into every locale
  file (key alignment only; it does not translate).

### Guards

1. **`npm run verify-nls`** ([verify-nls.js](../../scripts/modules/verify/verify-nls.js))
   — asserts **key parity**: every `%key%` in `package.json` exists in every
   `package.nls*.json`, with no orphans. Runs in `npm run compile`. **This proves
   keys exist, not that values are translated** — a key present but holding English
   passes.

2. **`npm run verify:nls-coverage`** ([nls-coverage.mjs](../../scripts/modules/generate/nls-coverage.mjs))
   — measures the gap `verify-nls` is blind to: how many values actually **differ from
   English** per locale. Regenerates [`src/l10n/nls-coverage-data.ts`](../../src/l10n/nls-coverage-data.ts)
   and prints a coverage table. `--check` (wired into `compile`) fails only on
   **staleness** of the generated data, never on low coverage — coverage is reported,
   not gated. Run `npm run generate:nls-coverage` after editing any `package.nls*.json`.

### UX — the honest-coverage notice

Because VS Code auto-selects the locale and the chrome is largely English, the
extension tells the user once, per display language, when their menus are mostly
untranslated.

- [`src/l10n/nls-coverage-notice.ts`](../../src/l10n/nls-coverage-notice.ts) —
  `maybeNotifyPartialNlsCoverage(context)`, called from
  [`extension-activation.ts`](../../src/extension-activation.ts) after the walkthrough.
- Reads `vscode.env.language`, normalizes it to a coverage key (full tag `pt-br` /
  `zh-cn` first, then primary subtag `de` from `de-at`), looks up the audited percent.
- Shows a one-time notice (gated in `globalState` per language) **only** below the
  `NOTICE_THRESHOLD_PCT` (90%). Silent for English, untracked locales, and complete
  locales. The notice names the language and percent and reassures that the viewer
  itself is fully localized.
- The notice string (`msg.nlsPartialCoverage`) is itself a **runtime** string, so it
  appears in the user's language (the runtime pipeline is ~98% complete).

> Policy: **notify, do not gate.** We keep shipping every locale file (VS Code controls
> selection; the viewer is already complete). We do not remove locale files below a
> threshold. The notice is the entire user-facing mechanism.

---

## 3. System B — Runtime l10n (the viewer / webview)

This is the larger system and the one with the full translation toolchain.

### Source of truth: `src/l10n/strings-*.ts`

Every runtime string is declared once, in a `strings-*.ts` registry, as a
`Record<string, string>` mapping a **symbolic key** to its **English text**:

```ts
export const stringsA: Record<string, string> = {
    'msg.errorCopied': 'Error copied to clipboard',
    'viewer.toolbar.search.label': 'Toggle search',
};
```

Registries by surface (all globbed as `strings-*.ts`, so new splits are picked up
automatically — the webview-localization sweep, plan 053):

| File(s) | Surface |
|---|---|
| `strings-a.ts`, `strings-b.ts` | Extension-host strings (commands, messages, dialogs) |
| `strings-viewer.ts` … `strings-viewer-g.ts` | Host-built viewer HTML (toolbar, panel shells) |
| `strings-webview.ts`, `strings-webview-b.ts` | Client-side strings built **inside the iframe** |

Keys are namespaced by surface so collisions are not expected. Files stay under the
[300-line limit](../../.claude/rules/global.md); when one grows, extract a cohesive
slice into the next `strings-*-<letter>.ts`.

### Translation storage: `l10n/`

VS Code's `vscode.l10n.t()` is keyed by the **English string value**, so the bundle
keys are the exact English text, not the symbolic key:

- `l10n/bundle.l10n.json` — English baseline (`{ "Toggle search": "Toggle search" }`).
- `l10n/bundle.l10n.<locale>.json` — translations (`{ "Toggle search": "搜索切换" }`).
- `l10n/provenance/<locale>.json` — sidecar `{ english: engine }` recording which
  engine produced each translation (kept out of the bundle glob). See
  [Quality & provenance](#quality--provenance).
- `package.json` declares `"l10n": "./l10n"` so VS Code loads these at runtime.

### Runtime utilities

Defined in [`src/l10n.ts`](../../src/l10n.ts):

```ts
// Host code: symbolic key → English source string → vscode.l10n.t() translation.
t('viewer.toolbar.search.label')            // "Toggle search" / "搜索切换"
t('msg.bookmarkAdded', String(lineNumber))  // positional {0} substitution
```

- **`t(key, ...args)`** — resolves the symbolic key to its English string from the
  merged `strings` map, then passes it through `vscode.l10n.t()` for translation +
  `{0}`/`{1}` argument substitution. Unknown key → the key itself (fail-soft).
- **`getWebviewL10nMap()`** — resolves **only** the webview keys (`strings-webview*`)
  to their translated templates (placeholders left intact). Keeps the injected blob
  small — host-only strings never reach the page.

### Webview bridge (client-side strings)

The iframe builds many strings client-side (tooltips with live counts, dynamic
labels) where `vscode.l10n.t()` — a host API — cannot run. The bridge in
[`src/ui/provider/viewer-l10n-inject.ts`](../../src/ui/provider/viewer-l10n-inject.ts):

1. `getWebviewL10nScript()` emits, as the **first** webview script:
   ```js
   var __VT = { "Toggle search": "搜索切换", … };   // from getWebviewL10nMap()
   function vt(key) { /* lookup + positional {0} substitution, fail-soft to key */ }
   ```
2. Every later render script calls `vt('key', arg0, arg1)` to get a localized template.

So: **host HTML calls `t()`; client-side render code calls `vt()`.** Adding a webview
string means it must be in a `strings-webview*.ts` file (the only ones loaded into
`__VT`), or `vt()` emits the raw key.

### Data flow (runtime)

```
strings-*.ts  ──glob──►  bundle.l10n.json (English baseline, key = English text)
   (symbolic                    │
    key →                       ├─ translate_l10n.py ─►  bundle.l10n.<locale>.json
    English)                    │                         + provenance/<locale>.json
                                │
host:   t('key')  ─► English ─► vscode.l10n.t() ─► reads bundle.l10n.<lang>.json
webview: vt('key') ◄─ __VT map ◄─ getWebviewL10nMap() ◄─ t() resolves each webview key
```

---

## 4. The translation toolchain

Entry point: [`scripts/translate_l10n.py`](../../scripts/translate_l10n.py) — a thin
launcher (UTF-8 stdout + interactive-vs-CLI dispatch). The pipeline lives in
`scripts/modules/verify/l10n_*.py`.

| Module | Responsibility |
|---|---|
| `l10n_cli.py` | Interactive menu + `--run-mode` arg parsing |
| `l10n_bundle_audit.py` | Data layer: extract source strings, audit, English sync, report + gap export |
| `l10n_translator.py` | Translation engine loop (NLLB → Google), network safeguards, scopes |
| `l10n_nllb_engine.py` | Offline NLLB-200-3.3B engine wrapper |
| `l10n_brands.py` | Brand / acronym / verified-identity shielding |
| `l10n_provenance.py` | Per-key engine provenance + quality model |
| `l10n_audit_display.py` | Console audit table + gap detail |
| `l10n_actions.py` | `run_sync` / `run_translate` / report + export glue |

### The audit (`run_audit`)

Source of truth is `extract_all_source_strings()` (globs `strings-*.ts`). The audit
classifies, per locale:

- **MISSING** — a source string absent from the English bundle (hard CI failure).
- **ORPHAN** — a bundle key with no matching source string (pruned on sync).
- **untranslated** — bundle value still equals English (a real gap) — *unless* it is a
  brand, acronym, symbol-only string, or a per-locale verified cognate.
- **brand-mangled** — translated but a brand token was transliterated/dropped.
- **translated** — everything else; further classified by **engine** via provenance.

### Brand shielding ([l10n_brands.py](../../scripts/modules/verify/l10n_brands.py))

Brand names must appear verbatim in every locale (Google mangles them —
"Saropa Lints" → "Saropa-Fusseln"). Before translation, brand tokens are swapped for
`<B0>`, `<B1>` placeholders, translated, then restored and validated; a translation
that drops a brand is rejected and retried once. Categories:

- **`BRAND_ONLY_STRINGS` / `BRAND_TOKENS`** — forced English in **every** locale
  (e.g. `Saropa Log Capture`, `Crashlytics`, `Docker`, `.gitignore`).
- **`ACRONYM_ONLY_STRINGS`** — `ANR`, `SQL`, `OS`, `DB`, `OK`, `TODO`.
- **`VERIFIED_IDENTICAL`** — **per-locale** cognates a human confirmed (e.g. German
  "Pause", Spanish "Error"). Add an entry **only after verifying** the word is genuinely
  identical in that locale — a wrong entry silences a real gap.

### Quality & provenance ([l10n_provenance.py](../../scripts/modules/verify/l10n_provenance.py))

Each translation records the engine that produced it in `l10n/provenance/<locale>.json`.

- **High quality** (never re-translated): `nllb`, `manual`, `gemini`,
  `translation_memory`, `identity`.
- **Low quality** (upgrade candidates): `google`, `mymemory`, `libretranslate`,
  `lingva`, `argos`, and — critically — **`untracked`** (a translated key with no
  provenance record). Every pre-provenance translation classifies as untracked = low,
  which is exactly what lets the "upgrade low-quality" pass sweep old Google output
  into NLLB.

### Engines ([l10n_translator.py](../../scripts/modules/verify/l10n_translator.py))

- **NLLB-200-3.3B (offline)** — used automatically **only when its model is already
  cached** (higher quality, no rate limits). A machine without it falls back silently
  to Google rather than triggering a 7 GB download. The chosen engine is announced once.
- **Google Translate** (via `deep-translator`) — fallback. Wrapped in network
  safeguards: 8 s socket timeout (the original "lock-up at step 9" was an
  un-timed-out request), 0.2 s throttle, one retry with backoff, and a circuit
  breaker that aborts after 5 consecutive network failures (wholesale rate-limiting).

Bundles are written atomically; a CTRL-C during a long run saves everything
translated so far (the `finally` in `translate_locale`), so a multi-hour run is
resumable — cancellation becomes a pause.

### Scopes

The translate step takes a `scope` that decides which keys it touches:

| Scope | Touches | Used by |
|---|---|---|
| `missing` | only keys **absent** from the bundle | the publish pipeline (never re-sends en-copies) |
| `gaps` | absent keys **and** en-copies (value == English) | the deliberate `translate_l10n.py` run |
| `low_quality` | existing real translations whose provenance is **weak/untracked** | the Google → NLLB upgrade pass |

Existing real translations are never overwritten by a gap fill; a failed low-quality
upgrade keeps the existing value rather than regressing it to English.

---

## 5. Workflows

### 5.1 Add a user-facing **runtime** string (viewer / webview)

1. Add the symbolic key + English text to the right `strings-*.ts` file:
   - host message/dialog → `strings-a.ts` / `strings-b.ts`
   - host-built viewer HTML → `strings-viewer*.ts`
   - **client-side** (built in the iframe) → `strings-webview.ts` / `strings-webview-b.ts`
2. Use it: `t('your.key')` in host code, `vt('your.key', arg0)` in webview render code.
3. Run `python scripts/translate_l10n.py` → choose **Sync English bundle** (option 2) so
   `bundle.l10n.json` gains the new English entry. (This is mechanical key alignment, not
   translation.)
4. The string now ships **in English in every locale** until a deliberate translate
   pass fills it. That is acceptable and expected; do **not** run NLLB to close it as
   part of the feature change.
5. Update [CHANGELOG.md](../../CHANGELOG.md).

> Adding the source-language key is normal write-time work — never a blocker, never a
> reason to drop UI. Translating it is a separate, scheduled, operator-run step.

### 5.2 Add a **manifest** string (command title, setting, menu)

1. Add `%key%` in `package.json` and the English value to `package.nls.json`.
2. Add the **same key** to **every** `package.nls.<locale>.json` (value may be English
   for now). `npm run verify-nls` fails the build if any locale is missing the key.
   For `config.*.title` keys, `node scripts/modules/fix/sync-nls-title-keys.js` copies
   them across.
3. Run `npm run generate:nls-coverage` to refresh the coverage data.
4. Update the command/contributes reference if needed (`npm run generate:list-commands`).

### 5.3 Audit coverage (read-only)

```
python scripts/translate_l10n.py --run-mode audit
```

Prints the per-locale coverage table and writes a timestamped report to
`reports/<YYYY.MM>/<YYYY.MM.DD>/<…>_l10n_audit.json`, plus a `_l10n_gaps.json`
worklist when gaps exist. Interactive (`python scripts/translate_l10n.py`, no args)
shows the same audit then a menu.

### 5.4 Translate (deliberate, operator-run)

Interactive menu options:

- **3 / 4** — Sync + translate **gaps** (all locales / specific).
- **5 / 6** — Sync + **upgrade low-quality** → NLLB (all / specific).

Non-interactive:

```
python scripts/translate_l10n.py --run-mode translate --locales de,fr --scope gaps
python scripts/translate_l10n.py --run-mode translate --scope low_quality   # all locales
python scripts/translate_l10n.py --run-mode translate --dry-run             # preview only
```

Manual / external translation: the audit's `_l10n_gaps.json` export has an empty
`translation` field per entry; fill it and reimport
(`python scripts/translate_l10n.py --import <file>`), recorded as `manual` provenance.

> Use full absolute interpreter + script paths when handing a command to a user, e.g.
> `& D:/tools/Python/Python314/python.exe D:/src/saropa-log-capture/scripts/translate_l10n.py`.

### 5.5 Publish-time behavior

Step 9 of [`scripts/publish.py`](../../scripts/publish.py) ("l10n bundle alignment",
in [checks_build.py](../../scripts/modules/publish/checks_build.py) →
`check_l10n_bundles()`):

- **Syncs the English bundle only** (key alignment) and **reports** gaps + exports a
  worklist. It **never translates.**
- Gaps are **non-fatal**: the orchestrator prompts retry / ignore / abort (default
  retry; non-interactive CI ignores). Only a failed English-sync write is a hard error.

---

## 6. Coverage & quality gates (summary)

| Gate | System | What it proves | When |
|---|---|---|---|
| `npm run verify-nls` | Manifest | key parity (no missing/orphan `%key%`) | `compile`, CI |
| `npm run verify:nls-coverage` | Manifest | `nls-coverage-data.ts` is current | `compile`, CI |
| activation notice | Manifest | tells the user once when chrome < 90% | runtime |
| `translate_l10n.py --run-mode audit` | Runtime | per-locale coverage + quality split | manual / publish Step 9 |
| publish Step 9 | Runtime | English bundle aligned; gaps reported | publish |

**Key-parity and value-coverage are different claims.** `verify-nls` passing ("487
keys aligned") does **not** mean the manifest is translated — `verify:nls-coverage`
measures that, separately. Never report one as if it were the other.

---

## 7. Never translate unattended

This is a hard prohibition, not a preference:

- **Never** run NLLB, a Google/`deep-translator` pass, or any `--scope`/`--run-mode
  translate` job without an explicit, in-the-moment instruction from the operator that
  names that specific run.
- **The publish pipeline never translates.** Approving a feature, a string, or "fix the
  locales" authorizes code changes only — never a translation run.
- Adding **source-language** keys (English) and running the **English sync** is *not*
  translation and is always fine. Only the MT step is gated.

Reason: an unattended NLLB GPU job locked a developer's machine mid-release and caused
repeated session timeouts. When translation looks necessary, **stop, state the exact
command, and wait.**

---

## 8. Adding a new locale

1. Manifest: add `package.nls.<locale>.json` with all 487 keys (English to start);
   `npm run verify-nls` enforces completeness.
2. Runtime: create `l10n/bundle.l10n.<locale>.json` (even `{}` is fine — the audit and
   translator discover it from disk via `get_translation_locales()`), and add the
   locale → ISO mapping in `_LOCALE_MAP` in
   [l10n_translator.py](../../scripts/modules/verify/l10n_translator.py) if its code
   differs from the bundle tag (e.g. `pt-br` → `pt`).
3. Run an audit, then a deliberate translate pass for the new locale.
4. `npm run generate:nls-coverage` and update the README locale count + badge.

> Corrections from users go to [language@saropa.com](mailto:language@saropa.com)
> (see the README **Translations** section).

---

## 9. Quick reference

```
# Audit (read-only) — coverage + quality, writes a report
python scripts/translate_l10n.py --run-mode audit

# Sync English baseline only (after adding/changing source strings) — no translation
python scripts/translate_l10n.py --run-mode sync     # or menu option 2

# Translate gaps / upgrade weak output (deliberate, operator-run)
python scripts/translate_l10n.py --run-mode translate --locales de,fr --scope gaps
python scripts/translate_l10n.py --run-mode translate --scope low_quality

# Manifest coverage (value-translation, not just key parity)
npm run generate:nls-coverage      # rewrite data + print table
npm run verify:nls-coverage        # CI: fail only if data file is stale

# Manifest key parity
npm run verify-nls
```

| Concept | Lives in |
|---|---|
| Runtime source strings | `src/l10n/strings-*.ts` |
| Runtime translations | `l10n/bundle.l10n.<locale>.json` |
| Runtime provenance | `l10n/provenance/<locale>.json` |
| Runtime lookup | `t()` / `vt()` — `src/l10n.ts`, `viewer-l10n-inject.ts` |
| Manifest source | `package.nls.json` |
| Manifest translations | `package.nls.<locale>.json` |
| Manifest coverage data | `src/l10n/nls-coverage-data.ts` |
| Coverage notice | `src/l10n/nls-coverage-notice.ts` |
| Translation toolchain | `scripts/translate_l10n.py` + `scripts/modules/verify/l10n_*.py` |
| Publish l10n step | `scripts/modules/publish/checks_build.py` |
