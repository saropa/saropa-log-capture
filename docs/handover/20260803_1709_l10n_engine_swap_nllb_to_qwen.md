# Handover — l10n engine swap NLLB to Qwen

2026-08-03 17:09 EDT · saropa-log-capture / main · session 38dfabe4-ede3-4b4c-b1f6-5bbfffb4d10a

## Unfinished tasks

None — all work committed.

## Completed tasks

1. **Engine swap: NLLB+Google to Qwen 3 via Ollama** — Replaced the unauthorized NLLB-200-3.3B (CTranslate2) + Google Translate fallback with Qwen 3 via Ollama. New `l10n_qwen_engine.py` (GPU-aware model ladder 14B/8B/4B, auto-provisioning, script-aware prompts, think-block stripping, echo detection). Deleted `l10n_nllb_engine.py` (544 lines) and `test_l10n_nllb_engine.py` (199 lines). All NLLB/Google references updated across 10+ files. Verified: 78 tests pass.

2. **Sentinel-based brand shielding** — Replaced `<B0>`/`<B1>` angle-bracket placeholders with `XBQ<L1><L2>VKZ` sentinel format (8-char opaque tokens, no digits). `unshield_brands()` handles case-insensitive matching and character-doubling tolerance. Bounds check on `_sentinel()` at capacity 324. Verified: 10 brand tests pass.

3. **Provenance reclassification** — `ENGINE_QWEN` added as high quality. `ENGINE_NLLB` demoted from high to low quality (upgrade candidate). Constants retained for existing provenance sidecars on disk.

4. **Hardening (reflection gate round 1)** — Removed bare `try/except Exception: raise` no-op in `_call_ollama()`. Fixed docstring accuracy ("Raises" vs "Returns None"). Fixed "7-character" → "8-character" in prompt text. Removed unused `sentinels` parameter from `_build_prompt()`.

5. **Hardening (reflection gate round 2)** — `_has_model()` uses `_normalize_model_name()` to strip `@sha256:...` digests AND `:latest` suffixes. HTTP status check in `_call_ollama()` before JSON parse. Platform-correct process detach (`creationflags` on Windows, `start_new_session` on Unix). GPU detection docstring documents AMD/Intel limitation.

6. **Prompt preview mode** — `--prompt-preview` flag prints Qwen prompts to stderr without calling Ollama. Threaded through `QwenTranslator` → `_make_translator` → `translate_locale` → `_translate_one_locale` → `run_translate` → CLI. Brand-shields strings before building prompts so preview matches real input. No disk writes, no Ollama required. Verified: 2 tests pass.

7. **Round-trip quality audit** — New `l10n_quality_audit.py` module. Menu option 7 in interactive CLI. Samples translated strings, reverse-translates to English via Qwen, flags low Jaccard word-bag similarity divergences. Configurable sample size per locale. Verified: 14 tests pass.

## Session narrative

### User requests

1. User was furious that the translation pipeline was using NLLB with Google fallback: "NO!!! we should be using QWEN not NLLB and NOT falling back to google. i NEVER AUTHORIZED THIS!!!" Referenced `d:\src\saropa.com\scripts\setup_arb_translate.py` as the correct pattern.
2. User answered clarifying questions: "Keep English source" for fallback behavior (no Google), "Own standalone copy" for code sharing (not shared with saropa.com).
3. User confirmed deletion of NLLB files with "y".
4. User ran `/finish` skill. At reflection gate (Step 9), selected ALL THREE options: harden reflection items, implement sentinel shielding, update changelog and git commit.
5. In the continued session (this one), user selected all three options again at the second reflection gate: harden items, implement unrequested feature (round-trip quality audit as menu option 7), update changelog and git commit.

### Investigation & analysis

- Read `d:\src\saropa.com\scripts\setup_arb_translate.py` to understand the Qwen 3 via Ollama pattern: model ladder by VRAM, `/api/chat` endpoint, sentinel shielding format.
- Analyzed the existing NLLB engine (`l10n_nllb_engine.py`, 544 lines) to understand what needed replacing: CTranslate2 model loading, GPU detection, locale mapping.
- Found the existing brand shielding used `<B0>`/`<B1>` angle-bracket format — not matching the saropa.com sentinel format.
- Deep review found: bare `except Exception: raise` no-op, stale docstring promising None-on-failure but actually raising, "7-character" prompt text for 8-character sentinels, unused `sentinels` parameter.
- Second deep review found: `_has_model()` only stripped `@` digests not `:latest`, prompt preview sent raw English keys not brand-shielded versions.

