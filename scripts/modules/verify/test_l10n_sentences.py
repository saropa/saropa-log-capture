# -*- coding: utf-8 -*-
"""Pure-logic tests for the shared sentence segmenter.

``split_segments`` is the single source of truth three places depend on (engine
translation, gap export, import reassembly), so its two guarantees are pinned
here: the split is LOSSLESS (join reproduces the source, so spacing/newlines
survive reassembly) and a string with no internal boundary stays one segment.

Run from scripts/:
    python -m unittest modules.verify.test_l10n_sentences
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from modules.verify.l10n_sentences import sentence_parts, split_segments  # noqa: E402


class SplitSegmentsTests(unittest.TestCase):
    """``split_segments`` keeps separators so the join round-trips exactly."""

    def test_single_sentence_is_one_segment(self) -> None:
        self.assertEqual(split_segments("Hello world"), ["Hello world"])

    def test_multi_sentence_keeps_separators(self) -> None:
        self.assertEqual(
            split_segments("Foo bar. Baz qux! Done?"),
            ["Foo bar.", " ", "Baz qux!", " ", "Done?"],
        )

    def test_round_trip_is_lossless_including_newlines(self) -> None:
        for text in ("Line one.\nLine two.", "Multiple!  Spaces.  Here.", "Trailing. "):
            with self.subTest(text=text):
                self.assertEqual("".join(split_segments(text)), text)


class SentencePartsTests(unittest.TestCase):
    """``sentence_parts`` returns only translatable segments (no separators)."""

    def test_drops_separator_segments(self) -> None:
        self.assertEqual(
            sentence_parts("One.\nTwo. Three?"),
            ["One.", "Two.", "Three?"],
        )

    def test_single_sentence_is_one_part(self) -> None:
        self.assertEqual(sentence_parts("Just one"), ["Just one"])


if __name__ == "__main__":
    unittest.main()
