# -*- coding: utf-8 -*-
"""Sentence segmentation shared by the translator engine and the gap export/import.

One source of truth for how a UI string is broken into translatable sentences, so
three places agree on the exact boundaries:
  - the engine's per-sentence translation (``l10n_translator``),
  - the gap export's per-sentence rows (``l10n_bundle_audit``),
  - the importer's reassembly of those rows back into whole strings.
If any two disagreed on where sentences start, reassembly would drop or merge
sentences and silently corrupt a translation.

The split is LOSSLESS: the separator whitespace between sentences is captured as
its own segment, so ``"".join(split_segments(text)) == text`` always holds. That
is what lets the importer re-split the English, replace only the sentence
segments with their translations, and rejoin with the original spacing/newlines
intact — the export never has to carry the separators.
"""

import re

# Split on whitespace that directly follows a sentence terminator (. ! ?),
# capturing the whitespace so the join round-trips exactly. Known limitation:
# "e.g. foo" over-splits at the abbreviation; UI copy rarely hits this, and the
# importer's count-match guard turns any such drift into a skipped key, never a
# corrupted one.
_SENTENCE_SPLIT_RE = re.compile(r"((?<=[.!?])\s+)")


def split_segments(text: str) -> list[str]:
    """Split text into alternating sentence and whitespace-separator segments.

    Whitespace-only segments are the separators (never translated, passed
    through verbatim); the rest are sentences. Returns a single-element list when
    the text has no internal sentence boundary.
    """
    return [seg for seg in _SENTENCE_SPLIT_RE.split(text) if seg != ""]


def sentence_parts(text: str) -> list[str]:
    """Return just the translatable sentence segments (separators removed)."""
    return [seg for seg in split_segments(text) if seg.strip()]
