# -*- coding: utf-8 -*-
"""l10n bundle audit: verify and sync VS Code translation bundles.

Source of truth: every src/l10n/strings-*.ts (symbolic key → English text),
globbed via extract_all_source_strings() — strings-a/b plus strings-viewer
(host HTML) and strings-webview (client iframe). VS Code's vscode.l10n.t() is
keyed by the English string VALUE, so bundle.l10n.json keys must be the exact
English text from those TS files.

Two bundle layers:
  1. bundle.l10n.json — English baseline (keys = English text, values = same)
  2. bundle.l10n.*.json — translation bundles (keys = English text, values =
     translated text)

This module detects:
  - MISSING: strings in TS source but absent from the English bundle
  - ORPHAN:  strings in the English bundle but absent from TS source
  - STALE:   translation entries where value == key (still English)
  - GAPS:    strings missing from individual translation bundles
"""

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from modules.verify.l10n_brands import (
    is_acronym_only,
    is_brand_only,
    is_no_translatable_content,
    validate_brands,
)

# Resolve project root from this file: scripts/modules/verify/l10n_bundle_audit.py
_MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = _MODULE_DIR.parent.parent.parent

L10N_DIR = PROJECT_ROOT / "l10n"
# Source registries are GLOBBED, not hardcoded: strings-a/b plus strings-viewer
# (host HTML) and strings-webview (client iframe), and any future split, are all
# picked up automatically so their keys sync + translate at publish without ever
# editing this module again. See plan 053.
STRINGS_DIR = PROJECT_ROOT / "src" / "l10n"
SOURCE_GLOB = "strings-*.ts"
EN_BUNDLE_PATH = L10N_DIR / "bundle.l10n.json"
REPORTS_DIR = PROJECT_ROOT / "reports"


# ---------------------------------------------------------------------------
# TS string extraction
# ---------------------------------------------------------------------------

# Match Unicode escapes like \u2026 → …
_UNICODE_RE = re.compile(r"\\u([0-9a-fA-F]{4})")


def _unescape(s: str) -> str:
    """Unescape JS string literals including \\uXXXX sequences."""
    s = _UNICODE_RE.sub(lambda m: chr(int(m.group(1), 16)), s)
    return (
        s.replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\'", "'")
        .replace('\\"', '"')
        .replace("\\\\", "\\")
    )


def extract_ts_strings(filepath: Path) -> dict[str, str]:
    """Parse a TS Record<string, string> object from source.

    Returns {symbolic_key: english_value}. Handles single-quoted,
    double-quoted, and multi-line concatenated string values.

    Why regex instead of require(): the TS files use `export const` and are
    not directly runnable by Python. The object shape is simple enough
    (string key → string value pairs) that regex extraction is reliable.
    """
    src = filepath.read_text(encoding="utf-8")
    result: dict[str, str] = {}

    # Find all 'key': positions
    key_pattern = re.compile(r"^\s*'([^']+)':\s*", re.MULTILINE)
    key_positions = [
        (m.group(1), m.end()) for m in key_pattern.finditer(src)
    ]

    for key, start in key_positions:
        remaining = src[start:]

        # Try single-quoted string
        sq = re.match(r"'((?:[^'\\]|\\.)*)'", remaining)
        if sq:
            result[key] = _unescape(sq.group(1))
            continue

        # Try double-quoted string
        dq = re.match(r'"((?:[^"\\]|\\.)*)"', remaining)
        if dq:
            result[key] = _unescape(dq.group(1))
            continue

        # Multi-line concatenated string: collect all quoted parts up to
        # the trailing comma that ends the property.
        comma_pos = remaining.find(",\n")
        if comma_pos == -1:
            # Last property before closing brace.
            comma_pos = remaining.find("\n}")
        if comma_pos != -1:
            raw = remaining[:comma_pos]
            parts: list[str] = []
            for part_match in re.finditer(
                r"""['"]([^'"\\]*(?:\\.[^'"\\]*)*)['"]""", raw
            ):
                parts.append(_unescape(part_match.group(1)))
            if parts:
                result[key] = "".join(parts)

    return result


