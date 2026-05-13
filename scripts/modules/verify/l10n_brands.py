# -*- coding: utf-8 -*-
"""Brand name protection for l10n translation.

Brand names must never be translated, transliterated, or phonetically
adapted. They appear verbatim in every locale. Google Translate routinely
mangles them (e.g. "Saropa Lints" → "Saropa-Fusseln" in German,
"サロパリント" in Japanese, "Pelusas Saropa" in Spanish).

Two categories:
  - BRAND_ONLY: the entire English string IS the brand. The translation
    must be identical to the English string. These are excluded from
    "untranslated" counts in the audit because identity is correct.
  - BRAND_TOKENS: substrings that must appear verbatim inside longer
    translated strings. Used to validate translations and to shield
    brands from Google Translate via placeholder substitution.
"""

import re

# Strings where the ENTIRE value is a brand name or technical identifier.
# These must never be translated — the correct translation IS the English.
# Checked with exact equality: en_value in BRAND_ONLY_STRINGS.
BRAND_ONLY_STRINGS: frozenset[str] = frozenset({
    "Saropa Lints",
    "Saropa Log Capture",
})

# Substrings that must survive translation verbatim. Ordered longest-first
# so "Saropa Log Capture" is matched before "Saropa" during placeholder
# substitution.
BRAND_TOKENS: tuple[str, ...] = (
    "Saropa Log Capture",
    "Saropa Lints",
    "saropaLogCapture",
    "Saropa",
    "GitHub Copilot Chat",
    "GitHub",
    "Grafana Cloud",
    "Grafana",
    "Firebase Crashlytics",
    "Firebase",
    "Crashlytics",
    "Google Cloud",
    "Google",
    "Loki",
    "Docker",
    "Linux",
    "Copilot",
    "Cursor",
    "Claude",
    "Open VSX",
    # Technical identifiers that look like words but must stay literal.
    ".saropa",
    ".slc",
    ".gitignore",
    ".env",
    "maxLogFiles",
    "google-services.json",
)


def is_brand_only(en_value: str) -> bool:
    """True if the entire string is a brand and must not be translated."""
    return en_value in BRAND_ONLY_STRINGS


def validate_brands(en_value: str, translated: str) -> list[str]:
    """Return list of brand tokens present in English but missing from translation."""
    missing: list[str] = []
    for brand in BRAND_TOKENS:
        if brand in en_value and brand not in translated:
            missing.append(brand)
    return missing


# ---------------------------------------------------------------------------
# Placeholder shielding: swap brand tokens for numbered placeholders before
# sending to Google Translate, then restore them after. This prevents Google
# from transliterating or "translating" brand names.
# ---------------------------------------------------------------------------


def shield_brands(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Replace brand tokens with placeholders like <B0>, <B1>, etc.

    Returns (shielded_text, [(placeholder, original), ...]).
    Longest brands are replaced first so "Saropa Log Capture" is one
    token, not "Saropa" + "Log Capture".
    """
    replacements: list[tuple[str, str]] = []
    idx = 0
    for brand in BRAND_TOKENS:
        if brand in text:
            placeholder = f"<B{idx}>"
            text = text.replace(brand, placeholder)
            replacements.append((placeholder, brand))
            idx += 1
    return text, replacements


def unshield_brands(
    text: str,
    replacements: list[tuple[str, str]],
) -> str:
    """Restore brand tokens from placeholders.

    Handles cases where Google Translate may have added spaces around
    placeholders or changed their casing.
    """
    for placeholder, brand in replacements:
        # Exact match first.
        if placeholder in text:
            text = text.replace(placeholder, brand)
            continue
        # Google sometimes lowercases or adds spaces: "< b0 >" or "<b0>".
        pattern = re.compile(
            re.escape(placeholder).replace(r"\<", r"<\s*").replace(r"\>", r"\s*>"),
            re.IGNORECASE,
        )
        text = pattern.sub(brand, text)
    return text
