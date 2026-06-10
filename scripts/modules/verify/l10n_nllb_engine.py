# -*- coding: utf-8 -*-
"""Offline NLLB-200-3.3B translation engine (Meta, via CTranslate2).

Drop-in higher-quality alternative to the Google Translate (``deep-translator``)
backend. Exposes a ``NllbTranslator`` whose ``.translate(text)`` method matches
the ``deep_translator.GoogleTranslator`` shape, so ``l10n_translator`` can swap
engines without touching the brand-shielding / validation / bundle-merge logic.

Why NLLB over Google: a single 3.3B model covers 200+ language pairs offline,
never rate-limits, and produces materially better output on lower-resource
languages. For this project's high-resource locale set (de/es/fr/it/ja/ko/pt/
ru/zh) the lead over Google is narrower but still real, and the offline runtime
removes the per-IP throttling that stalls the publish pipeline.

Dependencies (install once):
    pip install ctranslate2 sentencepiece huggingface_hub
Model (~7 GB, one-time download — NOT performed by this module):
    JustFrederik/nllb-200-3.3B-ct2-float16

This module NEVER downloads the model. ``is_available()`` returns False until
the model is already cached on disk, at which point the caller uses it and
otherwise falls back to Google. Downloading the 7 GB model is a deliberate,
separate operator action — see ``cache_hint()`` for the command. The cache
location honors ``SAROPA_NLLB_MODEL_DIR`` so a model already downloaded by the
sibling Saropa Contacts pipeline is reused without a second 7 GB fetch.

Environment overrides:
    SAROPA_SKIP_NLLB=1          disable NLLB entirely (always use Google)
    SAROPA_NLLB_MODEL_DIR=<dir> HF cache dir to look in (default: HF default)
    SAROPA_NLLB_DEVICE=cuda|cpu force device (default: auto-detect)
    SAROPA_NLLB_STRING_TIMEOUT  per-string wall-clock cap in seconds (default 10)
    SAROPA_NLLB_MAX_INPUT_TOKENS source-token gate; 0 disables (default 80)
"""

import os
import re
import sys
import threading
import time
from pathlib import Path

# Hugging Face repo for the float16-quantized CTranslate2 model. A single repo
# covers every language pair — no per-pair downloads.
_NLLB_MODEL_ID = "JustFrederik/nllb-200-3.3B-ct2-float16"

# Per-string wall-clock cap. NLLB-3.3B greedy decode finishes typical UI
# strings in well under a second; the cap only fires on degenerate inputs that
# would otherwise wedge the run. Clamped to [5, 300] when read from env.
_DEFAULT_STRING_TIMEOUT_SEC = 10.0

# Source-token ceiling. Paragraph-scale inputs cannot finish under the per-call
# timeout on typical hardware and, worse, their abandoned worker thread holds
# CTranslate2's internal mutex and makes the *following* short strings time out
# too. UI bundle strings are short, so this gate almost never fires here, but it
# is kept as the same safety valve the contacts pipeline relies on.
_DEFAULT_MAX_SOURCE_TOKENS = 80

# VS Code l10n locale code -> NLLB FLORES-200 language identifier.
# Only the locales this project actually ships. ``_flores_code`` falls back to
# the base subtag (e.g. "pt-br" -> "pt") for anything not listed exactly.
# Reference: https://github.com/facebookresearch/flores/blob/main/flores200
_FLORES_MAP: dict[str, str] = {
    "de": "deu_Latn",      # German
    "es": "spa_Latn",      # Spanish
    "fr": "fra_Latn",      # French
    "it": "ita_Latn",      # Italian
    "ja": "jpn_Jpan",      # Japanese
    "ko": "kor_Hang",      # Korean
    "pt": "por_Latn",      # Portuguese (base, for pt-br fallback)
    "pt-br": "por_Latn",   # Portuguese (Brazil)
    "ru": "rus_Cyrl",      # Russian
    "zh": "zho_Hans",      # Chinese Simplified (base)
    "zh-cn": "zho_Hans",   # Chinese Simplified
    "zh-tw": "zho_Hant",   # Chinese Traditional
}

