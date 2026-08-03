# -*- coding: utf-8 -*-
"""Tests for the round-trip translation quality audit.

Cover similarity scoring, key sampling, and reverse prompt construction
without requiring Ollama to be running.

Run from scripts/:
    python -m unittest modules.verify.test_l10n_quality_audit
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from modules.verify.l10n_quality_audit import (  # noqa: E402
    _reverse_prompt,
    _sample_keys,
    _similarity,
    _word_set,
)


class WordSetTests(unittest.TestCase):
    """_word_set tokenizes and lowercases."""

    def test_basic_tokens(self) -> None:
        result = _word_set("Hello World")
        self.assertEqual(result, {"hello", "world"})

    def test_strips_punctuation(self) -> None:
        result = _word_set("Hello, world!")
        self.assertEqual(result, {"hello", "world"})


class SimilarityTests(unittest.TestCase):
    """Jaccard similarity scoring."""

    def test_identical_strings(self) -> None:
        self.assertEqual(_similarity("hello world", "hello world"), 1.0)

    def test_completely_different(self) -> None:
        self.assertEqual(_similarity("hello world", "foo bar"), 0.0)

    def test_partial_overlap(self) -> None:
        sim = _similarity("hello world foo", "hello world bar")
        self.assertGreater(sim, 0.3)
        self.assertLess(sim, 1.0)

    def test_empty_strings(self) -> None:
        self.assertEqual(_similarity("", ""), 1.0)

    def test_one_empty(self) -> None:
        self.assertEqual(_similarity("hello", ""), 0.0)


class SampleKeysTests(unittest.TestCase):
    """_sample_keys filters and samples correctly."""

    def test_skips_brand_only(self) -> None:
        english = {"k1": "Saropa Log Capture"}
        bundle = {"k1": "Saropa Log Capture"}
        result = _sample_keys(english, bundle, 10)
        self.assertEqual(result, [])

    def test_skips_untranslated(self) -> None:
        english = {"k1": "Click the button to start the process"}
        bundle = {"k1": "Click the button to start the process"}
        result = _sample_keys(english, bundle, 10)
        self.assertEqual(result, [])

    def test_skips_short_strings(self) -> None:
        english = {"k1": "OK"}
        bundle = {"k1": "Aceptar"}
        result = _sample_keys(english, bundle, 10)
        self.assertEqual(result, [])

    def test_includes_real_translations(self) -> None:
        english = {"k1": "Click the button to start the process"}
        bundle = {"k1": "Klicken Sie auf die Schaltfläche"}
        result = _sample_keys(english, bundle, 10)
        self.assertEqual(result, ["k1"])


class ReversePromptTests(unittest.TestCase):
    """_reverse_prompt builds correct back-translation prompts."""

    def test_contains_language_name(self) -> None:
        prompt = _reverse_prompt("Hallo Welt", "de")
        self.assertIn("German", prompt)

    def test_contains_translated_text(self) -> None:
        prompt = _reverse_prompt("Hallo Welt", "de")
        self.assertIn("Hallo Welt", prompt)

    def test_asks_for_english(self) -> None:
        prompt = _reverse_prompt("Bonjour", "fr")
        self.assertIn("English", prompt)


if __name__ == "__main__":
    unittest.main()
