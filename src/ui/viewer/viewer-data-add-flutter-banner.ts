/**
 * Embedded JavaScript for Flutter exception banner grouping.
 *
 * A Flutter framework exception prints a multi-line block bracketed by heavy
 * box-drawing rules (U+2550 `═`). The same incident is usually logged more than
 * once — once per sink — in slightly different shapes:
 *
 *     ════════ Exception caught by rendering library ═════════════════════════   (stderr)
 *     ══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞═══════════════════════════════   (console)
 *     FlutterErrorDetails (══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══ …          (wrapped)
 *     The following assertion was thrown during layout:
 *     A RenderFlex overflowed by 22 pixels on the right.
 *     ...
 *     ════════════════════════════════════════════════════════════════════════
 *
 * `flutterBannerOpenRe` matches all of these (see its inline note); each copy
 * becomes its own group, so every printed copy gets the band rather than only
 * the stderr one.
 *
 * Without grouping:
 *  1. Only the opening line carries the word "Exception" — body lines like
 *     "The following assertion was thrown during layout:" classify as info and
 *     vanish under the Errors/Warnings filter, breaking the incident into
 *     fragments.
 *  2. Recent-error context only tints info lines within 2 seconds of the last
 *     error — for verbose render errors (40+ lines of RenderFlex dump) the band
 *     can end prematurely if any line jumps the window.
 *  3. The user has no visual cue that these lines form one logical block.
 *
 * This module runs a tiny state machine inside `addToData` and tags every line
 * between the opening banner and its closing rule with `bannerGroupId` plus a
 * `bannerRole` (`header` | `body` | `footer`). Level is forced to `error` for
 * every tagged line so level filters keep the whole block visible.
 */

/** Get the embedded JavaScript for Flutter banner detection + grouping. */
export function getFlutterBannerScript(): string {
    return /* javascript */ `
/* ── Flutter exception banner grouping ───────────────────────────── */

/* Opening banner. Flutter prints the "Exception caught by …" line in several
   shapes depending on the sink:
     stderr  : '════════ Exception caught by rendering library ════'
     console : '══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══'  (often ANSI-colored)
     wrapped : 'FlutterErrorDetails (══╡ EXCEPTION CAUGHT BY … ╞══'
     wrapped : 'Potential Null Check Operator Error Detected: ══╡ … ╞══'
   The console shapes break a pure-═ run after only two chars using the corner
   glyphs ╡ (U+2561) / ╞ (U+255E), so the previous /═{4,}\\s+/ anchor matched ONLY
   the stderr shape and left ~65% of real exception copies ungrouped (the
   FlutterErrorDetails / console / null-check copies). Accept any run (2+) of
   heavy-horizontal OR the two corner glyphs, optional whitespace, then the
   phrase. The phrase is the real discriminator (case-insensitive); the leading
   box run guards against a prose line that merely contains the words. ANSI is
   converted to <span> upstream (ansiToHtml) and stripped here via slp.msg /
   stripTags, so the regex sees clean text — no escape codes to skip. */
var flutterBannerOpenRe = /[\\u2550\\u2561\\u255e]{2,}\\s*Exception caught by\\b/i;
/* Closing rule: line made entirely of heavy-horizontal chars (20+) and whitespace.
   Flutter's FlutterError uses 80 chars; requiring 20+ is lenient for truncation
   but high enough to never false-trigger on short dividers. */
var flutterBannerCloseRe = /^[\\s\\u2550]*\\u2550{20,}[\\s\\u2550]*$/;

/* Active banner state. When non-null, every line added is part of the group. */
var activeFlutterBanner = null;
/* Monotonic id so multiple banners in one session stay distinct; groupId=-1 means no banner. */
var nextBannerGroupId = 1;

/** True if plain text is the banner's opening rule. */
function isFlutterBannerOpenLine(plainText) {
    return flutterBannerOpenRe.test(plainText);
}
/** True if plain text is the banner's closing rule — caller must check a banner is active. */
function isFlutterBannerCloseLine(plainText) {
    return flutterBannerCloseRe.test(plainText);
}
/** Start a new banner group, return its id for tagging the header line. */
function beginFlutterBanner() {
    activeFlutterBanner = { groupId: nextBannerGroupId++ };
    return activeFlutterBanner.groupId;
}
/** End the active banner. Returns the groupId to tag the footer line with (or -1). */
function endFlutterBanner() {
    if (!activeFlutterBanner) return -1;
    var gid = activeFlutterBanner.groupId;
    activeFlutterBanner = null;
    return gid;
}
/** Current active groupId, or -1 if not in a banner. */
function currentFlutterBannerGroupId() {
    return activeFlutterBanner ? activeFlutterBanner.groupId : -1;
}

/**
 * Classify a line's position relative to the active banner.
 * Returns \`{ groupId, role }\` where role is 'header' | 'body' | 'footer' | null.
 * When role is null, the line is not part of any banner.
 *
 * Side effect: transitions active state on open/close. Caller must invoke this
 * exactly once per line (in allLines-push order) so state stays coherent.
 */
function classifyFlutterBannerLine(plainText) {
    /* Open detected while we are already inside a banner (missing close): treat
       it as starting a new banner. The previous one effectively ends at the
       previous line — we do not emit a synthetic footer, the user sees two
       visually distinct blocks which matches reality. */
    if (isFlutterBannerOpenLine(plainText)) {
        var gid = beginFlutterBanner();
        return { groupId: gid, role: 'header' };
    }
    var cur = currentFlutterBannerGroupId();
    if (cur === -1) return { groupId: -1, role: null };
    if (isFlutterBannerCloseLine(plainText)) {
        var endGid = endFlutterBanner();
        return { groupId: endGid, role: 'footer' };
    }
    return { groupId: cur, role: 'body' };
}

/** Reset banner state (called on clear / new session). */
function resetFlutterBannerDetector() {
    activeFlutterBanner = null;
    /* Keep nextBannerGroupId monotonic across resets so lingering references in
       the DOM never collide with a fresh banner of the same numeric id. */
}
`;
}