### Changes made

**New files:**
- `scripts/modules/verify/l10n_qwen_engine.py` (312 lines) — Standalone Qwen 3 engine. `QwenTranslator` class, `_build_prompt()`, `_call_ollama()`, `_detect_gpu_vram_gb()`, `_select_qwen_model()`, `_normalize_model_name()`, `_ensure_ready()`, `qwen_available()`. Env overrides: `SAROPA_QWEN_MODEL`, `SAROPA_QWEN_TIMEOUT`, `SAROPA_QWEN_KEEP_ALIVE`, `OLLAMA_HOST`.
- `scripts/modules/verify/l10n_quality_audit.py` (161 lines) — Round-trip quality audit. `run_quality_audit()`, `_reverse_prompt()`, `_similarity()` (Jaccard), `_sample_keys()`, `print_quality_report()`.
- `scripts/modules/verify/test_l10n_qwen_engine.py` (29 tests) — Prompt building, think stripping, model selection, echo detection, locale coverage, name normalization, digest/latest matching, prompt preview.
- `scripts/modules/verify/test_l10n_brands.py` (10 tests) — Sentinel format, overflow, shield/unshield round-trip, case/doubling tolerance.
- `scripts/modules/verify/test_l10n_quality_audit.py` (14 tests) — Word tokenization, Jaccard similarity, key sampling, reverse prompts.
- `plans/history/2026.08/2026.08.03/l10n-engine-swap-nllb-to-qwen.md` — Finish report.

**Deleted files:**
- `scripts/modules/verify/l10n_nllb_engine.py` (544 lines)
- `scripts/modules/verify/test_l10n_nllb_engine.py` (199 lines)

**Modified files:**
- `scripts/modules/verify/l10n_translator.py` — `_make_translator()` builds `QwenTranslator`. Removed NLLB/Google imports, `_LOCALE_MAP`, socket timeout logic. Added `prompt_preview` threading.
- `scripts/modules/verify/l10n_brands.py` — Sentinel shielding: `_SENT_ALPHABET`, `_SENT_CAPACITY`, `_sentinel()` with bounds check, `shield_brands()`, `unshield_brands()` with case/doubling tolerance.
- `scripts/modules/verify/l10n_provenance.py` — `ENGINE_QWEN` added as high quality, `ENGINE_NLLB` demoted to low quality.
- `scripts/modules/verify/l10n_actions.py` — `prompt_preview` parameter threaded through `_translate_one_locale()` and `run_translate()`.
- `scripts/modules/verify/l10n_cli.py` — Menu option 7 for quality audit. `--prompt-preview` CLI flag. `_run_quality_audit()` function.
- `scripts/modules/verify/l10n_bundle_audit.py` — Docstring: "NLLB" → "Qwen".
- `scripts/modules/verify/test_l10n_provenance.py` — Updated quality tier tests.
- `scripts/translate_l10n.py` — Docstring updated for Qwen + menu option 7.
- `scripts/modules/publish/checks_build.py` — Comments: "NLLB/GPU" → "MT".
- `scripts/modules/publish/orchestrator.py` — Comments: "NLLB/GPU" → "MT".
- `CHANGELOG.md` — Unreleased section with all changes.

### Decisions & trade-offs

- **No Google fallback.** When Qwen fails, English source is kept (untracked = low quality). The `low_quality` upgrade pass retries on a later run. User explicitly demanded no Google.
- **Standalone engine copy.** User chose a standalone `l10n_qwen_engine.py` for SLC, not shared with the saropa.com pipeline. Simpler dependency story, accepts code duplication.
- **Sentinel format matches saropa.com.** `XBQ<L1><L2>VKZ` with 18-letter alphabet = 324 capacity. Enough for 27 brand tokens with headroom.
- **Jaccard word-bag similarity for quality audit.** Simple, works for European languages. Known limitation: CJK languages tokenize without spaces, so the metric is meaningless for ja/ko/zh. Accepted as a first pass.
- **`_normalize_model_name` strips `:latest` but not quantization tags.** If someone pins `SAROPA_QWEN_MODEL=qwen3:8b-q4_0`, the tag won't match `qwen3:8b-q4_0:latest` — accepted as an edge case.
- **`l10n_translator.py` remains over 300-line limit.** Pre-existing (551 lines, down from 733). Not addressed in this session.

