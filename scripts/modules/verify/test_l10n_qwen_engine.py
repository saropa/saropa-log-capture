# -*- coding: utf-8 -*-
"""Pure-logic tests for the Qwen translation engine.

Cover prompt building, think-block stripping, model selection, and locale
info without requiring Ollama to be running.

Run from scripts/:
    python -m unittest modules.verify.test_l10n_qwen_engine
"""

import json
import os
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from modules.verify import l10n_qwen_engine as engine  # noqa: E402


class NormalizeModelNameTests(unittest.TestCase):
    """_normalize_model_name strips digest and :latest suffixes."""

    def test_no_suffix(self) -> None:
        self.assertEqual(engine._normalize_model_name("qwen3:8b"), "qwen3:8b")

    def test_strips_digest(self) -> None:
        self.assertEqual(
            engine._normalize_model_name("qwen3:8b@sha256:abc123"),
            "qwen3:8b",
        )

    def test_strips_latest(self) -> None:
        self.assertEqual(
            engine._normalize_model_name("qwen3:latest"),
            "qwen3",
        )

    def test_strips_both(self) -> None:
        self.assertEqual(
            engine._normalize_model_name("qwen3:latest@sha256:abc"),
            "qwen3",
        )


class HasModelTests(unittest.TestCase):
    """_has_model normalizes names before comparing."""

    def _fake_tags(self, names: list[str]) -> str:
        models = [{"name": n} for n in names]
        return json.dumps({"models": models}).encode("utf-8")

    def test_exact_match(self) -> None:
        from unittest.mock import MagicMock
        resp = MagicMock()
        resp.__enter__ = lambda s: s
        resp.__exit__ = MagicMock(return_value=False)
        resp.read.return_value = self._fake_tags(["qwen3:8b"])
        resp.status = 200
        with patch("urllib.request.urlopen", return_value=resp):
            with patch.object(engine, "QWEN_MODEL_TAG", "qwen3:8b"):
                self.assertTrue(engine._has_model())

    def test_digest_suffix_still_matches(self) -> None:
        from unittest.mock import MagicMock
        resp = MagicMock()
        resp.__enter__ = lambda s: s
        resp.__exit__ = MagicMock(return_value=False)
        resp.read.return_value = self._fake_tags(
            ["qwen3:8b@sha256:abc123"]
        )
        resp.status = 200
        with patch("urllib.request.urlopen", return_value=resp):
            with patch.object(engine, "QWEN_MODEL_TAG", "qwen3:8b"):
                self.assertTrue(engine._has_model())

    def test_latest_suffix_still_matches(self) -> None:
        """If tags list has 'qwen3:latest', it matches SAROPA_QWEN_MODEL='qwen3'."""
        from unittest.mock import MagicMock
        resp = MagicMock()
        resp.__enter__ = lambda s: s
        resp.__exit__ = MagicMock(return_value=False)
        resp.read.return_value = self._fake_tags(["qwen3:latest"])
        resp.status = 200
        with patch("urllib.request.urlopen", return_value=resp):
            with patch.object(engine, "QWEN_MODEL_TAG", "qwen3"):
                self.assertTrue(engine._has_model())


class PromptBuildingTests(unittest.TestCase):
    """_build_prompt produces engine-ready prompts."""

    def test_contains_target_language(self) -> None:
        prompt = engine._build_prompt("Hello", "de")
        self.assertIn("German", prompt)

    def test_contains_source_text(self) -> None:
        prompt = engine._build_prompt("Click to start", "fr")
        self.assertIn("Click to start", prompt)

    def test_script_constraint_for_japanese(self) -> None:
        prompt = engine._build_prompt("Hello", "ja")
        self.assertIn("Japanese (Hiragana, Katakana, or Kanji)", prompt)

    def test_no_script_constraint_for_latin(self) -> None:
        prompt = engine._build_prompt("Hello", "de")
        self.assertNotIn("EVERY character", prompt)

    def test_script_constraint_for_russian(self) -> None:
        prompt = engine._build_prompt("Hello", "ru")
        self.assertIn("Cyrillic", prompt)

    def test_unknown_locale_uses_code_as_label(self) -> None:
        prompt = engine._build_prompt("Hello", "xx-yy")
        self.assertIn("xx-yy", prompt)

    def test_vs_code_context_mentioned(self) -> None:
        prompt = engine._build_prompt("Hello", "de")
        self.assertIn("VS Code", prompt)


