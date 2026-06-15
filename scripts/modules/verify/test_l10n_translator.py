# -*- coding: utf-8 -*-
"""Pure-logic tests for the l10n translator's persistence helper.

These cover only the parts that need no model, no CTranslate2, and no network:
the orphan-prune / save split extracted as ``_finalize_locale``. The translation
loop itself (``translate_locale``) is not exercised here — it requires a
translator engine and writes real bundles, which is out of scope for a unit test.

``_finalize_locale`` is the half of graceful-CTRL-C that runs from
``translate_locale``'s ``finally``: a cancelled multi-hour run must still persist
everything translated so far so a re-run resumes. The dry-run path lets us assert
the orphan prune in isolation without writing a bundle to disk.

Run from scripts/:
    python -m unittest modules.verify.test_l10n_translator
"""

import sys
import unittest
from pathlib import Path

# l10n_translator imports via ``modules.verify.*``, so scripts/ must be on path.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from modules.verify import l10n_translator as translator  # noqa: E402


class FinalizeLocaleTests(unittest.TestCase):
    """``_finalize_locale`` prunes orphan keys; dry_run writes nothing."""

    def test_prunes_keys_absent_from_canonical_set(self) -> None:
        # An orphan is a bundle key no longer in the source's canonical set.
        bundle = {"Hello": "Hallo", "StaleKey": "veraltet"}
        translator._finalize_locale(
            Path("does-not-exist.json"), bundle, {"Hello"}, "de", {},
            dry_run=True,
        )
        self.assertEqual(bundle, {"Hello": "Hallo"})

    def test_keeps_all_canonical_keys(self) -> None:
        bundle = {"A": "a", "B": "b"}
        translator._finalize_locale(
            Path("does-not-exist.json"), bundle, {"A", "B"}, "de", {},
            dry_run=True,
        )
        self.assertEqual(bundle, {"A": "a", "B": "b"})

    def test_dry_run_does_not_write_a_file(self) -> None:
        # dry_run must never touch disk — the path here intentionally does not
        # exist, so a stray write would surface as a file appearing on disk.
        target = Path(__file__).resolve().parent / "should-never-be-written.json"
        self.assertFalse(target.exists())
        translator._finalize_locale(
            target, {"A": "a"}, {"A"}, "de", {}, dry_run=True,
        )
        self.assertFalse(target.exists())


class SplitSentencesTests(unittest.TestCase):
    """``_split_sentences`` underpins sentence-by-sentence translation.

    The split MUST be lossless ("".join(parts) == original) so rejoining
    translated sentences preserves the source's spacing and newlines verbatim;
    a string with no internal boundary must stay a single segment so it routes
    through the whole-string (paragraph) path unchanged.
    """

    def test_single_sentence_is_one_segment(self) -> None:
        self.assertEqual(translator._split_sentences("Hello world"), ["Hello world"])

    def test_multi_sentence_splits_and_keeps_separators(self) -> None:
        self.assertEqual(
            translator._split_sentences("Foo bar. Baz qux! Done?"),
            ["Foo bar.", " ", "Baz qux!", " ", "Done?"],
        )

    def test_round_trip_is_lossless_including_newlines(self) -> None:
        # Newlines and multi-space gaps are captured as separator segments, so
        # joining the parts reproduces the original exactly.
        for text in ("Line one.\nLine two.", "Multiple!  Spaces.  Here.", "Trailing. "):
            with self.subTest(text=text):
                self.assertEqual("".join(translator._split_sentences(text)), text)


class SentenceModeToggleTests(unittest.TestCase):
    """``set_sentence_mode`` flips the module flag the engine path reads."""

    def tearDown(self) -> None:
        # Restore the default so test order cannot leak the flag.
        translator.set_sentence_mode(True)

    def test_toggle_off_then_on(self) -> None:
        translator.set_sentence_mode(False)
        self.assertFalse(translator._translate_by_sentence_enabled)
        translator.set_sentence_mode(True)
        self.assertTrue(translator._translate_by_sentence_enabled)


if __name__ == "__main__":
    unittest.main()
