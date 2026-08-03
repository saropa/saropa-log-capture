# -*- coding: utf-8 -*-
"""Qwen 3 offline translation engine via Ollama.

Calls the local Ollama daemon's /api/chat endpoint (localhost:11434) with a
GPU-selected model from the Qwen 3 ladder (14B / 8B / 4B). Returns translated
strings or None when Ollama is unreachable, the model echoed the source, or the
request timed out — so the caller keeps the English source.

Ported from the saropa.com website pipeline's i18n_qwen.py, simplified for this
VS Code extension's smaller l10n workload (~300 strings × 10 locales).

Prerequisites:
    1. Install Ollama: https://ollama.com/download
    2. The model pull is automatic on first use (``_ensure_ready``).

Environment overrides:
    SAROPA_QWEN_MODEL=<tag>       pin a specific model tag (default: auto)
    SAROPA_QWEN_TIMEOUT=<sec>     per-string timeout (default: 90, range 15-600)
    SAROPA_QWEN_KEEP_ALIVE=<dur>  model keep-alive in Ollama (default: 60m)
    OLLAMA_HOST=<url>             Ollama endpoint (default: http://localhost:11434)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

# ---------------------------------------------------------------------------
# Ollama endpoint
# ---------------------------------------------------------------------------
_OLLAMA_BASE = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")

# ---------------------------------------------------------------------------
# Model ladder — GPU-aware selection (best → smallest)
# ---------------------------------------------------------------------------
_QWEN_MODEL_LADDER: list[tuple[str, str, str, float]] = [
    ("qwen3:14b", "qwen3_14b_local", "~9.3 GB", 11.0),
    ("qwen3:8b", "qwen3_8b_local", "~5.2 GB", 6.7),
    ("qwen3:4b", "qwen3_4b_local", "~2.6 GB", 3.6),
]

# Locale → (language name, script constraint or None)
# Script constraint forces the model to stay in the target writing system.
_LOCALE_INFO: dict[str, tuple[str, str | None]] = {
    "de": ("German", None),
    "es": ("Spanish", None),
    "fr": ("French", None),
    "it": ("Italian", None),
    "ja": ("Japanese", "Japanese (Hiragana, Katakana, or Kanji)"),
    "ko": ("Korean", "Korean (Hangul)"),
    "pt-br": ("Brazilian Portuguese", None),
    "ru": ("Russian", "Cyrillic"),
    "zh-cn": ("Simplified Chinese", "Chinese (Simplified Han)"),
    "zh-tw": ("Traditional Chinese", "Chinese (Traditional Han)"),
}


# ---------------------------------------------------------------------------
# GPU detection + model selection
# ---------------------------------------------------------------------------

def _detect_gpu_vram_gb() -> float | None:
    """Total VRAM of the primary NVIDIA GPU in GB, or None.

    AMD/Intel GPUs are not probed — no cross-platform CLI equivalent to
    nvidia-smi. Non-NVIDIA machines fall through to the 8B default, which
    is safe for CPU-only inference (slower, but correct).
    """
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if out.returncode != 0:
            return None
        first = (out.stdout or "").strip().splitlines()
        return float(first[0].strip()) / 1024.0 if first else None
    except Exception:  # noqa: BLE001
        return None


def _select_qwen_model() -> tuple[str, str, str, str]:
    """Pick (tag, stamp, pull_size, note) for this machine."""
    override = os.environ.get("SAROPA_QWEN_MODEL", "").strip()
    if override:
        for tag, stamp, size, _need in _QWEN_MODEL_LADDER:
            if tag == override:
                return tag, stamp, size, f"pinned via SAROPA_QWEN_MODEL ({tag})"
        safe = re.sub(r"[^a-z0-9]+", "_", override.lower()).strip("_")
        return override, f"{safe}_local", "?", (
            f"pinned via SAROPA_QWEN_MODEL ({override}, unknown size)"
        )
    vram = _detect_gpu_vram_gb()
    if vram is None:
        tag, stamp, size, _need = _QWEN_MODEL_LADDER[1]
        return tag, stamp, size, "no NVIDIA GPU detected — using mid-ladder default"
    for tag, stamp, size, need in _QWEN_MODEL_LADDER:
        if vram >= need:
            return tag, stamp, size, (
                f"GPU {vram:.1f} GB VRAM → {tag} (needs ~{need:.1f} GB)"
            )
    tag, stamp, size, need = _QWEN_MODEL_LADDER[-1]
    return tag, stamp, size, (
        f"GPU {vram:.1f} GB VRAM below smallest requirement — using {tag}"
    )


# Resolved once at import.
QWEN_MODEL_TAG, QWEN_STAMP, QWEN_MODEL_PULL_SIZE, QWEN_MODEL_SELECTION_NOTE = (
    _select_qwen_model()
)


# ---------------------------------------------------------------------------
# Readiness probes
# ---------------------------------------------------------------------------

def _endpoint_up(timeout_s: float = 2.0) -> bool:
    """True when the local Ollama daemon answers on port 11434."""
    try:
        with urllib.request.urlopen(
            f"{_OLLAMA_BASE}/api/version", timeout=timeout_s
        ) as resp:
            return resp.status == 200
    except Exception:  # noqa: BLE001
        return False


def _normalize_model_name(name: str) -> str:
    """Strip digest (`@sha256:…`) and `:latest` suffix for comparison.

    Ollama returns pulled models with varying suffixes depending on version
    and pull method. Normalizing lets `_has_model` match reliably.
    """
    name = name.split("@")[0]
    if name.endswith(":latest"):
        name = name[: -len(":latest")]
    return name


def _has_model(timeout_s: float = 5.0) -> bool:
    """True when the selected model tag is pulled locally."""
    try:
        with urllib.request.urlopen(
            f"{_OLLAMA_BASE}/api/tags", timeout=timeout_s
        ) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:  # noqa: BLE001
        return False
    models = data.get("models", [])
    if not isinstance(models, list):
        return False
    # Ollama may append `:latest` or `@sha256:…` to model names; strip both
    # before comparing so a pulled "qwen3:8b" matches tag "qwen3:8b".
    base_tag = _normalize_model_name(QWEN_MODEL_TAG)
    for m in models:
        name = _normalize_model_name(str(m.get("name", "")))
        if name == base_tag:
            return True
    return False


def ollama_installed() -> bool:
    """True when the ``ollama`` binary is on PATH."""
    return shutil.which("ollama") is not None


def qwen_available() -> bool:
    """True when Qwen can run right now: daemon up AND model pulled."""
    return _endpoint_up() and _has_model()


def _ensure_ready() -> tuple[bool, str]:
    """Self-provision Ollama + Qwen model. Returns (ready, detail)."""
    ollama = shutil.which("ollama")
    if not ollama:
        return False, (
            "Ollama is not installed — install from https://ollama.com/download, "
            "then re-run (the model pull is automatic)"
        )

    sys.stderr.write(
        f"[Ollama/Qwen] model selection: {QWEN_MODEL_SELECTION_NOTE}\n"
    )

    if not _endpoint_up():
        sys.stderr.write("[Ollama/Qwen] daemon not running — starting...\n")
        env = {**os.environ, "OLLAMA_NUM_PARALLEL": "1"}
        # Detach so the daemon outlives this script
        popen_kw: dict = {"env": env}
        if sys.platform == "win32":
            popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            popen_kw["start_new_session"] = True
        try:
            subprocess.Popen(  # noqa: S603
                [ollama, "serve"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                **popen_kw,
            )
        except Exception as exc:  # noqa: BLE001
            return False, f"`ollama serve` failed: {exc}"

        deadline = time.monotonic() + 30.0
        while time.monotonic() < deadline:
            if _endpoint_up():
                break
            time.sleep(0.5)
        else:
            return False, "Ollama daemon did not come up within 30 s"

    if not _has_model():
        sys.stderr.write(
            f"[Ollama/Qwen] model {QWEN_MODEL_TAG} not found "
            f"— pulling ({QWEN_MODEL_PULL_SIZE}, one-time)...\n"
        )
        try:
            result = subprocess.run(
                [ollama, "pull", QWEN_MODEL_TAG], check=False,  # noqa: S603
            )
        except Exception as exc:  # noqa: BLE001
            return False, f"`ollama pull {QWEN_MODEL_TAG}` failed: {exc}"
        if result.returncode != 0:
            return False, f"`ollama pull {QWEN_MODEL_TAG}` exited {result.returncode}"
        if not _has_model():
            return False, f"Pull completed but {QWEN_MODEL_TAG} not found in tags"

    return True, f"Ollama ready, {QWEN_MODEL_TAG} loaded"


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def _build_prompt(
    text: str,
    locale: str,
) -> str:
    """Build the translation prompt for a single string."""
    info = _LOCALE_INFO.get(locale)
    lang_label = info[0] if info else locale
    script_name = info[1] if info else None

    token_desc = (
        "XBQ…VKZ sentinel tokens (8-character uppercase codes like "
        "XBQACVKZ, XBQCEVKZ). They are brand names — copy each one "
        "EXACTLY as written"
    )

    rule4 = (
        f"4. EVERY character of output MUST be in {script_name} script — "
        "do NOT leave or substitute any word in Latin or any other script. "
        "Spaces, digits, punctuation, and placeholder tokens are the only "
        "exceptions.\n"
    ) if script_name else (
        "4. Output MUST use the correct writing system for the target "
        "language; do not switch to another language mid-sentence.\n"
    )

    parts = [
        "Context: A VS Code extension called Saropa Log Capture for viewing "
        "debug console logs from Flutter and mobile app development. "
        "Tone should be clear and concise, matching typical IDE UI text.\n\n",
        f"Task: Translate the following English text into {lang_label}.\n\n",
        "Strict Rules:\n",
        "1. Return ONLY the translated string output.\n",
        "2. Do NOT include explanations, introduction, markdown notation, "
        "or surrounding quotes.\n",
        f"3. The text may contain placeholder tokens: {token_desc}. "
        "Copy each one into the translation EXACTLY as written, in the "
        "grammatically correct position. Never translate, remove, or "
        "reformat a token.\n",
        rule4,
        f"\nText: {text}",
    ]
    return "".join(parts)


# ---------------------------------------------------------------------------
# Ollama HTTP call
# ---------------------------------------------------------------------------

def _call_ollama(prompt: str, timeout_s: float) -> str | None:
    """Send a prompt to Ollama /api/chat and return the response text."""
    req_data = {
        "model": QWEN_MODEL_TAG,
        "messages": [{"role": "user", "content": prompt}],
        "think": False,
        "stream": False,
        "options": {"temperature": 0.1, "num_ctx": 2048},
        "keep_alive": os.environ.get("SAROPA_QWEN_KEEP_ALIVE", "60m"),
    }
    req = urllib.request.Request(
        f"{_OLLAMA_BASE}/api/chat",
        data=json.dumps(req_data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=timeout_s) as response:
        if response.status != 200:
            raise OSError(
                f"Ollama returned HTTP {response.status} "
                f"(expected 200) from {_OLLAMA_BASE}/api/chat"
            )
        res_data = json.loads(response.read().decode("utf-8"))
        translated = (
            (res_data.get("message") or {}).get("content", "").strip()
        )

    # Strip leaked <think> blocks from models that ignore think:false
    translated = re.sub(r"(?s)<think>.*?</think>", "", translated)
    translated = re.sub(r"(?s)<think>.*\Z", "", translated).strip()

    if translated.startswith('"') and translated.endswith('"'):
        translated = translated[1:-1].strip()
    if translated.startswith("'") and translated.endswith("'"):
        translated = translated[1:-1].strip()

    return translated or None


# ---------------------------------------------------------------------------
# Public translate API
# ---------------------------------------------------------------------------

class QwenTranslator:
    """Locale-bound translator matching the shape l10n_translator expects.

    Exposes ``.translate(text) -> str | None`` so the brand-shielding,
    validation, and bundle-merge logic in l10n_translator is engine-agnostic.
    """

    def __init__(self, locale: str, *, prompt_preview: bool = False) -> None:
        self.locale = locale
        self.prompt_preview = prompt_preview
        self._timeout_s = float(
            os.environ.get("SAROPA_QWEN_TIMEOUT", "90").strip() or "90"
        )
        self._timeout_s = max(15.0, min(600.0, self._timeout_s))

    def translate(self, text: str) -> str | None:
        """Translate one English string via Ollama.

        Returns None when the input is empty or the model echoed the source.
        Raises on network/timeout errors so ``_translate_with_retry`` in
        ``l10n_translator`` can apply its backoff-and-retry logic.
        """
        plain = (text or "").strip()
        if not plain:
            return None

        prompt = _build_prompt(plain, self.locale)

        if self.prompt_preview:
            sys.stderr.write(f"\n{'─' * 60}\n")
            sys.stderr.write(f"[{self.locale}] {plain[:80]}\n{'─' * 60}\n")
            sys.stderr.write(prompt + "\n")
            return None

        translated = _call_ollama(prompt, self._timeout_s)

        if not translated or translated.lower() == plain.lower():
            return None
        return translated
