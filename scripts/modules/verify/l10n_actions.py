# -*- coding: utf-8 -*-
"""Translation pipeline actions for the l10n CLI.

The three things a run actually *does*: sync the English bundle to the TS source
strings, translate missing strings for a locale set, and write the audit report
(offering a gap export). Each prints colored progress — green for work done, red
for errors/orphans, yellow for gaps — and delegates the real work to
``l10n_bundle_audit`` and ``l10n_translator``. No menu logic lives here; see
``l10n_cli``.
"""

import json
import time

from modules.verify.l10n_audit_display import print_untranslated_detail
from modules.verify.l10n_bundle_audit import (
    AuditResult,
    L10N_DIR,
    sync_english_bundle,
    write_audit_report,
    write_failures_export_sentences,
    write_translation_error_audit,
)
from modules.verify.l10n_console import cyan, dim, green, header, red, yellow
from modules.verify.l10n_provenance import (
    ENGINE_MANUAL,
    is_forced_identity,
    load_provenance,
    save_provenance,
)
from modules.verify.l10n_translator import (
    fix_mangled_brands,
    get_canonical_keys,
    get_translation_locales,
    translate_locale,
)


def run_sync() -> None:
    """Sync the English bundle to match the TS source strings."""
    header("Syncing English bundle")
    added, kept, removed = sync_english_bundle()
    print(f"\n  Kept:    {kept}")
    print(f"  Added:   {green(str(added))}")
    print(f"  Removed: {red(str(removed))} orphan(s)")
    print(f"  Total:   {cyan(str(kept + added))} keys")


def _reset_mangled_brands(locales: list[str], canonical: set[str]) -> None:
    """Reset translations that mangled brand names so they retranslate cleanly."""
    total_fixed = 0
    for locale in locales:
        fixed = fix_mangled_brands(locale, canonical)
        if fixed > 0:
            total_fixed += fixed
            print(f"  {cyan(locale)}: reset {yellow(str(fixed))} mangled brand translation(s)")
    if total_fixed > 0:
        print(f"  Total: {yellow(str(total_fixed))} brand fix(es) — will retranslate")


def _print_locale_summary(
    translated: int, kept: int, brand_count: int, errors: int, *, dry_run: bool,
) -> None:
    """Print the per-locale result line; buckets sum to the locale total."""
    if dry_run:
        print(f"{translated} to translate, {kept} already done, {brand_count} brand")
        return
    parts = [green(f"{translated} translated"), dim(f"{kept} kept")]
    if brand_count > 0:
        parts.append(cyan(f"{brand_count} brand"))
    if errors > 0:
        parts.append(red(f"{errors} errors"))
    total = translated + kept + brand_count + errors
    print(f"{', '.join(parts)} = {total}")


# Width of the live translation progress bar, in characters. Matches the audit
# coverage table's bar so the two read as the same widget.
_PROGRESS_BAR_WIDTH = 24


