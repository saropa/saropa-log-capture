# -*- coding: utf-8 -*-
"""Round-trip translation quality audit.

Samples existing translated strings, reverse-translates them back to English
via Qwen, and flags divergences. A significant round-trip loss suggests the
original translation is wrong, ambiguous, or lost meaning.

This is an optional detailed audit (menu option 7) — it requires Ollama and
translates O(sample_size × locales) strings, so it takes real time.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from modules.verify.l10n_brands import is_brand_only, is_acronym_only
from modules.verify.l10n_bundle_audit import L10N_DIR
from modules.verify.l10n_console import cyan, dim, green, header, red, yellow
from modules.verify.l10n_qwen_engine import (
    _call_ollama,
    _LOCALE_INFO,
    QWEN_MODEL_TAG,
    qwen_available,
    _ensure_ready,
)


def _reverse_prompt(translated: str, locale: str) -> str:
    """Build a prompt to translate a localized string back to English."""
    info = _LOCALE_INFO.get(locale)
    lang_label = info[0] if info else locale
    return (
        "Context: A VS Code extension called Saropa Log Capture for viewing "
        "debug console logs from Flutter and mobile app development.\n\n"
        f"Task: Translate the following {lang_label} text back into English. "
        "Return ONLY the translated string — no explanations, no quotes.\n\n"
        f"Text: {translated}"
    )


def _word_set(text: str) -> set[str]:
    """Lowercase word tokens for bag-of-words overlap."""
    return {w.lower().strip(".,!?;:()[]{}\"'") for w in text.split() if w.strip()}


def _has_cjk(text: str) -> bool:
    """True when the text contains CJK ideographs or syllables.

    CJK text isn't space-delimited, so word-bag Jaccard produces empty or
    single-element sets and the similarity score is meaningless.
    """
    for ch in text:
        cp = ord(ch)
        # CJK Unified Ideographs, Hiragana, Katakana, Hangul Syllables
        if (0x4E00 <= cp <= 0x9FFF
                or 0x3040 <= cp <= 0x309F
                or 0x30A0 <= cp <= 0x30FF
                or 0xAC00 <= cp <= 0xD7AF):
            return True
    return False


def _char_ngrams(text: str, n: int = 2) -> set[str]:
    """Character n-gram set for scripts without word boundaries."""
    normalized = text.lower().strip()
    if len(normalized) < n:
        return {normalized} if normalized else set()
    return {normalized[i:i + n] for i in range(len(normalized) - n + 1)}


def _similarity(source: str, round_tripped: str) -> float:
    """Jaccard similarity: word bags for Latin text, char bigrams for CJK.

    Auto-detects CJK in either input and switches to character bigrams,
    which handle scripts without word boundaries (Japanese, Korean, Chinese).
    """
    if _has_cjk(source) or _has_cjk(round_tripped):
        a = _char_ngrams(source)
        b = _char_ngrams(round_tripped)
    else:
        a = _word_set(source)
        b = _word_set(round_tripped)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# Strings shorter than this are too terse for meaningful round-trip comparison
# (single words, abbreviations, format strings like "{0} items").
_MIN_WORDS_FOR_AUDIT = 4

# Similarity threshold: below this the translation is flagged as suspicious.
_SIMILARITY_THRESHOLD = 0.3


def _load_bundle(locale: str) -> dict[str, str]:
    """Load a locale bundle. Returns empty dict if missing."""
    path = L10N_DIR / f"bundle.l10n.{locale}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _load_english_bundle() -> dict[str, str]:
    """Load the English source bundle."""
    path = L10N_DIR / "bundle.l10n.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _sample_keys(
    english: dict[str, str],
    bundle: dict[str, str],
    sample_size: int,
) -> list[str]:
    """Pick translatable keys that have real (non-English) translations."""
    candidates = []
    for key, en_val in english.items():
        if is_brand_only(en_val) or is_acronym_only(en_val):
            continue
        if len(en_val.split()) < _MIN_WORDS_FOR_AUDIT:
            continue
        translated = bundle.get(key)
        if not translated or translated == en_val:
            continue
        candidates.append(key)
    if len(candidates) <= sample_size:
        return candidates
    return random.sample(candidates, sample_size)


def run_quality_audit(
    locales: list[str],
    *,
    sample_size: int = 20,
    timeout_s: float = 90.0,
) -> list[dict[str, str]]:
    """Run the round-trip quality audit on sampled strings.

    For each locale, samples up to ``sample_size`` translated strings,
    reverse-translates them to English via Qwen, and compares against the
    original source. Returns a list of flagged entries (low similarity).
    """
    if not qwen_available():
        ready, detail = _ensure_ready()
        if not ready:
            print(red(f"  Qwen NOT ready: {detail}"))
            return []

    english = _load_english_bundle()
    if not english:
        print(red("  No English bundle found."))
        return []

    header(f"Round-trip quality audit: {len(locales)} locale(s), "
           f"{sample_size} samples each")
    print(f"  Engine: Qwen 3 via Ollama ({QWEN_MODEL_TAG}, offline)")
    print(f"  Similarity threshold: {_SIMILARITY_THRESHOLD:.0%}\n")

    flagged: list[dict[str, str]] = []

    for locale in locales:
        bundle = _load_bundle(locale)
        keys = _sample_keys(english, bundle, sample_size)
        if not keys:
            print(f"  {cyan(locale)}: no auditable translations")
            continue

        locale_flags = 0
        print(f"  {cyan(locale)}: auditing {len(keys)} strings...")

        for key in keys:
            en_val = english[key]
            translated = bundle[key]
            prompt = _reverse_prompt(translated, locale)

            try:
                round_tripped = _call_ollama(prompt, timeout_s)
            except Exception as exc:
                print(f"    WARN: reverse-translate failed: {exc}")
                continue

            if not round_tripped:
                continue

            sim = _similarity(en_val, round_tripped)
            if sim < _SIMILARITY_THRESHOLD:
                locale_flags += 1
                flagged.append({
                    "locale": locale,
                    "key": key[:80],
                    "en": en_val[:120],
                    "translated": translated[:120],
                    "round_trip": round_tripped[:120],
                    "similarity": f"{sim:.0%}",
                })
                print(f"    {yellow('FLAG')} ({sim:.0%}): {en_val[:60]}...")

        if locale_flags == 0:
            print(f"  {cyan(locale)}: {green('all samples passed')}")
        else:
            print(f"  {cyan(locale)}: {yellow(f'{locale_flags} flagged')} "
                  f"/ {len(keys)} sampled")

    return flagged


def print_quality_report(flagged: list[dict[str, str]]) -> None:
    """Print the quality audit summary."""
    if not flagged:
        print(f"\n  {green('No quality issues found.')}")
        return

    print(f"\n  {yellow(f'{len(flagged)} translation(s) flagged:')}")
    for f in flagged:
        print(f"\n  {cyan(f['locale'])} | {dim(f['key'])}")
        print(f"    EN:    {f['en']}")
        print(f"    TRANS: {f['translated']}")
        print(f"    RT:    {f['round_trip']}")
        print(f"    Sim:   {yellow(f['similarity'])}")
    print(dim(
        "\n  Flagged strings have low round-trip similarity — the translation "
        "may have lost meaning. Review manually before acting."
    ))
