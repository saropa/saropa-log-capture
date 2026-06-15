# -*- coding: utf-8 -*-
"""Translate missing l10n bundle entries — offline NLLB first, Google fallback.

Engine selection is per run: when the offline NLLB-200-3.3B model is cached and
its deps are installed, ``NllbTranslator`` is used for materially higher quality
with no rate limits; otherwise the pipeline falls back to Google Translate via
``deep-translator`` (``pip install deep-translator``), which wraps the public
Google endpoint (no API key, generous rate limits for ~300 strings x 10
locales). See ``l10n_nllb_engine`` for the NLLB engine and how to enable it.

Both engines expose the same ``.translate(text)`` shape, so the brand-shielding,
validation, and bundle-merge logic below is engine-agnostic. Only the
network-specific safeguards (socket timeout, throttle, rate-limit circuit
breaker) are gated to the Google path — NLLB is local and never throttles.

Each locale's bundle is updated in place: missing keys are added (this is also
how "out of date" strings flow through — changing an English source string
makes a new key). Untranslated keys (value == English) are retranslated only
when only_missing is False (the deliberate translate_l10n.py run); the publish
pipeline passes only_missing=True and leaves them alone. Existing real
translations are never overwritten.

Brand names are shielded from translation using placeholder substitution
(see l10n_brands.py). After translation, brands are restored and validated.
Translations that mangle brands are rejected and retried once.
"""

import json
import socket
import sys
import time
from collections.abc import Callable
from pathlib import Path

from modules.verify.l10n_bundle_audit import (
    L10N_DIR,
    extract_all_source_strings,
)
from modules.verify.l10n_console import red, yellow
from modules.verify.l10n_brands import (
    is_acronym_only,
    is_brand_only,
    is_no_translatable_content,
    shield_brands,
    unshield_brands,
    validate_brands,
)
from modules.verify.l10n_nllb_engine import (
    NllbTranslator,
    NllbUnavailable,
    cache_hint as nllb_cache_hint,
    is_available as is_nllb_available,
)
from modules.verify.l10n_provenance import (
    ENGINE_MANUAL,
    is_low_quality,
    load_provenance,
    save_provenance,
)
from modules.verify.l10n_sentences import split_segments

# VS Code l10n bundle locale codes -> deep-translator target codes.
# deep-translator uses standard ISO codes; VS Code bundles use lowercase
# with hyphens. Most map 1:1 except regional variants.
_LOCALE_MAP: dict[str, str] = {
    "de": "de",
    "es": "es",
    "fr": "fr",
    "it": "it",
    "ja": "ja",
    "ko": "ko",
    "pt-br": "pt",
    "ru": "ru",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
}

# Delay between individual translate calls to avoid rate limits.
# Google's free endpoint tolerates ~5 req/s comfortably; 0.2s is safe.
_THROTTLE_SECONDS = 0.2

# Bound every network call. deep-translator's GoogleTranslator calls
# requests.get() with NO timeout (see deep_translator/google.py), so a
# throttled or stalled Google response hangs the publish pipeline forever —
# this was the "lock-up at step 9" symptom. requests falls back to the
# process-wide socket default when given no explicit timeout, so we set that
# around the translate loop and restore it afterward. 8s is generous for one
# short UI string yet short enough that a stalled endpoint fails fast.
_NETWORK_TIMEOUT_SECONDS = 8.0

# A single throttle blip (429 / consent page) shouldn't permanently lose a
# string to English. Retry transient failures once with a short backoff.
_MAX_RETRIES = 1
_BACKOFF_BASE_SECONDS = 2.0

# Circuit breaker: once this many strings fail their network call back-to-back,
# Google is rate-limiting us wholesale. Abort the run instead of grinding
# through hundreds more doomed (and timeout-bounded, so slow) calls — keep
# English for the rest and let the caller stop further locales.
_CONSECUTIVE_FAILURE_LIMIT = 5

# Sentence-level translation (default ON). A multi-sentence source string is
# translated one sentence at a time and rejoined, instead of being sent to the
# engine as a whole paragraph. Both engines — NLLB especially — produce
# materially better output on single sentences: long paragraphs risk silent
# truncation at the model's token limit and cross-sentence context bleed. Held
# as module state set once per run (see set_sentence_mode) rather than threaded
# through the whole translate call chain, which already sits at the param limit.
_translate_by_sentence_enabled = True