def extract_all_source_strings() -> dict[str, str]:
    """Merge {symbolic_key: english} from every src/l10n/strings-*.ts file.

    Globbed so new registries (strings-viewer, strings-webview, future splits)
    flow through audit/sync/translate automatically. Sorted for a deterministic
    merge; keys are namespaced per file so collisions are not expected.
    """
    merged: dict[str, str] = {}
    for path in sorted(STRINGS_DIR.glob(SOURCE_GLOB)):
        merged.update(extract_ts_strings(path))
    return merged


def _build_en_to_sym_key_map() -> dict[str, str]:
    """Build reverse lookup: English value → symbolic key.

    When multiple symbolic keys share the same English value, the first
    one wins (alphabetically). This is for human-readable reports only.
    """
    all_strings = extract_all_source_strings()
    # Reverse: value → key. First key wins for duplicates.
    reverse: dict[str, str] = {}
    for sym_key, en_val in all_strings.items():
        if en_val not in reverse:
            reverse[en_val] = sym_key
    return reverse


# ---------------------------------------------------------------------------
# Audit data structures
# ---------------------------------------------------------------------------


@dataclass
class UntranslatedEntry:
    """One string that a locale has not translated."""

    en_value: str
    sym_key: str
    # "missing" = not in bundle at all; "untranslated" = value == English.
    reason: str
    locale_value: str | None


@dataclass
class LocaleCoverage:
    """Translation coverage for a single locale."""

    locale: str
    total_keys: int
    missing_count: int
    untranslated_count: int
    orphan_count: int
    translated_count: int
    # Per-string detail of what's NOT translated.
    untranslated_entries: list[UntranslatedEntry] = field(
        default_factory=list,
    )

    @property
    def pct(self) -> float:
        if self.total_keys == 0:
            return 0.0
        return (self.translated_count / self.total_keys) * 100


@dataclass
class AuditResult:
    """Complete audit outcome for the l10n bundle system."""

    # Source vs English bundle
    source_key_count: int
    bundle_key_count: int
    missing_from_bundle: list[tuple[str, str]] = field(default_factory=list)
    orphan_in_bundle: list[str] = field(default_factory=list)

    # Per-locale coverage
    locale_coverage: list[LocaleCoverage] = field(default_factory=list)

    @property
    def is_english_complete(self) -> bool:
        return len(self.missing_from_bundle) == 0

    @property
    def has_gaps(self) -> bool:
        """True if any locale has missing or untranslated strings."""
        return any(
            lc.missing_count > 0 or lc.untranslated_count > 0
            for lc in self.locale_coverage
        )


# ---------------------------------------------------------------------------
# Core audit
# ---------------------------------------------------------------------------


