# -*- coding: utf-8 -*-
"""Per-key translation provenance: which engine produced each locale string.

Models the Saropa Contacts pipeline's provenance system, scaled down for this
project's flat bundles. Each locale gets a sidecar ``l10n/provenance/<locale>.json``
mapping ``english_key -> engine`` (``"nllb"``, ``"google"``, …). The bundles
themselves stay plain ``{english: translation}`` maps; provenance lives beside
them so the audit can report quality and an upgrade pass can target only the
weak translations.

Quality model (matches contacts): NLLB / manual / verified-identity are high
quality; Google and the other free MT engines are low; and — critically — a
translated key with NO provenance record is treated as **untracked = low
quality**. Every translation in these bundles predates provenance tracking, so
they all classify as low until re-translated, which is exactly what lets the
"upgrade low-quality" pass sweep the old Google output into NLLB.
"""

import json
from pathlib import Path

from modules.verify.l10n_brands import (
    is_acronym_only,
    is_brand_only,
    is_no_translatable_content,
    is_verified_identical,
)

# Resolve l10n/ from this file: scripts/modules/verify/l10n_provenance.py
_MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = _MODULE_DIR.parent.parent.parent
PROVENANCE_DIR = PROJECT_ROOT / "l10n" / "provenance"

# Engine identifiers stamped into provenance.
ENGINE_NLLB = "nllb"
ENGINE_GOOGLE = "google"
ENGINE_MANUAL = "manual"
# Synthetic engine for a translated key with no provenance record. Never stored;
# inferred at classification time by absence. Always low quality.
ENGINE_UNTRACKED = "untracked"
# Synthetic engine for brand / acronym / symbol / verified-cognate keys whose
# correct value IS the English text. Inferred at classification time (never
# stored) so these never count as upgrade candidates.
ENGINE_IDENTITY = "identity"

# High quality — never an upgrade candidate.
HIGH_QUALITY_ENGINES = frozenset({
    ENGINE_NLLB, ENGINE_MANUAL, ENGINE_IDENTITY, "translation_memory", "gemini",
})
# Low quality — produced by a weaker MT engine. Upgrade candidates.
LOW_QUALITY_ENGINES = frozenset({
    ENGINE_GOOGLE, "mymemory", "libretranslate", "lingva", "argos",
    "legacy_pre_provenance",
})

# Left-to-right order for the audit table: best quality first.
ENGINE_DISPLAY_ORDER = [
    ENGINE_NLLB, "gemini", ENGINE_MANUAL, "translation_memory", ENGINE_IDENTITY,
    ENGINE_GOOGLE, "mymemory", "libretranslate", "lingva", "argos",
    "legacy_pre_provenance", ENGINE_UNTRACKED,
]


def is_low_quality(engine: str | None) -> bool:
    """True if an engine's output should be upgraded.

    Untracked (None / the untracked sentinel) and any explicitly low engine
    count as low. High-quality and identity engines do not. An unrecognized
    engine name is treated as low — better to re-translate an unknown than to
    silently trust it.
    """
    if engine is None or engine == ENGINE_UNTRACKED:
        return True
    if engine in HIGH_QUALITY_ENGINES:
        return False
    return True


def is_forced_identity(key: str, locale: str) -> bool:
    """True if the correct value for this key IS the English text.

    Brand-only, acronym-only, symbol-only, and per-locale human-verified
    cognates. These are never translated and never upgrade candidates.
    """
    return (
        is_brand_only(key)
        or is_acronym_only(key)
        or is_no_translatable_content(key)
        or is_verified_identical(key, locale)
    )


def _provenance_path(locale: str) -> Path:
    """Sidecar path for a locale's provenance, kept out of the bundle glob.

    Lives under ``l10n/provenance/`` (not ``l10n/``) so it never matches the
    ``bundle.l10n.*.json`` discovery glob and is never mistaken for a locale.
    """
    return PROVENANCE_DIR / f"{locale}.json"


def load_provenance(locale: str) -> dict[str, str]:
    """Load ``{english_key: engine}`` for a locale; {} if absent or unreadable."""
    path = _provenance_path(locale)
    if not path.exists():
        return {}
    try:
        raw = path.read_text(encoding="utf-8")
        return json.loads(raw) if raw.strip() else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_provenance(locale: str, updates: dict[str, str]) -> None:
    """Merge ``updates`` into the locale's provenance and write atomically.

    No-op when ``updates`` is empty. Existing records are kept; only the keys in
    ``updates`` are overwritten — so a partial run records what it produced
    without clobbering untouched keys. Sorted keys keep the diff stable.
    """
    if not updates:
        return
    data = load_provenance(locale)
    data.update(updates)
    PROVENANCE_DIR.mkdir(parents=True, exist_ok=True)
    path = _provenance_path(locale)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)


def classify_translated_keys(locale: str, translated_keys: set[str]) -> dict[str, int]:
    """Bucket a locale's translated keys by engine. No record → ``untracked``.

    Forced-identity keys are classified ``identity`` regardless of any stored
    value, so brand/acronym/symbol strings never inflate the low-quality count.
    """
    provenance = load_provenance(locale)
    counts: dict[str, int] = {}
    for key in translated_keys:
        if is_forced_identity(key, locale):
            engine = ENGINE_IDENTITY
        else:
            engine = provenance.get(key, ENGINE_UNTRACKED)
        counts[engine] = counts.get(engine, 0) + 1
    return counts


def quality_split(engine_counts: dict[str, int]) -> tuple[int, int]:
    """Return ``(high_quality_total, low_quality_total)`` from an engine→count map."""
    high = sum(n for eng, n in engine_counts.items() if not is_low_quality(eng))
    low = sum(n for eng, n in engine_counts.items() if is_low_quality(eng))
    return high, low