# Masks ``{0}`` / ``{count}`` / ``{0,number}`` style format placeholders. NLLB
# translates or transliterates the word inside braces and frequently drops the
# braces, which corrupts the runtime substitution. The Google path tolerates
# raw braces; NLLB does not, so the engine masks them to copy-through tokens.
_FORMAT_PH = re.compile(r"\{[^}]*\}")


class NllbUnavailable(RuntimeError):
    """Raised when the NLLB model cannot be loaded (deps/model/device missing).

    The caller treats this as "fall back to Google", so the message is for the
    operator log only — it never aborts the pipeline.
    """


# Loaded once and reused across every locale in a run. ``None`` means "not yet
# loaded"; a successful load fills both. A failed load raises rather than
# caching a sentinel, so a transient cause (e.g. freed RAM) can succeed later.
_translator: object | None = None
_tokenizer: object | None = None
_load_lock = threading.Lock()

# Set True once the device cascade is exhausted with no working config. Unlike a
# missing model or absent deps (re-checked cheaply each call), a failed device
# probe will not fix itself within a single run, so this flag stops the caller
# from re-probing the full cascade for every remaining locale.
_load_failed = False


def _flores_code(locale: str) -> str | None:
    """Map a bundle locale code to its NLLB FLORES-200 identifier, or None."""
    exact = _FLORES_MAP.get(locale.lower())
    if exact:
        return exact
    base = locale.lower().split("-")[0].split("_")[0]
    return _FLORES_MAP.get(base)


def _candidate_cache_dirs() -> list[str | None]:
    """Hugging Face cache dirs to probe for the model, in priority order.

    1. ``SAROPA_NLLB_MODEL_DIR`` when set — explicit override.
    2. ``None`` — the Hugging Face default cache (a model fetched with no
       explicit cache_dir, e.g. via ``huggingface-cli download``).
    3. ``<drive>\\tools\\meta_nllb`` — the sibling Saropa Contacts pipeline's
       default location, so a model already downloaded there is reused without
       a second ~7 GB fetch. ``<drive>`` is this file's drive anchor, matching
       how the contacts pipeline derives its own default.
    """
    candidates: list[str | None] = []
    env = os.environ.get("SAROPA_NLLB_MODEL_DIR", "").strip()
    if env:
        candidates.append(env)
    candidates.append(None)
    candidates.append(str(Path(Path(__file__).resolve().anchor) / "tools" / "meta_nllb"))
    return candidates


def _resolve_model_path() -> str | None:
    """Return the cached model snapshot path, or None if not downloaded anywhere.

    Probes each candidate cache dir with ``local_files_only=True`` so this NEVER
    triggers a 7 GB download — a miss in every location returns None and the
    caller falls back to Google.
    """
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        return None
    for cache_dir in _candidate_cache_dirs():
        try:
            return snapshot_download(
                repo_id=_NLLB_MODEL_ID, cache_dir=cache_dir, local_files_only=True,
            )
        except Exception:  # noqa: BLE001 — a miss here means "try the next dir"
            continue
    return None


# Set once the CUDA DLL directories have been registered with the Windows
# loader, so the (cheap) scan runs a single time per process rather than before
# every device attempt.
_cuda_dll_dirs_registered = False