def run_audit() -> AuditResult:
    """Run a full l10n bundle audit. Pure data — no console output."""
    all_strings = extract_all_source_strings()
    en_to_sym = _build_en_to_sym_key_map()

    # English values are the bundle keys (VS Code l10n convention).
    expected_values = set(all_strings.values())

    en_bundle: dict[str, str] = json.loads(
        EN_BUNDLE_PATH.read_text(encoding="utf-8")
    )
    en_keys = set(en_bundle.keys())

    # Missing from English bundle
    missing = [
        (sym_key, en_val)
        for sym_key, en_val in all_strings.items()
        if en_val not in en_keys
    ]

    # Orphan in English bundle (not in TS source)
    orphan = [k for k in en_keys if k not in expected_values]

    # Translation bundles
    translation_files = sorted(
        f
        for f in os.listdir(L10N_DIR)
        if f.startswith("bundle.l10n.")
        and f.endswith(".json")
        and f != "bundle.l10n.json"
    )

    locale_coverage: list[LocaleCoverage] = []
    for fname in translation_files:
        locale = fname.replace("bundle.l10n.", "").replace(".json", "")
        bundle: dict[str, str] = json.loads(
            (L10N_DIR / fname).read_text(encoding="utf-8")
        )
        bundle_keys = set(bundle.keys())

        missing_keys = [
            k for k in expected_values if k not in bundle_keys
        ]
        orphan_count = sum(
            1 for k in bundle_keys if k not in expected_values
        )
        # Untranslated = value identical to English AND none of: a brand-only
        # string, a technical acronym, or a symbol-only string with no word.
        # Brand-only ("Saropa Lints"), acronyms ("SQL", "ANR"), and symbol-only
        # ("1 - {0}", "{0} #", "Δ #") are correctly identical to English —
        # identity IS the translation, so they must not be counted as gaps.
        untranslated_keys = [
            k
            for k in bundle_keys
            if k in expected_values
            and bundle[k] == k
            and not is_brand_only(k)
            and not is_acronym_only(k)
            and not is_no_translatable_content(k)
        ]
        # Brand-mangled = translated but a brand token got transliterated
        # or removed (e.g. "Saropa Log Capture" → "Saropa-Protokollerfassung").
        brand_mangled_keys = [
            k
            for k in bundle_keys
            if k in expected_values
            and bundle[k] != k
            and validate_brands(k, bundle[k])
        ]
        translated_count = (
            len(expected_values)
            - len(missing_keys)
            - len(untranslated_keys)
            - len(brand_mangled_keys)
        )

        # Build per-string detail for everything NOT correctly translated.
        entries: list[UntranslatedEntry] = []
        for en_val in missing_keys:
            entries.append(UntranslatedEntry(
                en_value=en_val,
                sym_key=en_to_sym.get(en_val, "?"),
                reason="missing",
                locale_value=None,
            ))
        for en_val in untranslated_keys:
            entries.append(UntranslatedEntry(
                en_value=en_val,
                sym_key=en_to_sym.get(en_val, "?"),
                reason="untranslated",
                locale_value=bundle.get(en_val),
            ))
        for en_val in brand_mangled_keys:
            mangled = validate_brands(en_val, bundle[en_val])
            entries.append(UntranslatedEntry(
                en_value=en_val,
                sym_key=en_to_sym.get(en_val, "?"),
                reason=f"brand_mangled:{','.join(mangled)}",
                locale_value=bundle.get(en_val),
            ))
        # Sort by symbolic key for stable output.
        entries.sort(key=lambda e: e.sym_key)

        locale_coverage.append(
            LocaleCoverage(
                locale=locale,
                total_keys=len(expected_values),
                missing_count=len(missing_keys),
                untranslated_count=len(untranslated_keys) + len(brand_mangled_keys),
                orphan_count=orphan_count,
                translated_count=translated_count,
                untranslated_entries=entries,
            )
        )

    return AuditResult(
        source_key_count=len(all_strings),
        bundle_key_count=len(en_keys),
        missing_from_bundle=missing,
        orphan_in_bundle=orphan,
        locale_coverage=locale_coverage,
    )


# ---------------------------------------------------------------------------
# Audit report — timestamped JSON written to reports/
# ---------------------------------------------------------------------------


def write_audit_report(audit: AuditResult) -> Path:
    """Write a full audit report as timestamped JSON under reports/.

    Returns the path to the written file.
    Report follows the project convention:
      reports/YYYY.MM/YYYY.MM.DD/YYYYMMDD_HHMMSS_l10n_audit.json
    """
    now = datetime.now()
    month_dir = REPORTS_DIR / now.strftime("%Y.%m")
    day_dir = month_dir / now.strftime("%Y.%m.%d")
    day_dir.mkdir(parents=True, exist_ok=True)

    filename = now.strftime("%Y%m%d_%H%M%S") + "_l10n_audit.json"
    report_path = day_dir / filename

    # Build per-locale gap detail.
    locales_detail: dict[str, object] = {}
    for lc in audit.locale_coverage:
        entries_out = []
        for entry in lc.untranslated_entries:
            entries_out.append({
                "sym_key": entry.sym_key,
                "en": entry.en_value,
                "reason": entry.reason,
                "locale_value": entry.locale_value,
            })
        locales_detail[lc.locale] = {
            "total": lc.total_keys,
            "translated": lc.translated_count,
            "missing": lc.missing_count,
            "untranslated": lc.untranslated_count,
            "orphan": lc.orphan_count,
            "pct": round(lc.pct, 1),
            "entries": entries_out,
        }

    total_gaps = sum(
        lc.missing_count + lc.untranslated_count
        for lc in audit.locale_coverage
    )

    payload: dict[str, object] = {
        "schema_version": 1,
        "generated": now.isoformat(timespec="seconds"),
        "source_key_count": audit.source_key_count,
        "bundle_key_count": audit.bundle_key_count,
        "missing_from_english_bundle": len(audit.missing_from_bundle),
        "orphan_in_english_bundle": len(audit.orphan_in_bundle),
        "total_locale_gaps": total_gaps,
        "locales": locales_detail,
    }

    report_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report_path


