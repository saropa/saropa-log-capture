# Manual l10n fill — compare-3, related-requests, flow-map, signal-sort, cross-workspace-clear

**Trigger:** During a `scripts/publish.py` release run, Step 9 (Quality Checks) reported
that 24 newly-added English strings were missing from all 10 non-English locale bundles
(`98%` coverage each), and paused at the retry / ignore / abort prompt. The user ran
`/finish` after the gaps were filled by hand. No `bugs/*.md` or active plan describes this
specific backfill — it is the localization tail of several already-shipped features.

The 24 strings come from features committed earlier this cycle: 3-way log comparison
(`feat(compare): 3-way session comparison MVP`), the "View Related Requests" popover
(plan 010), the interactive flow-map lens (plan 056 Stage 2), the signal sort toggle
(plan 052 Fu5), the cross-workspace noise clear command (plan 053 Workstream D), and the
SQL-history pager (DB_18b).

## Finish Report (2026-06-10)

### Scope

(C) Localization **data only** — `l10n/bundle.l10n.<locale>.json` + `l10n/provenance/<locale>.json`
for 10 locales, plus a CHANGELOG entry. No TypeScript, no Dart, no runtime code touched.
The NLLB / machine-translation pipeline was **not** run (hard prohibition); all 24×10
strings are hand translations.

### What changed

- Added the 24 missing English-keyed entries to each of the 10 locale bundles
  (de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw), bringing each bundle to **1590/1590**
  keys (matching the English source bundle).
- Recorded provenance `"manual"` for each new entry in `l10n/provenance/<locale>.json`
  (the project's high-quality tier; never an MT-upgrade candidate).
- The 24 keys:
  `Need at least 3 logs to compare three ways.`, `Select the BASELINE log (A)`,
  `Select run B`, `Select run C`, `Compare 3 Logs · Baseline (1/3)`,
  `Compare 3 Logs · Run B (2/3)`, `Compare 3 Logs · Run C (3/3)`, `Zoom in`, `Zoom out`,
  `Reset view (fit diagram)`, `Center the fault node`,
  `Clear all cross-workspace noise patterns shared on this machine? …`,
  `Cross-workspace noise patterns cleared.`, `By severity`, `By time`, `Sort signals`,
  `Toggle signal order between severity and time`, `View Related Requests`,
  `Open a popover listing HTTP requests related to this line`, `Related Requests ({0})`,
  `No related requests found`, `Copied {0} requests`,
  `Showing {0} of {1} rows — refine your search to narrow.`, `Show {0} more`.

### Method / quality notes

- Bundles are keyed by the **English source string** (VS Code `l10n` convention), so the
  gaps were `missing` (key absent), not `untranslated` (value == English).
- Terminology matched against existing bundle entries for consistency: log → de `Protokoll`
  / fr `journaux` / ru `журналы`; requests → de `Anfragen` / it `richieste`; workspace →
  ko `작업공간` / it `area di lavoro`; severity → de `Schweregrad` / it `gravità`; signal
  noun → ja `信号` / zh-tw `訊號`. The pre-existing **broken** MT for the signal strings
  (de "Kollapssignale", fr "Signaux d'effondrement", ja "コラプスシグナル") was deliberately
  **not** copied.
- `{0}` / `{1}` placeholders and the literal `·` (U+00B7) / `—` (U+2014) characters were
  preserved and verified per string by an automated check in the fill script.
- Writer format matched the project's tooling exactly: bundles `indent=2, ensure_ascii=False`,
  insertion order (new keys appended); provenance `indent=2, ensure_ascii=False, sort_keys=True`.

### Verification

- `python scripts/translate_l10n.py --run-mode audit` (read-only) → every locale **100.0%
  COMPLETE**, 0 missing, 0 untranslated. Provenance shows `manual:24` (ja/ru `manual:25`
  due to a pre-existing manual entry) per locale.
- Test audit: grepped `src/test/` for the changed bundle strings and symbols. The only hit,
  `viewer-related-requests-popover.test.ts`, pins the **symbolic key** `viewer.relatedRequests.empty`
  (webview script wiring) — not locale bundle values. No test pins translated values, so a
  translation-data-only change cannot break the suite. Tests not executed (no behavior delta
  to exercise); audited by inspection.
- Honesty note: these are hand translations marked `manual`, not native-speaker-reviewed.
  Placeholder integrity, special characters, and term consistency are machine-verified
  against existing bundles; linguistic correctness is the author's, and is strictly
  better-sourced than the `nllb` MT that fills the rest of each bundle. The ~1180
  `untracked` entries per locale are pre-existing translations predating provenance
  tracking — unchanged by this work.

### Outstanding

- The publish run was paused at Step 9 when `/finish` was invoked. After these files land,
  choosing **[R]etry audit** in the publish prompt re-runs the audit (now clean) and the
  release continues. The publish script's own `git add -A` commit will pick up the version
  bump (CHANGELOG version heading, package.json/package-lock).