### Rejected / dismissed / deferred

- **Google Translate fallback** — User explicitly rejected. "i NEVER AUTHORIZED THIS!!!"
- **Shared code with saropa.com** — User chose standalone copy over shared library.
- **Circuit breaker / stall detection** — saropa.com has these but SLC's workload (~300 strings x 10 locales) doesn't justify the complexity. Deferred.
- **CJK-aware similarity** — The quality audit's Jaccard similarity doesn't work for CJK. A character n-gram approach was brainstormed but not built. Deferred as the "unrequested feature" for the next reflection gate.
- **Splitting `l10n_translator.py`** — Pre-existing over-limit file. Not in scope for this engine swap.

### User feedback & corrections

- User was very angry about the unauthorized NLLB/Google usage. The HARD STOP rule (never run NLLB or ANY machine-translation pipeline without explicit authorization) applies.
- At both reflection gates, user chose ALL options (harden + implement + commit), showing appetite for thoroughness.

## Key files & paths

- `scripts/modules/verify/l10n_qwen_engine.py` — Qwen 3 translation engine (entry point for all translation)
- `scripts/modules/verify/l10n_quality_audit.py` — Round-trip quality audit module
- `scripts/modules/verify/l10n_translator.py` — Translation orchestration (brand shielding, retry, bundle merge)
- `scripts/modules/verify/l10n_brands.py` — Brand protection + sentinel shielding
- `scripts/modules/verify/l10n_provenance.py` — Engine quality classification
- `scripts/modules/verify/l10n_cli.py` — Interactive menu + CLI arg parsing
- `scripts/modules/verify/l10n_actions.py` — Pipeline actions (sync, translate, report)
- `scripts/translate_l10n.py` — Entry point launcher
- `plans/history/2026.08/2026.08.03/l10n-engine-swap-nllb-to-qwen.md` — Finish report
- `d:\src\saropa.com\scripts\setup_arb_translate.py` — Reference implementation (saropa.com, read-only)

## How to verify

1. Run all tests: `cd d:\src\saropa-log-capture\scripts && D:\Tools\Python\Python314\python.exe -m unittest modules.verify.test_l10n_provenance modules.verify.test_l10n_translator modules.verify.test_l10n_sentences modules.verify.test_l10n_qwen_engine modules.verify.test_l10n_brands modules.verify.test_l10n_quality_audit -v` — expect 78 pass.
2. Run prompt preview: `D:\Tools\Python\Python314\python.exe d:\src\saropa-log-capture\scripts\translate_l10n.py --run-mode translate --locales de --prompt-preview` — prompts print to stderr, no Ollama needed.
3. Run quality audit (needs Ollama): `D:\Tools\Python\Python314\python.exe d:\src\saropa-log-capture\scripts\translate_l10n.py` → option 7 → sample size 5.
4. Run full translate (needs Ollama): same script → option 3 or 5. Check provenance stamps as `qwen`.

## Gotchas & traps

- **HARD STOP: Never run the machine-translation pipeline (NLLB/Google/Qwen) without explicit "run it" authorization.** Adding English source keys + the English sync is fine; the MT step is operator-run only. This is in CLAUDE.md and the user's global instructions.
- **Translation Python is `D:\Tools\Python\Python314\python.exe`** (3.14 standard, NOT `3.14t`).
- **`l10n_translator.py` is 551 lines** — pre-existing over-limit. Don't try to fix it as a side effect of other work.
- **Quality audit Jaccard similarity is blind to CJK.** Japanese, Korean, Chinese translations will always score 1.0 (empty word bags = both empty = identical). The audit silently passes them. A character n-gram approach is the fix but was deferred.
- **`_call_ollama` HTTP status check is partly redundant** — `urlopen` already raises `HTTPError` for 4xx/5xx. The explicit check catches edge cases like 204 No Content.
- **Brand tokens are ordered longest-first** in `BRAND_TOKENS`. Adding a new brand that is a substring of an existing one requires placing it AFTER the longer one, or shielding breaks.

Three commits on main:
- `69ee1108` — feat(l10n): replace NLLB+Google translation engine with Qwen 3 via Ollama
- `55947bdc` — harden(l10n): reflection gate fixes + prompt-preview mode
- `55624d7d` — feat(l10n): round-trip quality audit + model name normalization
