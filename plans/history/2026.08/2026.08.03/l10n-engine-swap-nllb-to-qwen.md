# l10n Translation Engine Swap: NLLB → Qwen 3 via Ollama

The l10n translation pipeline used the offline NLLB-200-3.3B model (CTranslate2) with a Google Translate fallback via `deep-translator`. Neither engine was authorized for this project; the standard is Qwen 3 via Ollama, matching the saropa.com website pipeline.

## Finish Report (2026-08-03)

### What changed

**New file: `scripts/modules/verify/l10n_qwen_engine.py`** — standalone Qwen 3 translation engine. Calls the local Ollama daemon's `/api/chat` endpoint with a GPU-selected model from the Qwen 3 ladder (14B / 8B / 4B based on VRAM). Includes:
- GPU detection via `nvidia-smi` for automatic model selection
- Auto-provisioning: starts the Ollama daemon and pulls the model on first use
- Script-aware prompts for CJK/Cyrillic targets (forces correct writing system)
- `<think>` block stripping for models that ignore `think: false`
- Echo detection (rejects translations identical to source)

**Engine swap in `l10n_translator.py`:**
- `_make_translator()` now constructs a `QwenTranslator` instead of trying `NllbTranslator` then `GoogleTranslator`
- Removed: `_LOCALE_MAP`, socket timeout management, Google throttle delay, `deep-translator` import, `sys`/`socket` imports
- All NLLB/Google-specific comments updated

**Provenance reclassification in `l10n_provenance.py`:**
- Added `ENGINE_QWEN` as high quality
- Demoted `ENGINE_NLLB` from high to low quality (upgrade candidate)
- `ENGINE_NLLB` and `ENGINE_GOOGLE` constants retained — existing provenance sidecars on disk reference them

**Deleted files:**
- `l10n_nllb_engine.py` (544 lines) — replaced by `l10n_qwen_engine.py`
- `test_l10n_nllb_engine.py` (199 lines) — tested the deleted engine

**Text updates across 10 files:** all user-facing and comment references to "NLLB" and "Google Translate" updated to reflect the Qwen engine.

**Sentinel-based brand shielding in `l10n_brands.py`:**
- Replaced `<B0>`/`<B1>` angle-bracket placeholders with `XBQ<L1><L2>VKZ` sentinel format (8-char opaque tokens, no digits, no adjacent repeats)
- Matches the saropa.com website pipeline sentinel format
- `unshield_brands()` regex handles case-insensitive matching and per-character doubling tolerance

**Hardening fixes in `l10n_qwen_engine.py`:**
- Removed no-op `try/except Exception: raise` in `_call_ollama()` — exceptions now propagate to `_translate_with_retry` for backoff
- Fixed `translate()` docstring: accurately states "Raises on network/timeout errors" (was "Returns None on failure")
- Fixed prompt text: "8-character" sentinel tokens (was "7-character")
- Removed unused `sentinels` parameter from `_build_prompt()`

**New test file: `test_l10n_brands.py`** — 9 tests covering sentinel format, shield/unshield round-trip, case-insensitive restore, and character-doubling tolerance.

### Failure mode change

When Qwen fails to translate a string (timeout, Ollama down, echo), the English source is kept with no provenance stamp (classifies as `untracked` = low quality). There is no Google fallback. The `low_quality` upgrade pass will re-attempt these on a later run.

### Test results

54 tests pass across 5 suites:
- 9 provenance tests (quality tiers, identity, quality split)
- 10 translator tests (finalize locale, reassemble sentences, failures export, sentence mode toggle)
- 6 sentence tests (split/join round-trip)
- 21 Qwen engine tests (prompt building, `<think>` stripping, model selection, echo detection, locale coverage)
- 9 brand tests (sentinel format, shield/unshield round-trip, case/doubling tolerance)

### Known limitations

- `l10n_translator.py` is 533 total lines (pre-existing; reduced from 733 by removing Google/NLLB code, still over the 300-line code limit)
- No circuit breaker or stall detection (the saropa.com pipeline has these; SLC's smaller workload does not justify the complexity)
- Ollama daemon spawned via `Popen` with no PID tracking — concurrent script invocations could spawn duplicate daemons (harmless, Ollama serializes on its port)
