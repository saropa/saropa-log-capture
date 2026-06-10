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


def _translate_one(
    translator: object,
    en_key: str,
) -> str | None:
    """Translate one string with brand shielding.

    Returns the translated string with brands restored, or None on failure.
    Brand-only strings are returned as-is (identity = correct translation).
    """
    if is_brand_only(en_key):
        return en_key

    shielded, replacements = shield_brands(en_key)

    # If the entire string became placeholders (rare), just return as-is.
    stripped = shielded
    for placeholder, _ in replacements:
        stripped = stripped.replace(placeholder, "").strip()
    if not stripped:
        return en_key

    result = translator.translate(shielded)  # type: ignore[union-attr]
    if not result or not result.strip():
        return None

    restored = unshield_brands(result.strip(), replacements)

    # Validate: every brand in the original must survive in the translation.
    mangled = validate_brands(en_key, restored)
    if mangled:
        # One retry: Google sometimes handles it better on a second attempt.
        result2 = translator.translate(shielded)  # type: ignore[union-attr]
        if result2 and result2.strip():
            restored2 = unshield_brands(result2.strip(), replacements)
            if not validate_brands(en_key, restored2):
                return restored2
        # Retry also failed — return None so caller keeps English.
        return None

    return restored


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


def _apply_translation(
    translator: object,
    en_key: str,
    bundle: dict[str, str],
    locale: str,
) -> str:
    """Translate one key into ``bundle``; return its outcome status.

    Returns one of:
      "ok"           — translated and stored.
      "validate_fail" — network OK but the result was rejected (kept English).
      "net_fail"     — the network call itself failed (kept English).

    Only "net_fail" feeds the circuit breaker; a "validate_fail" proves the
    endpoint is healthy, so it must not count toward consecutive failures.
    """
    try:
        result = _translate_with_retry(translator, en_key)
    except Exception as exc:
        # Network failed after retries — log it and keep English as fallback.
        print(f"    WARN [{locale}]: {en_key[:50]}... -> {exc}")
        bundle[en_key] = en_key
        return "net_fail"
    if result:
        bundle[en_key] = result
        return "ok"
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
    else:
        print(f"  Engine: Google Translate — {nllb_cache_hint()}")


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
            print(f"  NLLB unavailable for '{locale}' ({exc}); using Google.")

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


def translate_locale(
    locale: str,
    canonical_keys: set[str],
    *,
    dry_run: bool = False,
    only_missing: bool = False,
    on_progress: Callable[[int, int], None] | None = None,
) -> tuple[int, int, int, int, bool]:
    """Translate missing/untranslated strings for one locale.

    only_missing scopes the run to genuine gaps: keys ABSENT from the bundle.
    Because every bundle is keyed by the English text, changing an English
    source string produces a NEW key — so "out of date" strings are absent
    from the locale and ARE filled. What only_missing skips is en-copy keys
    (already present with value == English): those were attempted before, and
    re-sending them to Google on every publish is identical-output network
    waste. The publish pipeline passes only_missing=True; the deliberate
    translate_l10n.py run leaves it False so it can re-attempt en-copy and
    recover strings whose previous translation failed to English.

    on_progress, if given, is called as on_progress(done, total) after every
    network attempt so callers can render a live counter — a backlog of
    hundreds of strings at the throttle delay takes minutes, and without
    feedback the publish pipeline reads as a frozen "lock-up at Step 9".

    Returns (translated, kept, brand, errors, aborted).
      translated = newly translated this run.
      kept       = already had a real non-English translation (or, under
                   only_missing, an en-copy key left in place).
      brand      = brand-only strings where identity IS correct.
      errors     = API call failed, kept English as fallback.
      aborted    = circuit breaker tripped (endpoint rate-limiting); the
                   remaining keys were left as English. Callers should stop
                   trying further locales — throttling is per-IP, not per-locale.
    """
    made = _make_translator(locale)
    if made is None:
        return 0, 0, 0, 0, False
    translator, engine = made

    path, bundle = _load_bundle(locale)

    translated = 0
    kept = 0
    brand = 0
    errors = 0
    aborted = False
    consecutive_failures = 0

    # Strings that will need a real network call this run — the denominator
    # for on_progress so the live counter reads "done/total", not "done/?".
    # Must mirror the per-key skip logic in the loop below, including the
    # only_missing en-copy skip, or the counter overshoots its total.
    def _needs_network(k: str) -> bool:
        # Brands, acronyms, and symbol-only strings are forced English (no
        # network) regardless of any existing value — mirror the loop's order so
        # this denominator matches.
        if is_brand_only(k) or is_acronym_only(k) or is_no_translatable_content(k):
            return False
        existing = bundle.get(k)
        if existing and existing != k:
            return False  # real, non-English translation already present
        if only_missing and existing == k:
            return False  # en-copy: attempted before, not re-sent on publish
        return True

    total_todo = sum(1 for k in canonical_keys if _needs_network(k))
    attempted = 0

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

            # Brand-only strings: identity IS the correct translation.
            if is_brand_only(en_key):
                bundle[en_key] = en_key
                brand += 1
                continue

            # Technical acronyms (ANR, SQL, OS, …) are English in EVERY locale.
            # Checked before the keep-existing branch on purpose: this overwrites
            # any prior translation so the label is uniform across locales (no
            # mix of "OK" and "わかりました"). Never sent to the translator.
            if is_acronym_only(en_key):
                bundle[en_key] = en_key
                kept += 1
                continue

            # Symbol-only strings ("1 - {0}", "{0} #", "Δ #") have no word to
            # translate; identity is correct in every locale. Forced English like
            # acronyms so a value==English audit never re-flags them and the
            # translator never round-trips them to Google for identical output.
            if is_no_translatable_content(en_key):
                bundle[en_key] = en_key
                kept += 1
                continue

            # Already has a real (non-English) translation — keep it.
            if existing and existing != en_key:
                kept += 1
                continue

            # Publish path: skip en-copy keys (present, value == English).
            # Genuine gaps and changed-English strings are ABSENT from the
            # bundle and still flow through below, so "out of date" still
            # regenerates. Re-sending en-copy every publish is identical-output
            # network waste — recover those via translate_l10n.py instead.
            if only_missing and existing == en_key:
                kept += 1
                continue

            if dry_run:
                translated += 1
                continue

            status = _apply_translation(translator, en_key, bundle, locale)
            if status == "ok":
                translated += 1
                consecutive_failures = 0
            elif status == "validate_fail":
                # Network is healthy; not a throttle signal — don't trip breaker.
                errors += 1
                consecutive_failures = 0
            else:  # net_fail
                errors += 1
                consecutive_failures += 1

            # Report progress before any early break so the final count shows.
            attempted += 1
            if on_progress is not None:
                on_progress(attempted, total_todo)

            if status == "net_fail" and consecutive_failures >= _CONSECUTIVE_FAILURE_LIMIT:
                aborted = True
                break

            # Throttle to stay under Google's per-IP rate limit. NLLB is local
            # and never rate-limits, so the delay would only slow the run.
            if engine == "google":
                time.sleep(_THROTTLE_SECONDS)
    finally:
        socket.setdefaulttimeout(prev_timeout)

    # Remove orphan keys (in bundle but not in canonical set).
    orphans = [k for k in bundle if k not in canonical_keys]
    for k in orphans:
        del bundle[k]

    if not dry_run:
        _save_bundle(path, bundle)

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
