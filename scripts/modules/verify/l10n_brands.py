# -*- coding: utf-8 -*-
"""Brand name protection for l10n translation.

Brand names must never be translated, transliterated, or phonetically
adapted. They appear verbatim in every locale. Google Translate routinely
mangles them (e.g. "Saropa Lints" → "Saropa-Fusseln" in German,
"サロパリント" in Japanese, "Pelusas Saropa" in Spanish).

Two categories:
  - BRAND_ONLY: the entire English string IS brand name(s); the translation
    must equal the English. is_brand_only() returns True both for the explicit
    BRAND_ONLY_STRINGS set AND for any string made up of nothing but
    BRAND_TOKENS (e.g. "Crashlytics", "Docker", "Google"), so single-brand
    strings are never sent to the translator and never counted as untranslated.
  - BRAND_TOKENS: substrings that must appear verbatim inside longer
    translated strings. Used to validate translations and to shield
    brands from Google Translate via placeholder substitution.
"""

import re

# Explicit full strings that are brand-only but are NOT composed purely of
# BRAND_TOKENS, so is_brand_only()'s token derivation can't catch them on its
# own. "Saropa Lints" is the case in point: "Saropa" is a token but "Lints" is
# not, so without this set it would look half-translatable. Pure-token strings
# ("Crashlytics", "Docker", "Saropa Log Capture") do NOT need listing here.
BRAND_ONLY_STRINGS: frozenset[str] = frozenset({
    "Saropa Lints",
})

# Standalone technical acronyms/initialisms that are English in every locale.
# Judgement call (see is_acronym_only): only all-caps initialisms that are
# universally English in developer tooling. Deliberately EXCLUDED: abbreviations
# of translatable words (Dev, Perf, Ver) and log levels the project already
# translates (Error→Fehler, Warning→Warnung — so FATAL/Info/Debug stay
# translatable for consistency). Like brands, these are FORCED to English: the
# translator overwrites any prior translation so the label is uniform across
# locales (no mix of "OK" and "わかりました").
ACRONYM_ONLY_STRINGS: frozenset[str] = frozenset({
    "ANR",   # Android: Application Not Responding
    "SQL",
    "OS",    # Operating System
    "DB",    # Database
    "OK",    # universal confirm label
    "TODO",  # source-code keyword
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
    "YouTube",
    # Technical identifiers that look like words but must stay literal.
    ".saropa",
    ".slc",
    ".gitignore",
    ".env",
    "maxLogFiles",
    "google-services.json",
)


def is_brand_only(en_value: str) -> bool:
    """True if the ENTIRE string is brand name(s) and must never be translated.

    Two cases, both identity (the correct translation IS the English text):
      - an explicit full string in BRAND_ONLY_STRINGS;
      - any string that is nothing but brand tokens plus whitespace/punctuation
        once every token is shielded — e.g. "Google", "YouTube", "Crashlytics",
        "Docker", "Firebase Crashlytics", ".env".

    Without the second case, a string that is JUST a brand gets sent to the
    translator and then counted as "untranslated" forever (value == English),
    which both wastes a network call and pollutes the manual-translation gap
    report with names that must stay verbatim.
    """
    if en_value in BRAND_ONLY_STRINGS:
        return True
    shielded, replacements = shield_brands(en_value)
    if not replacements:
        return False  # contains no brand token at all — translate normally
    # Drop the placeholders; if only whitespace/punctuation remains, the whole
    # string was brand(s) and there is nothing left to translate.
    for placeholder, _brand in replacements:
        shielded = shielded.replace(placeholder, "")
    return not any(ch.isalnum() for ch in shielded)


def is_acronym_only(en_value: str) -> bool:
    """True if the whole string is a technical acronym forced English everywhere.

    Exact-match only — an acronym inside a longer sentence (e.g. "Clear SQL
    baseline") is still translated normally; just the standalone label is forced
    to English. Callers force identity (overwrite any prior translation) so the
    label is uniform across all locales.
    """
    return en_value in ACRONYM_ONLY_STRINGS


# Format placeholders like {0}, {1}, {count} are substituted at runtime and are
# not translatable text. Drop them before deciding whether a word remains.
_PLACEHOLDER_RE = re.compile(r"\{[^}]*\}")


def is_no_translatable_content(en_value: str) -> bool:
    """True if the string has no translatable word — only symbols, digits,
    punctuation, and {n} placeholders (e.g. "1 - {0}", "{0} #", "Δ #").

    Like brands/acronyms, identity IS the correct rendering: there is nothing to
    translate, so the value equals English in every locale. Without this skip a
    value==English check counts these as untranslated forever, and the translator
    round-trips them to Google for identical output on every publish.

    Translatable content = any ASCII letter (a real word or single-letter label
    that could differ per locale, e.g. a column header "A"), OR a run of two or
    more Unicode letters (a non-Latin word). A lone letter-shaped symbol such as
    "Δ" (used here as the math delta, not a word) is NOT translatable — hence the
    2+ run requirement for the non-ASCII case.
    """
    stripped = _PLACEHOLDER_RE.sub("", en_value)
    if any("a" <= ch.lower() <= "z" for ch in stripped):
        return False  # contains ASCII letters — a real word or label
    run = 0
    for ch in stripped:
        if ch.isalpha():
            run += 1
            if run >= 2:
                return False  # a non-Latin word (2+ consecutive letters)
        else:
            run = 0
    return True


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