def _register_cuda_dll_dirs() -> None:
    """Put pip-installed NVIDIA CUDA runtime DLLs on the Windows loader path.

    ctranslate2's CUDA build lazy-loads cuBLAS (``cublas64_12.dll``) at the first
    ``translate_batch`` call, but the wheel ships cuDNN only — cuBLAS comes from
    the separate ``nvidia-cublas-cu12`` package, which unpacks the DLL under
    ``site-packages/nvidia/cublas/bin`` without putting it on any search path.
    Since Python 3.8, Windows no longer loads dependent DLLs from ``PATH``, so the
    CUDA device constructs fine but the first inference crashes with
    "cublas64_12.dll is not found" unless that bin dir is registered via
    ``os.add_dll_directory``. We register every ``nvidia/*/bin`` dir (cuBLAS pulls
    in siblings like ``cublasLt64_12.dll``) and also prepend to ``PATH`` because
    different loaders consult different search paths. No-op off Windows and where
    the wheels are absent — a CPU-only install simply falls through the cascade.
    """
    global _cuda_dll_dirs_registered  # noqa: PLW0603
    if _cuda_dll_dirs_registered or not hasattr(os, "add_dll_directory"):
        return
    _cuda_dll_dirs_registered = True

    # nvidia-cublas-cu12 installs as a sibling of ctranslate2 in the same
    # site-packages, so derive the root from ctranslate2's own location (robust
    # across venv / --target / global installs); fall back to site.getsitepackages.
    roots: list[Path] = []
    try:
        import ctranslate2
        roots.append(Path(ctranslate2.__file__).resolve().parent.parent)
    except Exception:  # noqa: BLE001 — import miss handled by the CPU fallback
        pass
    try:
        import site
        roots.extend(Path(p) for p in site.getsitepackages())
    except Exception:  # noqa: BLE001 — some embeds lack getsitepackages
        pass

    seen: set[str] = set()
    for root in roots:
        for bin_dir in (root / "nvidia").glob("*/bin"):
            key = str(bin_dir)
            if key in seen or not bin_dir.is_dir():
                continue
            seen.add(key)
            os.environ["PATH"] = key + os.pathsep + os.environ.get("PATH", "")
            try:
                os.add_dll_directory(key)
            except OSError:
                continue


def _device_attempts() -> list[tuple[str, str]]:
    """Build the (device, compute_type) cascade: best quality -> most portable.

    CUDA float16 is fastest; CPU int8 needs ~4 GB RAM vs float16's ~14 GB so it
    is tried before CPU float16, which commonly OOMs on smaller machines.
    """
    try:
        import ctranslate2
    except ImportError:
        return []
    pref = os.environ.get("SAROPA_NLLB_DEVICE", "auto")
    has_cuda = (
        ctranslate2.get_cuda_device_count() > 0 if pref == "auto"
        else pref == "cuda"
    )
    attempts: list[tuple[str, str]] = []
    if has_cuda:
        attempts.append(("cuda", "default"))
    attempts.append(("cpu", "int8"))
    attempts.append(("cpu", "default"))
    return attempts


def _try_load_device(
    model_path: str,
    sp: object,
    device: str,
    compute: str,
) -> object | None:
    """Load + probe-translate on one device config. Returns translator or None.

    cuBLAS / MKL failures surface only at inference time, not construction, so
    a one-line probe here catches a broken device before the real loop starts.
    The probe uses a full sentence — single tokens trigger NLLB repetition
    degeneration that looks like a failure even when real translation works.
    """
    import ctranslate2
    try:
        translator = ctranslate2.Translator(
            model_path,
            device=device,
            compute_type=compute,
            inter_threads=min(4, os.cpu_count() or 1) if device == "cpu" else 1,
        )
        probe = sp.Encode("The quick brown fox jumps over the lazy dog.", out_type=str)  # type: ignore[union-attr]
        translator.translate_batch(
            [["eng_Latn"] + probe],
            target_prefix=[["deu_Latn"]],
            beam_size=1,
            max_decoding_length=10,
        )
        return translator
    except (RuntimeError, OSError, MemoryError) as err:
        # Not fatal: this is the device cascade trying its next fallback (e.g.
        # CUDA -> CPU when cuBLAS is absent). Phrase it as a step, not a crash —
        # the operator otherwise reads "load failed" as the whole run dying.
        sys.stderr.write(
            f"[nllb] {device}/{compute} unavailable, trying next fallback: {err}\n"
        )
        return None