def _format_duration(seconds: float) -> str:
    """Format a second count as H:MM:SS (hours dropped when zero)."""
    secs = max(int(seconds), 0)
    hours, rem = divmod(secs, 3600)
    minutes, sec = divmod(rem, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{sec:02d}"
    return f"{minutes}:{sec:02d}"


def _print_progress_bar(
    locale: str, done: int, total: int, *, words: int = 0, elapsed: float = 0.0,
) -> None:
    """Render a single-line \r progress bar for one locale's translation pass.

    Reprints the whole line each tick (cheap, and robust to terminals that ignore
    partial \r redraws). A CPU Qwen run translates string-by-string over minutes;
    without a visible bar the gap between the per-locale header and its summary
    reads as a hang even though work is steadily progressing.

    ``words``/``elapsed`` drive a throughput (words-per-minute) and ETA readout.
    Both are suppressed until ~half a second has passed: a sub-second first tick
    yields a meaningless rate (and risks a divide-by-zero), and the ETA needs at
    least one measured interval to be anything but noise.
    """
    fraction = (done / total) if total else 1.0
    filled = int(fraction * _PROGRESS_BAR_WIDTH)
    bar = "#" * filled + "." * (_PROGRESS_BAR_WIDTH - filled)

    stats = ""
    if elapsed > 0.5 and done > 0:
        wpm = words / elapsed * 60.0
        remaining_items = max(total - done, 0)
        eta_seconds = remaining_items * (elapsed / done)
        stats = f"  {wpm:,.0f} wpm  ETA {_format_duration(eta_seconds)}"

    # Trailing CSI EL (\033[K) erases any leftover from a previously longer line
    # — the ETA shrinks as the run finishes, so without it stale digits linger.
    print(
        f"\r  {cyan(locale)}: [{bar}] {fraction * 100:5.1f}%  {done}/{total}{stats}\033[K",
        end="",
        flush=True,
    )


def _translate_one_locale(
    locale: str, canonical: set[str], *, dry_run: bool,
    prompt_preview: bool = False, scope: str,
    error_sink: list[dict[str, str]] | None = None,
) -> tuple[int, int, bool]:
    """Translate one locale under ``scope``. Returns (translated, errors, aborted)."""
    # Wall-clock for the WPM/ETA readout, set lazily on the first progress tick.
    # The first tick fires only after the first string actually translates, so
    # starting the clock here excludes the Qwen model-load minute from the rate.
    started_at: list[float] = []

    # Live bar (\r) so a multi-minute run shows motion, not a frozen prompt.
    # Default arg binds the loop's current locale into the closure.
    def on_progress(done: int, total: int, words: int = 0, _loc: str = locale) -> None:
        if not started_at:
            started_at.append(time.time())
        elapsed = time.time() - started_at[0]
        _print_progress_bar(_loc, done, total, words=words, elapsed=elapsed)

    # Blank separator only — NO "de:" label here. translate_locale emits the
    # one-time Qwen model-load + engine-selection lines before the first tick,
    # and a pre-printed label stranded itself above that setup noise. The bar
    # reprints the label every tick; the blank line just keeps this locale's
    # output off the previous locale's summary (the bar's \r is column-0 of the
    # current line).
    print()
    translated, kept, brand_count, errors, aborted = translate_locale(
        locale, canonical, dry_run=dry_run, prompt_preview=prompt_preview,
        scope=scope, on_progress=on_progress, error_sink=error_sink,
    )
    # A tick fired iff a bar was drawn: close its \r line. Otherwise (dry run or
    # a no-work locale) no bar printed the label, so prefix the summary ourselves.
    if started_at:
        print()
    else:
        print(f"  {cyan(locale)}: ", end="")
    _print_locale_summary(translated, kept, brand_count, errors, dry_run=dry_run)
    return translated, errors, aborted


def run_translate(
    locales: list[str], *, dry_run: bool = False,
    prompt_preview: bool = False, scope: str = "gaps",
) -> None:
    """Translate the given locales under ``scope`` (gaps / low_quality), live.

    ``scope="gaps"`` fills untranslated strings; ``scope="low_quality"`` re-does
    existing low-quality / untracked translations with Qwen (the upgrade pass).
    """
    canonical = get_canonical_keys()
    # Brand-reset is a gap-fill concern (resets mangled brands to English so they
    # refill). The upgrade pass re-translates mangled brands directly — they
    # classify as low quality — so skip the reset there.
    if not dry_run and not prompt_preview and scope != "low_quality":
        _reset_mangled_brands(locales, canonical)

    verb = "Upgrading low-quality → Qwen" if scope == "low_quality" else "Translating gaps"
    if prompt_preview:
        verb += " (prompt preview)"
    elif dry_run:
        verb += " (dry run)"
    header(f"{verb}: {len(locales)} locale(s), {len(canonical)} strings")

    total_translated = 0
    total_errors = 0
    # Every per-string failure (net or brand-validation) across all locales is
    # collected here and flushed to a timestamped audit file after the run, so
    # the inline WARN lines are not the only record of what failed.
    error_records: list[dict[str, str]] = []
    t0 = time.time()
    # CTRL-C is a graceful pause, not a crash: translate_locale's finally has
    # already saved the in-progress locale, so a re-run resumes where it stopped.
    # Catch it here to print a clean message instead of dumping a traceback.
    try:
        for locale in locales:
            translated, errors, aborted = _translate_one_locale(
                locale, canonical, dry_run=dry_run,
                prompt_preview=prompt_preview, scope=scope,
                error_sink=error_records,
            )
            total_translated += translated
            total_errors += errors
            # Per-IP rate limiting hits every locale the same way, so stop the
            # whole run once the breaker trips rather than burn the timeout budget.
            if aborted:
                print(red(
                    "\n  Rate-limited by the translation endpoint — stopped early. "
                    "Re-run later to fill the remaining gaps."
                ))
                break
    except KeyboardInterrupt:
        print(yellow(
            "\n  Cancelled — progress saved for the locale in flight. "
            "Re-run to resume where you left off."
        ))

    elapsed = time.time() - t0
    print(f"\n  Done in {elapsed:.1f}s. {green(f'{total_translated} translations')}")
    if total_errors > 0:
        print(f"  {red(f'{total_errors} errors')} (kept English as fallback)")
    # Two artifacts per run with failures: the diagnostic error audit (full
    # source + reason), and the FILLABLE failures export — the strings the engine
    # could not produce, split into sentences for a human to translate and
    # reimport. This is what a translator works from, NOT the full untranslated
    # inventory. A clean run writes neither.
    if error_records:
        audit_path = write_translation_error_audit(error_records)
        print(f"  {red('Error audit')}: {cyan(str(audit_path))}")
        fillable = write_failures_export_sentences(error_records)
        if fillable:
            print(f"  {green('Failures to translate')}: {cyan(str(fillable))}")
            print(dim("  Fill every sentence, then: python scripts/translate_l10n.py --import <file>"))


def write_report_and_offer_export(audit: AuditResult) -> None:
    """Write the audit report and note how many strings remain untranslated.

    No gaps export: the fillable export a translator works from is the FAILURES
    export written by run_translate (the strings the engine attempted and could
    not produce), not the full untranslated inventory. Run a translate pass to
    produce it.
    """
    report_path = write_audit_report(audit)
    print(f"\n  Audit report: {cyan(str(report_path))}")

    if not audit.has_gaps:
        return

    total_gaps = sum(
        lc.missing_count + lc.untranslated_count for lc in audit.locale_coverage
    )
    print(f"\n  {yellow(f'{total_gaps} untranslated string(s) remain.')}")
    print_untranslated_detail(audit)
    print(dim(
        "  Run a translate pass to fill them; strings the engine cannot produce "
        "are exported (sentence-level) for human translation."
    ))


def run_fill_identity(*, dry_run: bool = False) -> int:
    """Stamp provenance on EN-COPY bundle entries that are identity-correct.

    Scans each locale bundle directly (not the audit's filtered gap list) for
    keys where value == key and no provenance is recorded, then checks
    ``is_forced_identity`` (acronyms, brands, symbols, verified cognates). This
    catches entries the audit already exempts from the gap count but that lack a
    provenance record — a belt-and-suspenders cleanup.

    Returns the number of entries stamped.
    """
    header("Fill identity gaps")
    locales = get_translation_locales()
    total = 0
    for locale in locales:
        bundle_path = L10N_DIR / f"bundle.l10n.{locale}.json"
        if not bundle_path.exists():
            continue
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        prov = load_provenance(locale)
        updates: dict[str, str] = {}
        for key, value in bundle.items():
            if value != key:
                continue
            if key in prov:
                continue
            if not is_forced_identity(key, locale):
                continue
            updates[key] = ENGINE_MANUAL
        if not updates:
            continue
        keys_str = ", ".join(sorted(updates))
        if dry_run:
            print(f"  {cyan(locale)}: would mark {len(updates)} — {keys_str}")
        else:
            save_provenance(locale, updates)
            print(f"  {cyan(locale)}: marked {green(str(len(updates)))} — {keys_str}")
        total += len(updates)
    if total == 0:
        print(f"  {dim('No unstamped identity entries found.')}")
    else:
        verb = "would mark" if dry_run else "marked"
        print(f"\n  {verb} {green(str(total))} identity entry/entries as manual.")
    return total
