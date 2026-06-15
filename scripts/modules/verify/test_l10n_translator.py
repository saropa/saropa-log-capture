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


class ReassembleSentencesTests(unittest.TestCase):
    """``_reassemble_sentences`` rejoins per-sentence translations losslessly.

    It restores the original spacing/newlines (the import never carries
    separators), and refuses to build a half string: a sentence-count mismatch
    or any blank translation returns None so the caller leaves the key
    untranslated rather than storing corruption.
    """

    def _filled(self, en: str, fn) -> list[dict[str, object]]:
        # Build the per-sentence list the import reads, mapping each source
        # sentence through fn to stand in for a translator's output.
        from modules.verify.l10n_sentences import sentence_parts
        return [{"i": i, "en": p, "translation": fn(p)} for i, p in enumerate(sentence_parts(en))]

    def test_preserves_separators_on_rejoin(self) -> None:
        en = "Shows a dialog.\nType a note. Done?"
        out = translator._reassemble_sentences(en, self._filled(en, str.upper))
        self.assertEqual(out, "SHOWS A DIALOG.\nTYPE A NOTE. DONE?")

    def test_identity_fill_round_trips_to_source(self) -> None:
        en = "One.  Two.\nThree?"
        self.assertEqual(translator._reassemble_sentences(en, self._filled(en, lambda s: s)), en)

    def test_single_sentence(self) -> None:
        self.assertEqual(
            translator._reassemble_sentences("Solo", [{"i": 0, "en": "Solo", "translation": "X"}]),
            "X",
        )

    def test_count_mismatch_returns_none(self) -> None:
        # Two source sentences but only one translation provided -> skip.
        self.assertIsNone(
            translator._reassemble_sentences("A. B.", [{"i": 0, "en": "A.", "translation": "a."}]),
        )

    def test_blank_translation_returns_none(self) -> None:
        filled = [{"i": 0, "en": "A.", "translation": "a."}, {"i": 1, "en": "B.", "translation": "  "}]
        self.assertIsNone(translator._reassemble_sentences("A. B.", filled))


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
