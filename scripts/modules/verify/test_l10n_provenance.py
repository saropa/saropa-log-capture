# -*- coding: utf-8 -*-
"""Pure-logic tests for the translation provenance taxonomy.

Cover the quality model (which engines are low quality, the high/low split, and
the untracked-as-low rule) and identity detection — no disk writes, no model.
The on-disk load/save round trip and the audit classification are exercised by
the audit smoke run, not here.

Run standalone:
    python -m unittest modules.verify.test_l10n_provenance
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import l10n_provenance as prov  # noqa: E402


class QualityModelTests(unittest.TestCase):
    """is_low_quality encodes the upgrade-candidate rule."""

    def test_strong_engines_are_high_quality(self) -> None:
        for engine in (prov.ENGINE_NLLB, prov.ENGINE_MANUAL, prov.ENGINE_IDENTITY):
            self.assertFalse(prov.is_low_quality(engine), engine)

    def test_google_is_low_quality(self) -> None:
        self.assertTrue(prov.is_low_quality(prov.ENGINE_GOOGLE))

    def test_untracked_and_none_are_low_quality(self) -> None:
        # The crux: an un-attributed translation is an upgrade candidate.
        self.assertTrue(prov.is_low_quality(None))
        self.assertTrue(prov.is_low_quality(prov.ENGINE_UNTRACKED))

    def test_unknown_engine_treated_as_low(self) -> None:
        # Better to re-translate an unknown than to silently trust it.
        self.assertTrue(prov.is_low_quality("some_future_engine"))


class QualitySplitTests(unittest.TestCase):
    """quality_split partitions an engine→count map into (high, low)."""

    def test_split_counts(self) -> None:
        counts = {
            prov.ENGINE_NLLB: 70,
            prov.ENGINE_IDENTITY: 25,
            prov.ENGINE_GOOGLE: 100,
            prov.ENGINE_UNTRACKED: 1173,
        }
        high, low = prov.quality_split(counts)
        self.assertEqual(high, 95)        # nllb + identity
        self.assertEqual(low, 1273)       # google + untracked

    def test_empty_is_zero_zero(self) -> None:
        self.assertEqual(prov.quality_split({}), (0, 0))


class IdentityTests(unittest.TestCase):
    """is_forced_identity flags strings whose correct value IS English."""

    def test_brand_only_is_identity(self) -> None:
        self.assertTrue(prov.is_forced_identity("Saropa", "de"))

    def test_ordinary_string_is_not_identity(self) -> None:
        self.assertFalse(prov.is_forced_identity("Clear all logs", "de"))


if __name__ == "__main__":
    unittest.main()
