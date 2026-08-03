# -*- coding: utf-8 -*-
"""Tests for sentinel-based brand shielding.

Cover the shield/unshield round-trip, sentinel format, case-insensitive
restore, and character-doubling tolerance.

Run from scripts/:
    python -m unittest modules.verify.test_l10n_brands
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from modules.verify.l10n_brands import (  # noqa: E402
    _sentinel,
    shield_brands,
    unshield_brands,
)


class SentinelFormatTests(unittest.TestCase):
    """Sentinel tokens follow the XBQ<L1><L2>VKZ pattern."""

    def test_length_is_eight(self) -> None:
        self.assertEqual(len(_sentinel(0)), 8)

    def test_starts_with_xbq_ends_with_vkz(self) -> None:
        s = _sentinel(0)
        self.assertTrue(s.startswith("XBQ"))
        self.assertTrue(s.endswith("VKZ"))

    def test_distinct_sentinels(self) -> None:
        seen = {_sentinel(i) for i in range(20)}
        self.assertEqual(len(seen), 20)

    def test_no_digits(self) -> None:
        for i in range(20):
            self.assertFalse(any(c.isdigit() for c in _sentinel(i)))


class ShieldUnshieldRoundTripTests(unittest.TestCase):
    """shield_brands + unshield_brands is lossless."""

    def test_round_trip_restores_original(self) -> None:
        original = "Configure Saropa Log Capture in VS Code"
        shielded, replacements = shield_brands(original)
        self.assertNotEqual(shielded, original)
        restored = unshield_brands(shielded, replacements)
        self.assertEqual(restored, original)

    def test_no_brands_is_identity(self) -> None:
        text = "Click the button to continue"
        shielded, replacements = shield_brands(text)
        self.assertEqual(shielded, text)
        self.assertEqual(replacements, [])

    def test_multiple_brands(self) -> None:
        text = "Use Saropa Log Capture with Google"
        shielded, replacements = shield_brands(text)
        self.assertEqual(len(replacements), 2)
        restored = unshield_brands(shielded, replacements)
        self.assertEqual(restored, text)


class UnshieldToleranceTests(unittest.TestCase):
    """unshield_brands handles MT engine corruption of sentinels."""

    def test_case_insensitive_restore(self) -> None:
        original = "Open Saropa settings"
        shielded, replacements = shield_brands(original)
        lowered = shielded.lower()
        restored = unshield_brands(lowered, replacements)
        self.assertIn("Saropa", restored)

    def test_character_doubling_restore(self) -> None:
        original = "Open Saropa settings"
        shielded, replacements = shield_brands(original)
        # Simulate character doubling on the sentinel
        sentinel = replacements[0][0]
        doubled = "".join(c * 2 for c in sentinel)
        corrupted = shielded.replace(sentinel, doubled)
        restored = unshield_brands(corrupted, replacements)
        self.assertIn("Saropa", restored)


if __name__ == "__main__":
    unittest.main()
