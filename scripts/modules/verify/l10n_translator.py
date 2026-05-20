# -*- coding: utf-8 -*-
"""Translate missing l10n bundle entries via Google Translate (free tier).

Uses ``deep-translator`` (``pip install deep-translator``) which wraps the
public Google Translate endpoint. No API key needed. Rate limits apply but
are generous enough for the ~300 strings x 10 locales in this project.

Each locale's bundle is updated in place: missing keys are added, untranslated
keys (value == English) are retranslated. Existing real translations are never
overwritten.

Brand names are shielded from translation using placeholder substitution
(see l10n_brands.py). After translation, brands are restored and validated.
Translations that mangle brands are rejected and retried once.
"""

import json
import sys
import time
from pathlib import Path

from modules.verify.l10n_bundle_audit import (
    L10N_DIR,
    extract_all_source_strings,
)
from modules.verify.l10n_brands import (
    is_brand_only,
    shield_brands,
    unshield_brands,
    validate_brands,
)

# VS Code l10n bundle locale codes -> deep-translator target codes.
# deep-translator uses standard ISO codes; VS Code bundles use lowercase
# with hyphens. Most map 1:1 except regional variants.
_LOCALE_MAP: dict[str, str] = {
    "de": "de",
    "es": "es",
    "fr": "fr",
    "it": "it",
    "ja": "ja",
    "ko": "ko",
    "pt-br": "pt",
    "ru": "ru",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
}

# Delay between individual translate calls to avoid rate limits.
# Google's free endpoint tolerates ~5 req/s comfortably; 0.2s is safe.
_THROTTLE_SECONDS = 0.2


def _load_bundle(locale: str) -> tuple[Path, dict[str, str]]:
    """Load a locale bundle, returning (path, data). Empty dict if missing."""
    path = L10N_DIR / f"bundle.l10n.{locale}.json"
    if path.exists():
        return path, json.loads(path.read_text(encoding="utf-8"))
    return path, {}


def _save_bundle(path: Path, data: dict[str, str]) -> None:
    """Write a bundle atomically (write to tmp then rename)."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)


def _translate_one(
    translator: object,
    en_key: str,
) -> str | None:
    """Translate one string with brand shielding.

    Returns the translated string with brands restored, or None on failure.
    Brand-only strings are returned as-is (identity = correct translation).
    """
    if is_brand_only(en_key):
        return en_key

    shielded, replacements = shield_brands(en_key)

    # If the entire string became placeholders (rare), just return as-is.
    stripped = shielded
    for placeholder, _ in replacements:
        stripped = stripped.replace(placeholder, "").strip()
    if not stripped:
        return en_key

    result = translator.translate(shielded)  # type: ignore[union-attr]
    if not result or not result.strip():
        return None

    restored = unshield_brands(result.strip(), replacements)

    # Validate: every brand in the original must survive in the translation.
    mangled = validate_brands(en_key, restored)
    if mangled:
        # One retry: Google sometimes handles it better on a second attempt.
        result2 = translator.translate(shielded)  # type: ignore[union-attr]
        if result2 and result2.strip():
            restored2 = unshield_brands(result2.strip(), replacements)
            if not validate_brands(en_key, restored2):
                return restored2
        # Retry also failed — return None so caller keeps English.
        return None

    return restored


def translate_locale(
    locale: str,
    canonical_keys: set[str],
    *,
    dry_run: bool = False,
) -> tuple[int, int, int, int]:
    """Translate missing/untranslated strings for one locale.

    Returns (translated, kept, brand, errors).
      translated = newly translated this run.
      kept       = already had a real non-English translation.
      brand      = brand-only strings where identity IS correct.
      errors     = API call failed, kept English as fallback.
    """
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        print(
            "  deep-translator not installed. "
            "Run: pip install deep-translator",
            file=sys.stderr,
        )
        return 0, 0, 0, 0

    target_code = _LOCALE_MAP.get(locale)
    if not target_code:
        print(f"  No translator mapping for locale '{locale}', skipping.")
        return 0, 0, 0, 0

    path, bundle = _load_bundle(locale)
    translator = GoogleTranslator(source="en", target=target_code)

    translated = 0
    kept = 0
    brand = 0
    errors = 0

    for en_key in sorted(canonical_keys):
        existing = bundle.get(en_key)

        # Brand-only strings: identity IS the correct translation.
        if is_brand_only(en_key):
            bundle[en_key] = en_key
            brand += 1
            continue

        # Already has a real (non-English) translation — keep it.
        if existing and existing != en_key:
            kept += 1
            continue

        if dry_run:
            translated += 1
            continue

        try:
            result = _translate_one(translator, en_key)
            if result:
                bundle[en_key] = result
                translated += 1
            else:
                # Keep original English as fallback.
                bundle[en_key] = en_key
                errors += 1
        except Exception as exc:
            # Rate limit, network error, etc. Keep English and continue.
            print(f"    WARN [{locale}]: {en_key[:50]}... -> {exc}")
            bundle[en_key] = en_key
            errors += 1

        # Throttle to stay under rate limits.
        time.sleep(_THROTTLE_SECONDS)

    # Remove orphan keys (in bundle but not in canonical set).
    orphans = [k for k in bundle if k not in canonical_keys]
    for k in orphans:
        del bundle[k]

    if not dry_run:
        _save_bundle(path, bundle)

    return translated, kept, brand, errors


def fix_mangled_brands(locale: str, canonical_keys: set[str]) -> int:
    """Find and reset translations that mangled brand names.

    Returns the number of translations reset to English. These will be
    retranslated on the next translate_locale() call.
    """
    path, bundle = _load_bundle(locale)
    reset_count = 0

    for en_key in canonical_keys:
        existing = bundle.get(en_key)
        if not existing or existing == en_key:
            continue

        # Brand-only strings must be identity.
        if is_brand_only(en_key) and existing != en_key:
            bundle[en_key] = en_key
            reset_count += 1
            continue

        # Check brand tokens in longer strings.
        mangled = validate_brands(en_key, existing)
        if mangled:
            bundle[en_key] = en_key
            reset_count += 1

    if reset_count > 0:
        _save_bundle(path, bundle)

    return reset_count


def get_canonical_keys() -> set[str]:
    """Return the set of English string values that every bundle must have."""
    return set(extract_all_source_strings().values())


def get_translation_locales() -> list[str]:
    """Return locale codes from existing bundle files on disk."""
    locales = []
    for f in sorted(L10N_DIR.iterdir()):
        if (
            f.name.startswith("bundle.l10n.")
            and f.name.endswith(".json")
            and f.name != "bundle.l10n.json"
        ):
            locale = f.name.replace("bundle.l10n.", "").replace(".json", "")
            locales.append(locale)
    return locales