class ThinkBlockStrippingTests(unittest.TestCase):
    """The call response cleaner strips <think> blocks."""

    def _strip(self, text: str) -> str:
        """Apply the same regex chain _call_ollama uses."""
        text = re.sub(r"(?s)<think>.*?</think>", "", text)
        text = re.sub(r"(?s)<think>.*\Z", "", text).strip()
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1].strip()
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1].strip()
        return text

    def test_strips_closed_think_block(self) -> None:
        self.assertEqual(self._strip("<think>reasoning</think>Hallo"), "Hallo")

    def test_strips_unclosed_think_block(self) -> None:
        self.assertEqual(self._strip("<think>still thinking"), "")

    def test_strips_surrounding_quotes(self) -> None:
        self.assertEqual(self._strip('"Hallo"'), "Hallo")
        self.assertEqual(self._strip("'Hallo'"), "Hallo")

    def test_preserves_clean_text(self) -> None:
        self.assertEqual(self._strip("Hallo Welt"), "Hallo Welt")


class ModelSelectionTests(unittest.TestCase):
    """GPU-aware model selection logic."""

    def test_no_gpu_defaults_to_8b(self) -> None:
        with patch.object(engine, "_detect_gpu_vram_gb", return_value=None):
            tag, stamp, _, note = engine._select_qwen_model()
        self.assertEqual(tag, "qwen3:8b")
        self.assertIn("no NVIDIA GPU", note)

    def test_large_gpu_gets_14b(self) -> None:
        with patch.object(engine, "_detect_gpu_vram_gb", return_value=16.0):
            tag, _, _, _ = engine._select_qwen_model()
        self.assertEqual(tag, "qwen3:14b")

    def test_small_gpu_gets_4b(self) -> None:
        with patch.object(engine, "_detect_gpu_vram_gb", return_value=3.0):
            tag, _, _, _ = engine._select_qwen_model()
        self.assertEqual(tag, "qwen3:4b")

    def test_env_override_pins_model(self) -> None:
        prev = os.environ.get("SAROPA_QWEN_MODEL")
        os.environ["SAROPA_QWEN_MODEL"] = "qwen3:4b"
        try:
            tag, _, _, note = engine._select_qwen_model()
        finally:
            if prev is None:
                os.environ.pop("SAROPA_QWEN_MODEL", None)
            else:
                os.environ["SAROPA_QWEN_MODEL"] = prev
        self.assertEqual(tag, "qwen3:4b")
        self.assertIn("pinned", note)


class EchoDetectionTests(unittest.TestCase):
    """QwenTranslator rejects echoed-back source text."""

    def test_exact_echo_returns_none(self) -> None:
        t = engine.QwenTranslator("de")
        with patch.object(engine, "_call_ollama", return_value="Hello"):
            self.assertIsNone(t.translate("Hello"))

    def test_case_insensitive_echo_returns_none(self) -> None:
        t = engine.QwenTranslator("de")
        with patch.object(engine, "_call_ollama", return_value="HELLO"):
            self.assertIsNone(t.translate("Hello"))

    def test_real_translation_returned(self) -> None:
        t = engine.QwenTranslator("de")
        with patch.object(engine, "_call_ollama", return_value="Hallo"):
            self.assertEqual(t.translate("Hello"), "Hallo")

    def test_empty_input_returns_none(self) -> None:
        t = engine.QwenTranslator("de")
        self.assertIsNone(t.translate(""))
        self.assertIsNone(t.translate("   "))


class PromptPreviewTests(unittest.TestCase):
    """prompt_preview mode prints prompts and returns None."""

    def test_preview_returns_none(self) -> None:
        t = engine.QwenTranslator("de", prompt_preview=True)
        result = t.translate("Hello")
        self.assertIsNone(result)

    def test_preview_writes_to_stderr(self) -> None:
        import io
        t = engine.QwenTranslator("de", prompt_preview=True)
        captured = io.StringIO()
        with patch("sys.stderr", captured):
            t.translate("Hello")
        output = captured.getvalue()
        self.assertIn("German", output)
        self.assertIn("Hello", output)


class LocaleInfoTests(unittest.TestCase):
    """All supported locales have language names and valid script info."""

    def test_all_bundle_locales_covered(self) -> None:
        expected = {"de", "es", "fr", "it", "ja", "ko", "pt-br", "ru",
                    "zh-cn", "zh-tw"}
        self.assertEqual(set(engine._LOCALE_INFO), expected)

    def test_cjk_locales_have_script_constraint(self) -> None:
        for loc in ("ja", "ko", "zh-cn", "zh-tw"):
            _, script = engine._LOCALE_INFO[loc]
            self.assertIsNotNone(script, f"{loc} missing script constraint")


if __name__ == "__main__":
    unittest.main()
