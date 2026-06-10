# -*- coding: utf-8 -*-
"""Pure-logic tests for the NLLB translation engine.

These cover only the parts that need no model, no CTranslate2, and no network:
the FLORES locale mapping, format-placeholder masking, cache-dir candidate
ordering, and the availability gate under ``SAROPA_SKIP_NLLB``. The model load
and actual translation are deliberately NOT exercised here — they require the
~7 GB model and a translation run, which is out of scope for a unit test.

Run standalone (no project deps required):
    python -m unittest scripts.modules.verify.test_l10n_nllb_engine
    # or, from scripts/:
    python -m unittest modules.verify.test_l10n_nllb_engine
"""

import os
import sys
import unittest
from pathlib import Path

# Allow ``import l10n_nllb_engine`` whether run from repo root or scripts/.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import l10n_nllb_engine as engine  # noqa: E402


class FloresCodeTests(unittest.TestCase):
    """``_flores_code`` maps bundle locales to FLORES-200 identifiers."""

    def test_exact_locales_map_to_flores(self) -> None:
        self.assertEqual(engine._flores_code("de"), "deu_Latn")
        self.assertEqual(engine._flores_code("ja"), "jpn_Jpan")
        self.assertEqual(engine._flores_code("ko"), "kor_Hang")
        self.assertEqual(engine._flores_code("ru"), "rus_Cyrl")

    def test_chinese_variants_distinguished(self) -> None:
        # Simplified vs Traditional must not collapse to the same script.
        self.assertEqual(engine._flores_code("zh-cn"), "zho_Hans")
        self.assertEqual(engine._flores_code("zh-tw"), "zho_Hant")

    def test_region_subtag_falls_back_to_base(self) -> None:
        # pt-br is not a FLORES code; the base "pt" carries the mapping.
        self.assertEqual(engine._flores_code("pt-br"), "por_Latn")

    def test_case_insensitive(self) -> None:
        self.assertEqual(engine._flores_code("DE"), "deu_Latn")
        self.assertEqual(engine._flores_code("ZH-TW"), "zho_Hant")

    def test_unknown_locale_returns_none(self) -> None:
        self.assertIsNone(engine._flores_code("xx"))
        self.assertIsNone(engine._flores_code(""))


class PlaceholderMaskingTests(unittest.TestCase):
    """Format placeholders survive a mask/translate/unmask round trip."""

    def test_round_trip_preserves_placeholders(self) -> None:
        src = "Showing {0} of {count} logs"
        masked, tokens = engine._mask_format_placeholders(src)
        # The braces are gone from the masked text (NLLB would mangle them)...
        self.assertNotIn("{", masked)
        self.assertEqual(len(tokens), 2)
        # ...and restored exactly on unmask.
        self.assertEqual(engine._unmask(masked, tokens), src)

    def test_no_placeholders_is_identity(self) -> None:
        src = "Clear all logs"
        masked, tokens = engine._mask_format_placeholders(src)
        self.assertEqual(masked, src)
        self.assertEqual(tokens, {})
        self.assertEqual(engine._unmask(masked, tokens), src)

    def test_complex_placeholder_bodies(self) -> None:
        src = "{0,number} items, {name}"
        masked, tokens = engine._mask_format_placeholders(src)
        self.assertEqual(engine._unmask(masked, tokens), src)


class CacheDirTests(unittest.TestCase):
    """Candidate cache dirs include the HF default and the contacts location."""

    def test_includes_hf_default_and_meta_nllb(self) -> None:
        # No env override -> first candidate is the HF default (None), and the
        # contacts ``tools/meta_nllb`` convention is always probed as a fallback.
        previous = os.environ.pop("SAROPA_NLLB_MODEL_DIR", None)
        try:
            candidates = engine._candidate_cache_dirs()
        finally:
            if previous is not None:
                os.environ["SAROPA_NLLB_MODEL_DIR"] = previous
        self.assertIn(None, candidates)
        self.assertTrue(any(
            c and c.replace("\\", "/").endswith("tools/meta_nllb")
            for c in candidates
        ))

    def test_env_override_takes_priority(self) -> None:
        previous = os.environ.get("SAROPA_NLLB_MODEL_DIR")
        os.environ["SAROPA_NLLB_MODEL_DIR"] = "/some/explicit/dir"
        try:
            candidates = engine._candidate_cache_dirs()
        finally:
            if previous is None:
                os.environ.pop("SAROPA_NLLB_MODEL_DIR", None)
            else:
                os.environ["SAROPA_NLLB_MODEL_DIR"] = previous
        self.assertEqual(candidates[0], "/some/explicit/dir")


class AvailabilityGateTests(unittest.TestCase):
    """``is_available`` honors the kill switch without loading anything."""

    def test_skip_env_forces_unavailable(self) -> None:
        previous = os.environ.get("SAROPA_SKIP_NLLB")
        os.environ["SAROPA_SKIP_NLLB"] = "1"
        try:
            self.assertFalse(engine.is_available())
        finally:
            if previous is None:
                os.environ.pop("SAROPA_SKIP_NLLB", None)
            else:
                os.environ["SAROPA_SKIP_NLLB"] = previous


if __name__ == "__main__":
    unittest.main()
