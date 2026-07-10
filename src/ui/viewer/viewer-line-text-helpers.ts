/**
 * Single-line text/HTML classification helpers for the log viewer, split out of
 * viewer-data-helpers-core.ts to keep that file under the 300-line cap.
 *
 * These are pure per-line helpers — separator/ASCII-art detection, invisible-char
 * normalization, blank-content detection, stack-frame reformatting. The returned
 * script is concatenated INTO getViewerDataHelpersCore()'s output, so at runtime
 * (and in every test that builds the scope from getViewerDataHelpersCore()) these
 * functions live in the same shared webview scope as calcItemHeight, stripTags,
 * and escapeHtml, exactly as before the split.
 */

/** Get the embedded JavaScript for the per-line text/HTML classification helpers. */
export function getViewerLineTextHelpersScript(): string {
    return /* javascript */ `
/**
 * Separator / banner detection for .separator-line CSS. Must match
 * isLogViewerSeparatorLine in modules/analysis/log-viewer-separator-line.ts (unit-tested there).
 * Both copies strip the logcat/bracket prefix before detection — keep separatorPrefixRe in sync
 * with SOURCE_PREFIX in the TS module.
 *
 * Detection has two branches:
 * 1. Bar-pair: a vertical bar char on each side (any of │┃║╎╏╽╿), content between.
 * 2. Pure box-drawing rule: every non-whitespace char is in the Unicode box-drawing
 *    block (U+2500–U+257F). Covers rounded (╭╮╰╯), T-connector (├┤), heavy (┏┗┛┓),
 *    mixed light/heavy and light/double variants that corner-specific sets miss.
 */
function isAsciiBoxDrawingDecorLine(plain) {
    if (/^\\s*[\\u2502\\u2503\\u2551\\u254E\\u254F\\u257D\\u257F]\\s+(?:.*\\S\\s*)?[\\u2502\\u2503\\u2551\\u254E\\u254F\\u257D\\u257F]\\s*$/.test(plain)) return true;
    /* Pure box-drawing rule line (≥ 2 box chars, only whitespace allowed between). */
    return /^\\s*[\\u2500-\\u257F][\\u2500-\\u257F\\s]*[\\u2500-\\u257F]\\s*$/.test(plain);
}
/** Strip logcat / bracket prefix so separator detection works on the message body. */
var separatorPrefixRe = /^(?:[VDIWEFA]\\/[^(:\\s]+\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[[^\\]]+\\]\\s)/;
function isSeparatorLine(plainText) {
    var prefixM = separatorPrefixRe.exec(plainText);
    var body = prefixM ? plainText.slice(prefixM[0].length) : plainText;
    if (isAsciiBoxDrawingDecorLine(body)) return true;
    var trimmed = body.trim();
    if (trimmed.length < 3) return false;
    /* Art-char set: ASCII decoration symbols + full Unicode box-drawing block
       (U+2500–U+257F) + block elements (U+2580–U+259F) for shaded art. */
    var artChars = /[=+*_#~|/\\\\\\\\<>\\\\[\\\\]{}()^v\\u2500-\\u257F\\u2580-\\u259F\\\\-]/;
    var artCount = 0;
    for (var i = 0; i < trimmed.length; i++) {
        if (artChars.test(trimmed[i]) || trimmed[i] === ' ') artCount++;
    }
    return (artCount / trimmed.length) >= 0.6;
}
function extractContext(plainText) {
    var atMatch = /at\\s+(?:(.+?)\\s+\\()?([^\\s()]+?):(\\d+)(?::(\\d+))?\\)?/.exec(plainText);
    if (atMatch) {
        return { file: atMatch[2] || '', func: atMatch[1] || '', line: atMatch[3] || '' };
    }
    var mozMatch = /([^@]+)@([^:]+):(\\d+)(?::(\\d+))?/.exec(plainText);
    if (mozMatch) {
        return { file: mozMatch[2] || '', func: mozMatch[1] || '', line: mozMatch[3] || '' };
    }
    return null;
}
/** Reformat a stack frame so the member leads and the code location moves to a muted,
    right-aligned source tag, collapsing the stack_trace padding that shoves the member
    far right. Dart SDK frames ("dart:async   Future.timeout.<fn>") carry no link, so the
    library is lifted from PLAIN text (safe: emitted uncolored, caller keeps rawText). App
    frames ("./lib/foo.dart 273:9   Member") arrive linkified as <a class="source-link">…</a>
    carrying click-to-open + Ctrl+click-filter, so the link is lifted INTACT via an HTML
    regex — a plain-text rebuild would escapeHtml it away and kill both. Unlinkified input
    is unchanged. Keep the dart: pattern synced with isStackFrameText / isStackFrameLine. */
function formatFrameMemberFirst(html) {
    var plain = stripTags(html);
    var m = /^(dart:\\S+(?:\\s+\\d+:\\d+)?)\\s{2,}([\\w$<].*?)\\s*$/.exec(plain);
    if (m) return escapeHtml(m[2]) + ' <span class="frame-lib-src">' + escapeHtml(m[1]) + '</span>';
    /* App frame: <a class="source-link">…</a> + alignment padding (\\s{2,}) + member.
       Non-greedy .*? stops at the FIRST </a> — there is exactly one link per frame (the
       path); the member that follows is plain trailing text with no link of its own.
       Wrap the member in .frame-member so the whole-row open affordance is discoverable:
       the path link floats right (.frame-lib-src) and clips off-screen in a narrow
       sidebar, so without a cue on the member itself the bright app-frame text reads as
       plain, un-clickable text (user report 2026-06-16, "clickable text is white"). The
       wrapper is display-only — copy/search/dedup all use rawText, and stripTags() drops
       the span — and is added ONLY on linked app frames, so dart-SDK frames (no link,
       not clickable) stay un-cued and avoid a dead-click affordance. */
    var am = /^(<a class="source-link"[^>]*>.*?<\\/a>)\\s{2,}(\\S.*?)\\s*$/.exec(html);
    if (am) return '<span class="frame-member">' + am[2] + '</span> <span class="frame-lib-src">' + am[1] + '</span>';
    return html;
}
/** Map HTML numeric/hex entities that denote Unicode whitespace to a regular space.
 *  Keep in sync with decodeHtmlWhitespaceEntities in src/modules/misc/blank-line-text.ts. */
function decodeHtmlWhitespaceEntities(text) {
    return text.replace(/&#(?:x([0-9a-fA-F]+)|([0-9]+));?/gi, function (m, hex, dec) {
        var n = hex ? parseInt(hex, 16) : parseInt(dec || '0', 10);
        if (!isFinite(n)) return m;
        if ((n >= 9 && n <= 13) || n === 32 || n === 160) return ' ';
        if (n >= 8192 && n <= 8202) return ' ';
        if (n === 5760 || n === 8232 || n === 8233 || n === 8239 || n === 8287 || n === 12288) return ' ';
        return m;
    });
}
/** Normalize invisible / compatibility chars so NBSP / ZWSP / BOM-only rows count as blank.
 *  Keep in sync with src/modules/misc/blank-line-text.ts (export + tests). */
function normalizeForBlankCheck(text) {
    if (!text) return '';
    var s = decodeHtmlWhitespaceEntities(text);
    s = s.replace(/^\\uFEFF/, '');
    s = s.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ').replace(/&#xA0;/gi, ' ');
    s = s.replace(/[\\u00A0\\u1680\\u180E\\u2000-\\u200A\\u202F\\u205F\\u3000]/g, ' ');
    s = s.replace(/[\\u200B-\\u200D\\uFEFF\\u2060-\\u2064]/g, '');
    return s;
}
/** True if line has no visible content: raw stripTags blank, or (Format on) formatted output is blank.
    Result is memoized on item._contentBlank. recalcHeights() calls this for every row and the
    renderer calls it again per visible row, so the memo removes a repeated stripHtmlPrefix +
    stripTags + normalize pass on hot paths.

    The cache key (item._contentBlankKey) folds in the GLOBAL toggles that can flip the answer
    for a fixed item: structuredLineParsing (changes the parsed-prefix strip in log AND file
    mode) and formatEnabled (toggleFormat flips it in place and only calls recalcHeights — it
    does NOT rebuild items — so a file-mode row's formatted-output blankness can change under a
    stale key). fileMode is fixed per loaded file (a mode change reloads and rebuilds items) but
    is included for safety.

    The key does NOT cover item.html, which the manual line-edit feature mutates in place
    (saveEditedLine in viewer-edit-modal.ts). Any code that rewrites a line item's html without
    a rebuild MUST clear item._contentBlank so the next call recomputes — the edit site does. */
function isLineContentBlank(item) {
    if (!item || !item.html) return true;
    var _slp = (typeof structuredLineParsing !== 'undefined' && structuredLineParsing) ? 1 : 0;
    var _fmt = (typeof formatEnabled !== 'undefined' && formatEnabled) ? 1 : 0;
    var _fm = (typeof fileMode !== 'undefined') ? fileMode : 'log';
    var _key = _slp + '|' + _fmt + '|' + _fm;
    if (item._contentBlank !== undefined && item._contentBlankKey === _key) return item._contentBlank;
    var _shown = item.html;
    /* Blankness must be measured on what the row DISPLAYS, not on item.html. With
       structured parsing on, renderItem strips the parsed prefix, so a device line
       that logged an empty message — e.g. "07-10 08:23:05.388 924 17991 W keystore2:",
       where the logcat-threadtime regex yields msg = '' and prefixLen = the whole line
       — renders with nothing after the tag. Testing item.html would call it non-blank,
       so it was born at full ROW_HEIGHT and, worse, stayed a legal anchor for the
       hidden-gap reveal chevron: a blank row wearing an expander arrow.

       SCOPE: this applies to EVERY structured format, not just logcat. An empty-message
       sda-log / log4j / syslog line also collapses, which discards its tag or logger
       chip — buildDecoParts returns no cells for a blank row. That is deliberate: a row
       showing a tag and no text is not worth a row. The tag survives in copy output
       (viewer-copy.ts reads rawText) and reappears in full if structured parsing is off.

       INVARIANT: prefixLen is measured on stripTags(html) while stripHtmlPrefix counts
       each &entity; as one visible char, so the two agree only because escapeHtml emits
       exactly the five entities stripTags decodes (&amp; &lt; &gt; &quot; &#39;). A raw
       &nbsp; or numeric entity inside the PREFIX region would desync them and over-strip
       a real message into a false blank. Decorations use literal \\u00a0, never &nbsp;.

       Not a perfect mirror of renderItem: it also strips leading head-tag brackets. A
       structured line whose post-prefix body is only [head tags] would measure non-blank
       yet render as chips alone. Unreachable today — head tags parse from line start,
       before any timestamp — so the gap is recorded rather than coded around. */
    if (_slp && item.structuredPrefixLen > 0 && typeof stripHtmlPrefix === 'function') {
        _shown = stripHtmlPrefix(_shown, item.structuredPrefixLen);
    }
    var _blank = false;
    var base = normalizeForBlankCheck(stripTags(_shown));
    if (/^\\s*$/.test(base)) {
        _blank = true;
    } else if (typeof fileMode !== 'undefined' && fileMode !== 'log' && typeof formatEnabled !== 'undefined' && formatEnabled && item.type === 'line') {
        var wi = (typeof item.viewerLineIndex === 'number') ? item.viewerLineIndex : -1;
        if (wi >= 0) {
            var fmtProbe = '';
            if (fileMode === 'markdown' && typeof formatMarkdownLine === 'function') fmtProbe = formatMarkdownLine(item, wi);
            else if (fileMode === 'json' && typeof formatJsonLine === 'function') fmtProbe = formatJsonLine(item, wi);
            else if (fileMode === 'csv' && typeof formatCsvLine === 'function') fmtProbe = formatCsvLine(item, wi);
            else fmtProbe = item.html;
            var fmtPlain = normalizeForBlankCheck(stripTags(fmtProbe));
            if (/^\\s*$/.test(fmtPlain)) _blank = true;
        }
    }
    item._contentBlank = _blank;
    item._contentBlankKey = _key;
    return _blank;
}
`;
}