def _ensure_model() -> tuple[object, object]:
    """Load the model once (thread-safe) and return (translator, tokenizer).

    Raises ``NllbUnavailable`` if deps are missing, the model is not cached, or
    every device configuration fails to load.
    """
    global _translator, _tokenizer  # noqa: PLW0603
    if _translator is not None and _tokenizer is not None:
        return _translator, _tokenizer
    with _load_lock:
        if _translator is not None and _tokenizer is not None:
            return _translator, _tokenizer
        try:
            import sentencepiece
        except ImportError as exc:
            raise NllbUnavailable("ctranslate2 / sentencepiece not installed") from exc
        model_path = _resolve_model_path()
        if not model_path:
            raise NllbUnavailable("NLLB model not cached on disk")
        sp = sentencepiece.SentencePieceProcessor()
        sp.Load(str(os.path.join(model_path, "sentencepiece.bpe.model")))
        # Register the pip-installed CUDA runtime DLLs before the CUDA attempt,
        # else cuBLAS is missing at inference and the run silently drops to CPU.
        _register_cuda_dll_dirs()
        # The cascade below loads the ~7 GB model and runs a probe translation in
        # one blocking call that prints nothing. On the first locale that silence
        # reads as a hang, so announce the one-time load before it starts.
        sys.stderr.write(
            "[nllb] Loading NLLB-200-3.3B model (one-time, may take a minute)…\n"
        )
        sys.stderr.flush()
        for device, compute in _device_attempts():
            translator = _try_load_device(model_path, sp, device, compute)
            if translator is not None:
                _translator, _tokenizer = translator, sp
                sys.stderr.write(f"[nllb] Model loaded ({device}/{compute}).\n")
                return _translator, _tokenizer
        # Cascade exhausted — record it so is_available() stops offering NLLB
        # for the rest of this run instead of re-probing every device per locale.
        global _load_failed  # noqa: PLW0603
        _load_failed = True
        raise NllbUnavailable("no working device configuration")


def _mask_format_placeholders(text: str) -> tuple[str, dict[str, str]]:
    """Replace ``{0}`` / ``{count}`` placeholders with copy-through tokens.

    Returns (masked_text, {token: original}). NLLB preserves the ``__PH0__``
    style tokens verbatim where it would otherwise mangle the braces.
    """
    tokens: dict[str, str] = {}
    counter = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal counter
        token = f"__PH{counter}__"
        tokens[token] = match.group(0)
        counter += 1
        return token

    return _FORMAT_PH.sub(repl, text), tokens


def _unmask(text: str, tokens: dict[str, str]) -> str:
    """Restore masked format placeholders by token replacement."""
    for token, original in tokens.items():
        text = text.replace(token, original)
    return text


def _read_clamped_timeout() -> float:
    """Per-string deadline from env, clamped to [5, 300] seconds."""
    raw = os.environ.get("SAROPA_NLLB_STRING_TIMEOUT", "").strip()
    try:
        value = float(raw) if raw else _DEFAULT_STRING_TIMEOUT_SEC
    except ValueError:
        value = _DEFAULT_STRING_TIMEOUT_SEC
    return max(5.0, min(value, 300.0))


def _read_max_source_tokens() -> int:
    """Source-token gate from env; 0 / negative disables it."""
    raw = os.environ.get("SAROPA_NLLB_MAX_INPUT_TOKENS", "").strip()
    try:
        return int(raw) if raw else _DEFAULT_MAX_SOURCE_TOKENS
    except ValueError:
        return _DEFAULT_MAX_SOURCE_TOKENS


def _translate_batch_with_deadline(
    translator: object,
    source_tokens: list[str],
    target_prefix: list[str],
    deadline_sec: float,
    max_out: int,
) -> object | None:
    """Run ``translate_batch`` in a daemon thread with a wall-clock cap.

    CTranslate2 has no cancel API; a degenerate input can saturate the decoder
    for minutes. Running in a daemon thread and joining with a deadline lets one
    bad string fall back to English instead of wedging the whole run. The
    abandoned worker keeps running but, at this project's scale (10 locales x a
    few hundred short strings), does not accumulate the way it can across the
    contacts pipeline's 50+ locales — so the orphan-drain machinery there is
    intentionally omitted here.
    """
    box: list[object] = []

    def run() -> None:
        try:
            box.append(translator.translate_batch(  # type: ignore[union-attr]
                [source_tokens],
                target_prefix=[target_prefix],
                beam_size=1,
                max_decoding_length=max_out,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3,
            ))
        except Exception as exc:  # noqa: BLE001 — surfaced via box on main thread
            box.append(exc)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    thread.join(timeout=deadline_sec)
    if thread.is_alive() or not box:
        return None
    item = box[0]
    if isinstance(item, Exception):
        raise item
    return item