# ---------------------------------------------------------------------------
# Gap export — CSV / JSON for reimporting failed translations
# ---------------------------------------------------------------------------


def write_gap_export(
    audit: AuditResult,
    fmt: str = "json",
) -> Path | None:
    """Export untranslated entries to CSV or JSON for external translation.

    The export contains every (locale, sym_key, en_value) tuple that still
    needs translation. A translator or AI tool fills the ``translation``
    column/field and the file can be reimported later.

    Returns the path, or None if there are no gaps.
    """
    rows: list[dict[str, str | None]] = []
    for lc in audit.locale_coverage:
        for entry in lc.untranslated_entries:
            rows.append({
                "locale": lc.locale,
                "sym_key": entry.sym_key,
                "en": entry.en_value,
                "reason": entry.reason,
                "locale_value": entry.locale_value,
                # Empty column for the translator to fill in.
                "translation": "",
            })

    if not rows:
        return None

    now = datetime.now()
    month_dir = REPORTS_DIR / now.strftime("%Y.%m")
    day_dir = month_dir / now.strftime("%Y.%m.%d")
    day_dir.mkdir(parents=True, exist_ok=True)

    stem = now.strftime("%Y%m%d_%H%M%S") + "_l10n_gaps"

    if fmt == "csv":
        import csv
        export_path = day_dir / (stem + ".csv")
        with open(export_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "locale", "sym_key", "en",
                    "reason", "locale_value", "translation",
                ],
            )
            writer.writeheader()
            writer.writerows(rows)
    else:
        export_path = day_dir / (stem + ".json")
        payload = {
            "schema_version": 1,
            "generated": now.isoformat(timespec="seconds"),
            "description": (
                "Fill the 'translation' field for each entry, "
                "then reimport with: "
                "python scripts/translate_l10n.py --import <file>"
            ),
            "total_gaps": len(rows),
            "entries": rows,
        }
        export_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    return export_path


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------


def sync_english_bundle() -> tuple[int, int, int]:
    """Update bundle.l10n.json to match TS source strings.

    Returns (added, kept, removed). Orphan keys are dropped; new keys are
    added as identity maps (English → English). Existing values are preserved.
    """
    all_strings = extract_all_source_strings()

    en_bundle: dict[str, str] = json.loads(
        EN_BUNDLE_PATH.read_text(encoding="utf-8")
    )
    en_keys = set(en_bundle.keys())
    expected_values = set(all_strings.values())

    new_bundle: dict[str, str] = {}
    added = 0
    kept = 0

    for en_value in all_strings.values():
        if en_value in new_bundle:
            # Duplicate English value across multiple symbolic keys — already added.
            continue
        if en_value in en_keys:
            new_bundle[en_value] = en_bundle[en_value]
            kept += 1
        else:
            new_bundle[en_value] = en_value
            added += 1

    removed = sum(1 for k in en_keys if k not in expected_values)

    # Atomic write: write to .tmp then rename so an interrupted sync never
    # leaves a truncated bundle on disk.
    tmp = EN_BUNDLE_PATH.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(new_bundle, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    tmp.replace(EN_BUNDLE_PATH)

    return added, kept, removed