def set_sentence_mode(enabled: bool) -> None:
    """Enable (default) or disable sentence-by-sentence translation for the run.

    Disabled = paragraph mode: each source string goes to the engine as one
    unit, the prior behavior. The CLI exposes this via --paragraph-mode.
    """
    global _translate_by_sentence_enabled  # noqa: PLW0603
    _translate_by_sentence_enabled = enabled


def _load_bundle(locale: str) -> tuple[Path, dict[str, str]]:
    """Load a locale bundle, returning (path, data). Empty dict if missing."""
    path = L10N_DIR / f"bundle.l10n.{locale}.json"
    if path.exists():
        return path, json.loads(path.read_text(encoding="utf-8"))
    return path, {}


def _save_bundle(path: Path, data: dict[str, str]) -> None:
    """Write a bundle atomically (write to tmp then rename)."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)


def _translate_segment(translator: object, segment: str) -> str | None:
    """Translate one segment (a sentence, or a whole string in paragraph mode).

    Applies brand shielding + validation. Returns the translated text with brands
    restored, or None on failure. Brand-only segments are returned as-is
    (identity = correct translation).
    """
    if is_brand_only(segment):
        return segment

    shielded, replacements = shield_brands(segment)

    # If the entire segment became placeholders (rare), just return as-is.
    stripped = shielded
    for placeholder, _ in replacements:
        stripped = stripped.replace(placeholder, "").strip()
    if not stripped:
        return segment

    result = translator.translate(shielded)  # type: ignore[union-attr]
    if not result or not result.strip():
        return None

    restored = unshield_brands(result.strip(), replacements)

    # Validate: every brand in the original must survive in the translation.
    mangled = validate_brands(segment, restored)
    if mangled:
        # One retry: Google sometimes handles it better on a second attempt.
        result2 = translator.translate(shielded)  # type: ignore[union-attr]
        if result2 and result2.strip():
            restored2 = unshield_brands(result2.strip(), replacements)
            if not validate_brands(segment, restored2):
                return restored2
        # Retry also failed — return None so caller keeps English.
        return None

    return restored


def _translate_segments(translator: object, segments: list[str]) -> str | None:
    """Translate each sentence segment, passing separators through, then rejoin.

    Returns None if any sentence fails: a paragraph that is half-English,
    half-translated reads worse than a clean English fallback the caller can
    retry on a later run.
    """
    out: list[str] = []
    for seg in segments:
        # Whitespace-only segments are inter-sentence separators — keep verbatim
        # so original spacing/newlines survive; never send them to the engine.
        if not seg.strip():
            out.append(seg)
            continue
        translated = _translate_segment(translator, seg)
        if translated is None:
            return None
        out.append(translated)
    return "".join(out)


def _translate_one(
    translator: object,
    en_key: str,
) -> str | None:
    """Translate one string with brand shielding.

    In sentence mode (default), a multi-sentence string is translated one
    sentence at a time and rejoined; paragraph mode sends it as one unit. Returns
    the translated string with brands restored, or None on failure.
    """
    if _translate_by_sentence_enabled and not is_brand_only(en_key):
        segments = split_segments(en_key)
        if len(segments) > 1:
            return _translate_segments(translator, segments)
    return _translate_segment(translator, en_key)


def _translate_with_retry(translator: object, en_key: str) -> str | None:
    """Translate one string, retrying transient endpoint failures with backoff.

    Re-raises the last exception if every attempt fails so the caller can log
    it and keep English. A returned ``None`` (brand-validation reject) is NOT a
    network failure and is passed straight through — only raised errors retry.
    """
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return _translate_one(translator, en_key)
        # Any endpoint error here (429, request error, parse miss, socket
        # timeout) is transient enough to be worth one retry.
        except Exception as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** attempt))
    assert last_exc is not None  # loop ran at least once
    raise last_exc


def _record_error(
    error_sink: list[dict[str, str]] | None,
    locale: str,
    en_key: str,
    err_type: str,
    detail: str,
) -> None:
    """Append one translation failure to the run's error audit sink.

    The sink is a flat list the caller persists to a timestamped audit file at
    the end of the run. Every failure is captured in full (untruncated English
    source + reason) so the audit is actionable; the on-screen WARN line stays
    truncated for readability. No-op when no sink was provided (e.g. the publish
    pipeline, which collects errors via its own audit path).
    """
    if error_sink is None:
        return
    error_sink.append({
        "locale": locale,
        "type": err_type,
        "en": en_key,
        "detail": detail,
    })


def _apply_translation(
    translator: object,
    en_key: str,
    bundle: dict[str, str],
    locale: str,
    *,
    keep_existing_on_failure: bool = False,
    error_sink: list[dict[str, str]] | None = None,
) -> str:
    """Translate one key into ``bundle``; return its outcome status.

    Returns one of:
      "ok"           — translated and stored.
      "validate_fail" — network OK but the result was rejected.
      "net_fail"     — the network call itself failed.

    Only "net_fail" feeds the circuit breaker; a "validate_fail" proves the
    endpoint is healthy, so it must not count toward consecutive failures.

    ``keep_existing_on_failure`` controls the failure path. Default False writes
    English as a fallback — correct when filling a gap (the slot was empty or
    English anyway). True LEAVES the current value untouched — required by the
    low-quality upgrade pass: a failed NLLB upgrade of an existing Google
    translation must keep the Google text, never overwrite a real translation
    with English (which would be strictly worse than the value it replaced).

    ``error_sink``, when given, collects every non-"ok" outcome for the run's
    error audit file.
    """
    try:
        result = _translate_with_retry(translator, en_key)
    except Exception as exc:
        print(f"    WARN [{locale}]: {en_key[:50]}... -> {exc}")
        _record_error(error_sink, locale, en_key, "net_fail", str(exc))
        if not keep_existing_on_failure:
            bundle[en_key] = en_key
        return "net_fail"
    if result:
        bundle[en_key] = result
        return "ok"
    # Network call succeeded but the result was empty or failed brand
    # validation (a brand name was mangled in the translation). Both reduce to
    # a None return here, so the audit reason names both possibilities.
    _record_error(
        error_sink, locale, en_key, "validate_fail",
        "empty result or brand validation rejected",
    )
    if not keep_existing_on_failure:
        bundle[en_key] = en_key
    return "validate_fail"


# Set once the run's engine has been announced, so the banner prints a single
# time across the multi-locale loop (and across the publish pipeline) rather
# than once per locale.
_engine_announced = False


def _announce_engine(engine: str) -> None:
    """Print the chosen translation engine once per process.

    Why: NLLB is selected silently when available and the pipeline falls back to
    Google just as silently. A run that quietly used Google would defeat the
    whole point of enabling NLLB without the operator ever noticing — so the
    engine, and the reason for any fallback, is surfaced exactly once.
    """
    global _engine_announced  # noqa: PLW0603
    if _engine_announced:
        return
    _engine_announced = True
    if engine == "nllb":
        print("  Engine: NLLB-200-3.3B (offline, higher quality, no rate limits)")
        return
    # Falling back to Google is NOT silent: NLLB is the preferred engine, so the
    # operator is told loudly that the lower-quality online path is in use and
    # given the exact command to enable NLLB. cache_hint() now names the real
    # blocker (deps / missing model / cached-but-no-device), not a guess.
    print(red("  ⚠ WARNING: NOT using offline NLLB — falling back to Google Translate"))
    print(red("    (lower quality, network rate-limited)."))
    print(yellow(f"    To enable NLLB: {nllb_cache_hint()}"))


def _make_translator(locale: str) -> tuple[object, str] | None:
    """Build the best available translator for a locale.

    Prefers the offline NLLB-200-3.3B engine (higher quality, no rate limits)
    when its model is cached and deps are installed; otherwise falls back to
    Google Translate. Returns ``(translator, engine_name)`` where engine_name is
    "nllb" or "google", or None when neither engine can serve the locale.

    Engine choice drives the network safeguards in ``translate_locale``: the
    socket timeout, the inter-call throttle, and the rate-limit circuit breaker
    apply only to the Google path. NLLB runs locally and never throttles.
    """
    # NLLB only when its model is already cached on disk — a machine without it
    # transparently uses Google rather than triggering a 7 GB download.
    if is_nllb_available():
        try:
            translator = NllbTranslator(locale)
            _announce_engine("nllb")
            return translator, "nllb"
        except NllbUnavailable as exc:
            # Per-device reasons (captured by the cascade) so the operator sees
            # the real cause here; the loud warning + fix print in _announce_engine.
            print(yellow(f"  ⚠ NLLB could not load for '{locale}': {exc}"))

    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        print(
            "  deep-translator not installed. "
            "Run: pip install deep-translator",
            file=sys.stderr,
        )
        return None

    target_code = _LOCALE_MAP.get(locale)
    if not target_code:
        print(f"  No translator mapping for locale '{locale}', skipping.")
        return None
    _announce_engine("google")
    return GoogleTranslator(source="en", target=target_code), "google"


_TRANSLATE_SCOPES = ("missing", "gaps", "low_quality")


def _key_action(
    en_key: str,
    existing: str | None,
    *,
    scope: str,
    provenance: dict[str, str],
) -> str:
    """Decide what to do with one key under the active scope.

    Returns "identity" (force English — brand/acronym/symbol), "translate"
    (send to the engine), or "keep" (leave as-is). Scope semantics:
      - "missing"     translate only keys ABSENT from the bundle.
      - "gaps"        translate absent keys AND en-copy (value == English).
      - "low_quality" translate ONLY existing real translations whose
                      provenance engine is low quality or untracked (upgrade).
    """
    if is_brand_only(en_key) or is_acronym_only(en_key) or is_no_translatable_content(en_key):
        return "identity"
    really_translated = bool(existing) and existing != en_key
    if scope == "low_quality":
        # Upgrade only real translations the quality model marks as weak.
        if really_translated and is_low_quality(provenance.get(en_key)):
            return "translate"
        return "keep"
    # gaps / missing: fill where there is no real translation yet.
    if really_translated:
        return "keep"
    # en-copy (present, value == English) is skipped only in the narrow
    # "missing" scope the publish pipeline uses to avoid re-sending it each run.
    if scope == "missing" and existing is not None:
        return "keep"
    return "translate"


def _finalize_locale(
    path: Path,
    bundle: dict[str, str],
    canonical_keys: set[str],
    locale: str,
    provenance_updates: dict[str, str],
    *,
    dry_run: bool,
) -> None:
    """Prune orphan keys and persist the bundle + provenance for one locale.

    Called from ``translate_locale``'s ``finally`` so a graceful CTRL-C still
    writes everything translated so far. A multi-hour run must be resumable, not
    lost: a re-run keeps already-translated keys (``gaps`` skips value != English;
    ``low_quality`` skips ``nllb`` provenance), so cancellation becomes a pause.
    """
    orphans = [k for k in bundle if k not in canonical_keys]
    for k in orphans:
        del bundle[k]
    if not dry_run:
        _save_bundle(path, bundle)
        save_provenance(locale, provenance_updates)


def translate_locale(
    locale: str,
    canonical_keys: set[str],
    *,
    dry_run: bool = False,
    scope: str = "gaps",
    on_progress: Callable[[int, int, int], None] | None = None,
    error_sink: list[dict[str, str]] | None = None,
) -> tuple[int, int, int, int, bool]:
    """Translate strings for one locale under ``scope`` (see ``_key_action``).

    ``scope`` is one of "missing" (absent keys only — the publish pipeline),
    "gaps" (absent + en-copy — the deliberate translate_l10n.py run), or
    "low_quality" (re-translate existing low-quality / untracked output — the
    Google → NLLB upgrade pass). Every successful translation records its engine
    in the locale's provenance sidecar; a failed low-quality upgrade keeps the
    existing value rather than overwriting a real translation with English.

    on_progress, if given, is called as on_progress(done, total, words) after
    every translation attempt so callers can render a live counter, throughput
    (words-per-minute), and an ETA. ``words`` is the running sum of source-word
    counts across every attempted key — it tracks engine throughput, so it
    includes failed attempts (they still consumed time) and excludes the NLLB
    model-load phase, which happens before the first attempt.

    error_sink, if given, collects one record per non-"ok" outcome (net_fail /
    validate_fail) so the caller can persist a run-wide error audit file.

    Returns (translated, kept, brand, errors, aborted).
      translated = newly translated (or upgraded) this run.
      kept       = left as-is (real translation, identity, or out-of-scope).
      brand      = brand-only strings where identity IS correct.
      errors     = translation attempt failed.
      aborted    = circuit breaker tripped (endpoint rate-limiting); remaining
                   keys left untouched. Callers should stop further locales.
    """
    path, bundle = _load_bundle(locale)
    # Loaded once; the low-quality scope reads it to find weak keys, and every
    # scope appends the engine of each new translation to provenance_updates.
    provenance = load_provenance(locale)
    provenance_updates: dict[str, str] = {}

    translated = 0
    kept = 0
    brand = 0
    errors = 0
    aborted = False
    consecutive_failures = 0
    # Running source-word total for the throughput (WPM) readout. Counts words
    # of every key sent to the engine, success or failure, so WPM reflects real
    # processing rate rather than only successful output.
    words_done = 0

    # Denominator for on_progress — mirror the loop's per-key decision exactly,
    # so the live counter reads "done/total" and never overshoots its total.
    total_todo = sum(
        1 for k in canonical_keys
        if _key_action(k, bundle.get(k), scope=scope, provenance=provenance) == "translate"
    )
    attempted = 0

    # Build the engine only when there is real work AND we will write. Building
    # NllbTranslator loads the ~7 GB model and runs a probe translation, so a
    # dry run or a no-op locale (e.g. an upgrade pass with no weak keys) must
    # never construct it — translator stays None on those paths and is unused.
    translator: object | None = None
    engine = "dry-run" if dry_run else "none"
    if not dry_run and total_todo > 0:
        made = _make_translator(locale)
        if made is None:
            return 0, 0, 0, 0, False
        translator, engine = made

    # requests has no default timeout, so without this a stalled Google
    # response hangs forever (the original lock-up). Set the process-wide
    # socket default for the network loop and restore it in finally so the
    # rest of the pipeline keeps its own timeout policy. Skip for dry_run
    # (no network) and for NLLB, which runs locally — clamping the socket
    # timeout there would needlessly cap unrelated I/O while NLLB has its own
    # per-string wall-clock deadline inside the engine.
    prev_timeout = socket.getdefaulttimeout()
    if not dry_run and engine == "google":
        socket.setdefaulttimeout(_NETWORK_TIMEOUT_SECONDS)
    try:
        for en_key in sorted(canonical_keys):
            existing = bundle.get(en_key)
            action = _key_action(en_key, existing, scope=scope, provenance=provenance)

            # Forced-English identity (brand / acronym / symbol). No provenance
            # is stamped — classify_translated_keys infers "identity" by shape,
            # so these never count as upgrade candidates. Brand-only feeds the
            # brand counter; acronym/symbol count as kept (matches prior tallies).
            if action == "identity":
                bundle[en_key] = en_key
                if is_brand_only(en_key):
                    brand += 1
                else:
                    kept += 1
                continue

            # Out of scope this run: a real translation we are keeping, a
            # high-quality one the upgrade pass skips, or en-copy under "missing".
            if action == "keep":
                kept += 1
                continue

            if dry_run:
                translated += 1
                continue

            # keep_existing_on_failure for the upgrade pass: a failed NLLB
            # upgrade must not overwrite a real Google translation with English.
            status = _apply_translation(
                translator, en_key, bundle, locale,
                keep_existing_on_failure=(scope == "low_quality"),
                error_sink=error_sink,
            )
            if status == "ok":
                translated += 1
                consecutive_failures = 0
                provenance_updates[en_key] = engine
            elif status == "validate_fail":
                # Engine is healthy; not a throttle signal — don't trip breaker.
                errors += 1
                consecutive_failures = 0
            else:  # net_fail
                errors += 1
                consecutive_failures += 1

            # Report progress before any early break so the final count shows.
            attempted += 1
            words_done += len(en_key.split())
            if on_progress is not None:
                on_progress(attempted, total_todo, words_done)

            if status == "net_fail" and consecutive_failures >= _CONSECUTIVE_FAILURE_LIMIT:
                aborted = True
                break

            # Throttle to stay under Google's per-IP rate limit. NLLB is local
            # and never rate-limits, so the delay would only slow the run.
            if engine == "google":
                time.sleep(_THROTTLE_SECONDS)
    finally:
        # Runs on normal completion, circuit-breaker abort, AND KeyboardInterrupt
        # (which is BaseException, so the retry/_apply_translation `except
        # Exception` blocks never swallow it — it propagates straight here). That
        # makes a CTRL-C save in-progress work and re-raise cleanly: the operator
        # can pause a 20-hour run and resume it later without losing the locale.
        socket.setdefaulttimeout(prev_timeout)
        # Record which engine produced each new/upgraded translation so the audit
        # can report quality and a later pass can target the weak ones.
        _finalize_locale(
            path, bundle, canonical_keys, locale, provenance_updates,
            dry_run=dry_run,
        )

    return translated, kept, brand, errors, aborted


def fix_mangled_brands(locale: str, canonical_keys: set[str]) -> int:
    """Find and reset translations that mangled brand names.

    Returns the number of translations reset to English. These will be
    retranslated on the next translate_locale() call.
    """
    path, bundle = _load_bundle(locale)
    reset_count = 0

    for en_key in canonical_keys:
        existing = bundle.get(en_key)
        if not existing or existing == en_key:
            continue

        # Brand-only strings must be identity.
        if is_brand_only(en_key) and existing != en_key:
            bundle[en_key] = en_key
            reset_count += 1
            continue

        # Check brand tokens in longer strings.
        mangled = validate_brands(en_key, existing)
        if mangled:
            bundle[en_key] = en_key
            reset_count += 1

    if reset_count > 0:
        _save_bundle(path, bundle)

    return reset_count


def _reassemble_sentences(en_key: str, sentences: list[dict[str, object]]) -> str | None:
    """Rejoin per-sentence translations into the whole-string value, or None.

    Re-splits the English with the SAME segmenter the export used, then replaces
    each sentence segment (in order) with its translation, leaving the captured
    whitespace separators untouched so spacing/newlines are restored exactly.

    Returns None — caller skips the key, never stores a half string — when the
    filled sentence count does not match the source (a translator merged/split
    sentences) or any sentence translation is blank (an incomplete fill).
    """
    segments = split_segments(en_key)
    sentence_positions = [i for i, seg in enumerate(segments) if seg.strip()]
    ordered = sorted(sentences, key=lambda s: int(s.get("i", 0)))
    translations = [str(s.get("translation", "")) for s in ordered]
    if len(translations) != len(sentence_positions):
        return None
    if any(not t.strip() for t in translations):
        return None
    out = list(segments)
    for pos, translated in zip(sentence_positions, translations):
        out[pos] = translated
    return "".join(out)


def _merge_into_bundle(locale: str, updates: dict[str, str]) -> None:
    """Write reassembled translations into a locale bundle + stamp provenance.

    Imported strings are human-authored, so they are stamped ``manual`` (high
    quality) — this is what stops the NLLB low-quality upgrade pass from later
    overwriting hand-translated work.
    """
    if not updates:
        return
    path, bundle = _load_bundle(locale)
    bundle.update(updates)
    _save_bundle(path, bundle)
    save_provenance(locale, {key: ENGINE_MANUAL for key in updates})


def import_gap_file(path: Path) -> tuple[int, int, list[str]]:
    """Reassemble a filled sentence-level gap export into the locale bundles.

    Reads the JSON produced by ``write_gap_export_sentences`` and, for each
    entry, rejoins its per-sentence translations into the whole-string value
    under the original English key (see ``_reassemble_sentences``). The file only
    carries the sentence translations in order; the original spacing is restored
    by re-splitting the English here, so the export never had to store separators.

    Returns ``(written, skipped, locales_touched)``. A key is skipped — left
    untranslated — when its sentence count drifts or any sentence is blank, so a
    partial fill can never corrupt a string.
    """
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    by_locale: dict[str, dict[str, str]] = {}
    written = 0
    skipped = 0
    for entry in data.get("entries", []):
        locale = entry.get("locale")
        en_key = entry.get("en")
        sentences = entry.get("sentences", [])
        reassembled = (
            _reassemble_sentences(en_key, sentences)
            if locale and en_key and sentences else None
        )
        if reassembled is None:
            skipped += 1
            continue
        by_locale.setdefault(locale, {})[en_key] = reassembled
        written += 1
    for locale, updates in by_locale.items():
        _merge_into_bundle(locale, updates)
    return written, skipped, sorted(by_locale)


def get_canonical_keys() -> set[str]:
    """Return the set of English string values that every bundle must have."""
    return set(extract_all_source_strings().values())


def get_translation_locales() -> list[str]:
    """Return locale codes from existing bundle files on disk."""
    locales = []
    for f in sorted(L10N_DIR.iterdir()):
        if (
            f.name.startswith("bundle.l10n.")
            and f.name.endswith(".json")
            and f.name != "bundle.l10n.json"
        ):
            locale = f.name.replace("bundle.l10n.", "").replace(".json", "")
            locales.append(locale)
    return locales