def _translate_core(text: str, flores_target: str) -> str | None:
    """Tokenize, translate via CTranslate2, detokenize. None on any failure.

    Greedy decode (beam_size=1) with a repetition penalty and a decode-length
    cap scaled to the input — the same tuned parameters the contacts pipeline
    settled on after beam search timed out on long low-resource translations.
    """
    translator, tokenizer = _ensure_model()
    source_tokens = ["eng_Latn"] + tokenizer.Encode(text, out_type=str)  # type: ignore[union-attr]
    max_source = _read_max_source_tokens()
    if max_source > 0 and len(source_tokens) > max_source:
        # Over-long input: skip rather than risk a timeout that stalls the next
        # strings. UI bundle strings effectively never hit this.
        return None
    # Decode runway scales with input (CJK<->Latin expansion) with a floor and
    # a 256 cap; without the cap, short inputs get the full runway and the model
    # pads them with repetitions.
    max_out = max(20, min(len(source_tokens) * 3, 256))
    results = _translate_batch_with_deadline(
        translator, source_tokens, [flores_target],
        _read_clamped_timeout(), max_out,
    )
    if results is None:
        return None
    output_tokens = results[0].hypotheses[0]  # type: ignore[index]
    if output_tokens and output_tokens[0] == flores_target:
        output_tokens = output_tokens[1:]  # drop the leading target-lang tag
    decoded = tokenizer.Decode(output_tokens)  # type: ignore[union-attr]
    cleaned = decoded.strip() if decoded else ""
    # An echoed source (cleaned == input) means no real translation happened —
    # report it as a miss so the caller keeps English rather than storing a
    # false "translated" value.
    if cleaned and cleaned != text.strip():
        return cleaned
    return None


class NllbTranslator:
    """Google-compatible translator backed by offline NLLB-200-3.3B.

    Constructed per target locale (mirrors ``GoogleTranslator(target=...)``).
    The constructor forces a model load so a missing model / device fails fast
    as ``NllbUnavailable`` and the caller can fall back to Google for the whole
    run — rather than silently returning English for every string.
    """

    def __init__(self, locale: str) -> None:
        flores = _flores_code(locale)
        if not flores:
            raise NllbUnavailable(f"no NLLB FLORES code for locale {locale!r}")
        self._flores = flores
        _ensure_model()  # raises NllbUnavailable if the model can't load

    def translate(self, text: str) -> str | None:
        """Translate one string. Returns the translation, or None on a miss.

        None covers timeout, over-length skip, and echoed-source — the caller
        already maps a falsy result to "keep English", so NLLB misses degrade
        exactly like a rejected Google result, never as a network failure.
        """
        plain = (text or "").strip()
        if not plain:
            return None
        masked, tokens = _mask_format_placeholders(plain)
        result = _translate_core(masked, self._flores)
        return _unmask(result, tokens) if result else None


def is_available() -> bool:
    """True when NLLB can be used: not disabled, deps importable, model cached.

    Cheap enough to call before each run. Does NOT load the model or download
    anything — only checks importability and on-disk cache presence so the
    caller can decide between NLLB and Google before constructing a translator.
    """
    if _load_failed or os.environ.get("SAROPA_SKIP_NLLB", "").strip() == "1":
        return False
    try:
        import ctranslate2  # noqa: F401
        import sentencepiece  # noqa: F401
    except ImportError:
        return False
    return _resolve_model_path() is not None


def cache_hint() -> str:
    """Operator-facing one-liner explaining how to enable NLLB when it's off."""
    if os.environ.get("SAROPA_SKIP_NLLB", "").strip() == "1":
        return "NLLB disabled via SAROPA_SKIP_NLLB=1 — using Google Translate."
    try:
        import ctranslate2  # noqa: F401
        import sentencepiece  # noqa: F401
    except ImportError:
        return (
            "NLLB deps missing — using Google. Enable higher-quality offline "
            "translation with: pip install ctranslate2 sentencepiece huggingface_hub"
        )
    return (
        "NLLB model not cached (~7 GB) — using Google. Download once to enable "
        f"offline translation: huggingface-cli download {_NLLB_MODEL_ID}"
    )
