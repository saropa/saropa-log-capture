/**
 * Core viewer data helpers: escapeHtml, repeat tracking, separator/context detection, calcItemHeight.
 *
 * SQL drilldown UI functions (DB_06) live in viewer-data-sql-drilldown-ui.ts.
 * Drift N+1 burst detection lives in viewer-data-n-plus-one-script.ts.
 */
import { escapeHtmlScript } from '../escape-html-script';

export function getViewerDataHelpersCore(): string {
    return /* javascript */ `
${escapeHtmlScript('escapeHtml')}
var repeatTracker = {
    lastHash: null,
    lastPlainText: null,
    lastLevel: null,
    count: 0,
    lastTimestamp: 0,
    lastLineIndex: -1,
    /** Minimum occurrences before repeat-collapse for the current streak (Drift verb–specific or global). */
    streakMinN: 2,
    /** True when current streak uses SQL fingerprint repeat key (database + parseSqlFingerprint). */
    streakSqlFp: false,
    /** Truncated sqlSnippet for repeat row preview when streakSqlFp. */
    sqlRepeatPreview: null,
    /** Fingerprint for the active SQL streak (DB_06 drilldown snapshot). */
    sqlStreakFingerprint: null,
    /** Full snippet capped for drilldown storage (not the short repeat-preview string). */
    sqlStreakSqlSnippet: '',
    sqlStreakFirstTs: 0,
    sqlStreakLastTs: 0,
    /** Distinct argsKey values in first-seen order (parallel counts in sqlStreakVariantCounts). */
    sqlStreakVariantOrder: [],
    sqlStreakVariantCounts: null,
    // Index in allLines of the single repeat-notification row for the active streak (updated in place).
    lastRepeatNotificationIndex: -1
};
var anrPattern = /\\b(anr|application\\s+not\\s+responding|input\\s+dispatching\\s+timed\\s+out)\\b/i;
/** Tracks consecutive separator lines with the same timestamp for art-block grouping. */
var artBlockTracker = { startIdx: -1, timestamp: 0, count: 0 };
/** Finalize an open art block: tag each line with its position ('start', 'middle', 'end'). */
function finalizeArtBlock() {
    if (artBlockTracker.count < 2 || artBlockTracker.startIdx < 0) {
        artBlockTracker.startIdx = -1;
        artBlockTracker.count = 0;
        return;
    }
    var end = artBlockTracker.startIdx + artBlockTracker.count - 1;
    for (var ai = artBlockTracker.startIdx; ai <= end; ai++) {
        var it = allLines[ai];
        if (ai === artBlockTracker.startIdx) it.artBlockPos = 'start';
        else if (ai === end) it.artBlockPos = 'end';
        else it.artBlockPos = 'middle';
    }
    /* Stamp the row count on the start row so the collapse chevron can show
       "N lines" without re-walking the block on every render (toggle lives in
       toggleAsciiArtBlock; height gating in calcItemHeight reads artCollapsed). */
    allLines[artBlockTracker.startIdx].artBlockCount = artBlockTracker.count;
    artBlockTracker.startIdx = -1;
    artBlockTracker.count = 0;
}
var repeatWindowMs = 3000;
var repeatPreviewLength = 85;
function generateRepeatHash(level, plainText) {
    var preview = plainText.substring(0, 200).trim();
    if (!preview) return null;
    return level + '::' + preview;
}
function cleanupTrailingRepeats() {
    /* bug_003: stack-header repeat streak cleanup at marker boundaries. Independent of
       the SQL tracker — a marker can arrive after a pure stack-header streak (no SQL
       involvement). Restore the anchor and its frame visibility, then zero the chip.
       Runs before the early-return below so it fires even when SQL tracker is idle. */
    if (typeof stackHdrRepeatTracker !== 'undefined' &&
        stackHdrRepeatTracker.anchorIdx >= 0 &&
        stackHdrRepeatTracker.anchorIdx < allLines.length) {
        var sAnchor = allLines[stackHdrRepeatTracker.anchorIdx];
        if (sAnchor && sAnchor.repeatHidden) {
            sAnchor.repeatHidden = false;
            /* Restore the default collapse state so frames under the anchor render
               again; tryCollapseRepeatStackHeader forced collapsed=true to hide them
               while the streak was active. */
            var _sds = (typeof stackDefaultState !== 'undefined') ? stackDefaultState : false;
            sAnchor.collapsed = _sds;
            sAnchor.height = calcItemHeight(sAnchor);
            totalHeight += sAnchor.height;
        }
        if (stackHdrRepeatTracker.lastRepeatNotificationIdx >= 0 &&
            stackHdrRepeatTracker.lastRepeatNotificationIdx < allLines.length) {
            var sChip = allLines[stackHdrRepeatTracker.lastRepeatNotificationIdx];
            if (sChip && sChip.type === 'repeat-notification' && sChip.stackHdrRepeat && sChip.height > 0) {
                totalHeight -= sChip.height;
                sChip.height = 0;
            }
        }
        stackHdrRepeatTracker.anchorIdx = -1;
        stackHdrRepeatTracker.count = 0;
        stackHdrRepeatTracker.lastTimestamp = 0;
        stackHdrRepeatTracker.lastRepeatNotificationIdx = -1;
    }
    if (repeatTracker.count <= 1 || repeatTracker.lastLineIndex < 0) return;
    if (repeatTracker.lastLineIndex < allLines.length) {
        var orig = allLines[repeatTracker.lastLineIndex];
        /* SQL path: original was hidden behind a notification row — restore it. */
        if (orig && orig.repeatHidden) {
            orig.repeatHidden = false;
            orig.height = calcItemHeight(orig);
            totalHeight += orig.height;
        }
        /* Non-SQL path: all duplicate lines are stored in allLines normally;
           the compress dedup algorithm handles grouping. No cleanup needed. */
    }
    /* SQL path: hide trailing notification rows that were replaced by the restored original. */
    for (var ri = allLines.length - 1; ri >= 0; ri--) {
        if (allLines[ri].type !== 'repeat-notification') break;
        totalHeight -= allLines[ri].height;
        allLines[ri].height = 0;
    }
    repeatTracker.lastHash = null;
    repeatTracker.lastPlainText = null;
    repeatTracker.lastLevel = null;
    repeatTracker.count = 0;
    repeatTracker.lastTimestamp = 0;
    repeatTracker.lastLineIndex = -1;
    repeatTracker.streakMinN = 2;
    repeatTracker.streakSqlFp = false;
    repeatTracker.sqlRepeatPreview = null;
    repeatTracker.sqlStreakFingerprint = null;
    repeatTracker.sqlStreakSqlSnippet = '';
    repeatTracker.sqlStreakFirstTs = 0;
    repeatTracker.sqlStreakLastTs = 0;
    repeatTracker.sqlStreakVariantOrder = [];
    repeatTracker.sqlStreakVariantCounts = null;
    repeatTracker.lastRepeatNotificationIndex = -1;
}
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
/** True if line has no visible content: raw stripTags blank, or (Format on) formatted output is blank. */
function isLineContentBlank(item) {
    if (!item || !item.html) return true;
    var _shown = item.html;
    /* Blankness must be measured on what the row DISPLAYS, not on item.html. With
       structured parsing on, renderItem strips the parsed prefix, so a device line
       that logged an empty message — e.g. "07-10 08:23:05.388 924 17991 W keystore2:",
       where the logcat-threadtime regex yields msg = '' and prefixLen = the whole line
       — renders with nothing after the tag. Testing item.html would call it non-blank,
       so it was born at full ROW_HEIGHT and, worse, stayed a legal anchor for the
       hidden-gap reveal chevron: a blank row wearing an expander arrow. */
    if (typeof structuredLineParsing !== 'undefined' && structuredLineParsing
        && item.structuredPrefixLen > 0 && typeof stripHtmlPrefix === 'function') {
        _shown = stripHtmlPrefix(_shown, item.structuredPrefixLen);
    }
    var base = normalizeForBlankCheck(stripTags(_shown));
    if (/^\\s*$/.test(base)) return true;
    if (typeof fileMode !== 'undefined' && fileMode !== 'log' && typeof formatEnabled !== 'undefined' && formatEnabled && item.type === 'line') {
        var wi = (typeof item.viewerLineIndex === 'number') ? item.viewerLineIndex : -1;
        if (wi >= 0) {
            var fmtProbe = '';
            if (fileMode === 'markdown' && typeof formatMarkdownLine === 'function') fmtProbe = formatMarkdownLine(item, wi);
            else if (fileMode === 'json' && typeof formatJsonLine === 'function') fmtProbe = formatJsonLine(item, wi);
            else if (fileMode === 'csv' && typeof formatCsvLine === 'function') fmtProbe = formatCsvLine(item, wi);
            else fmtProbe = item.html;
            var fmtPlain = normalizeForBlankCheck(stripTags(fmtProbe));
            if (/^\\s*$/.test(fmtPlain)) return true;
        }
    }
    return false;
}
function calcItemHeight(item) {
    /* peekOverride: scoped peek triggered by a .viewer-divider show-gap click or
       a .dedup-badge expand (see viewer-peek-chevron.ts and bugs/048_plan-severity-gutter-decoupling.md).
       Bypasses every filter/hide gate so the user can reveal exactly one gap's worth of
       hidden lines without disturbing the global filter state. Does NOT override
       continuation/stack-group collapse — those are explicit user actions, not filters. */
    if (!item.peekOverride) {
        if (item.filteredOut || item.excluded || item.levelFiltered || item.troubleFiltered || item.flowFiltered || item.sourceFiltered || item.classFiltered || item.sqlPatternFiltered || item.searchFiltered || item.errorSuppressed || item.scopeFiltered || item.repeatHidden || item.compressDupHidden || item.stackDedupHidden || item.metadataFiltered) return 0;
        if (item.type === 'line' && item.timeRangeFiltered) return 0;
        var _peeking = (typeof isPeeking !== 'undefined' && isPeeking);
        if (!_peeking && (item.userHidden || item.autoHidden)) return 0;
    }
    if (item.contIsChild && item.contGroupId >= 0 && typeof contHeaderMap !== 'undefined') {
        var contHdr = contHeaderMap[item.contGroupId];
        if (contHdr && contHdr.contCollapsed) return 0;
    }
    /* Flutter exception banner collapse: hide body/footer rows when the group's
       header is collapsed (collapsed by default). The header (bannerRole 'header')
       always renders so the user keeps a clickable title. Placed after the filter
       gates above (with peekOverride) because this is an explicit user collapse, not
       a filter — same treatment as the continuation-collapse gate above it. */
    if (item.bannerGroupId !== undefined && item.bannerGroupId >= 0 && item.bannerRole !== 'header' && typeof bannerHeaderMap !== 'undefined') {
        var bHdr = bannerHeaderMap[item.bannerGroupId];
        if (bHdr && bHdr.bannerCollapsed) return 0;
    }
    /* Blank lines always render at quarter height — compact enough to not
     * waste space, tall enough to preserve paragraph breaks. Placed after
     * the continuation-collapse gate so collapsed children stay fully hidden. */
    if (item.type === 'line' && isLineContentBlank(item)) return Math.max(4, Math.floor(ROW_HEIGHT / 4));
    /* ASCII art block rows use a compact height so consecutive box-drawing
       strokes (│, ║, ─) connect without visible gaps. Matches the CSS in
       viewer-styles-ascii-art.ts: start/end = 1em + 6px padding, middle = 1em.
       WHY logFontSize and not ROW_HEIGHT: ROW_HEIGHT is measured from a .line
       probe with line-height 1.5 (base rule), but art-block lines override to
       line-height 1. Returning ROW_HEIGHT here would leave ~0.5em of empty
       space below each art row and the scroller's prefix sums would be taller
       than the rendered block, producing drift in subsequent row positions. */
    /* Collapse (toggleAsciiArtBlock sets artCollapsed on every row of the block):
       the start row stays visible as the toggle anchor + "N lines" affordance;
       middle/end rows hide entirely. Default (artCollapsed falsy) = fully expanded. */
    if (item.artBlockPos === 'start') return logFontSize + 6;
    if (item.artBlockPos === 'end') return item.artCollapsed ? 0 : logFontSize + 6;
    if (item.artBlockPos === 'middle') return item.artCollapsed ? 0 : logFontSize;
    /* Structured file collapse (plan 051): markdown sections, JSON brace pairs, comment blocks. */
    if (item._mdSectionHidden || item._jsonSectionHidden || item._mdCommentHidden) return 0;
    /* Markdown table separator row (|---|): collapse to nothing. The header row carries a
       bottom border as the divider, so a full-height empty separator would only add a gap. */
    if (item._mdTableSep && typeof formatEnabled !== 'undefined' && formatEnabled && typeof fileMode !== 'undefined' && fileMode === 'markdown') return 0;
    /* Markdown headings get a taller row for the larger font + vertical breathing room on top
       of the comfortable document line height (applyMarkdownTypography). Body spacing itself
       comes from that line height, NOT a per-line multiplier — so this only adds heading
       hierarchy. renderItem pins this exact value as the line's inline height, so the rendered
       DOM height matches this scroll-math value precisely (no prefix-sum drift). */
    /* Heading rows are sized from the heading's own font requirement (mdHeadingRowHeight) so
       they fit the larger font without overlap; renderItem pins this exact value inline. */
    if (item._mdHeadingLevel && typeof formatEnabled !== 'undefined' && formatEnabled && typeof fileMode !== 'undefined' && fileMode === 'markdown' && typeof mdHeadingRowHeight === 'function') {
        return mdHeadingRowHeight(item, ROW_HEIGHT, (typeof logLineHeight === 'number' ? logLineHeight : 1.1));
    }
    /* Top-level list item: add ~0.4 row of top space (rendered as padding-top, border-box) so
       consecutive multi-line bullets are visually separated. */
    if (item._mdBulletTop && typeof formatEnabled !== 'undefined' && formatEnabled && typeof fileMode !== 'undefined' && fileMode === 'markdown') {
        return ROW_HEIGHT + Math.ceil(0.4 * ROW_HEIGHT);
    }
    if (item.type === 'marker') {
        /* markerHidden / markerCollapsed are set by applyDbSignalMarkerVisibility and
           applyConsecutiveDbMarkerCollapse (viewer-data-marker-filter). Honouring them here
           is the single source of truth for marker visibility — without this gate, collapsed
           or orphaned db-signal markers still occupy a row despite the filter pass running. */
        if (item.markerHidden || item.markerCollapsed) return 0;
        return MARKER_HEIGHT;
    }
    if (item.type === 'run-separator') return (typeof RUN_SEPARATOR_HEIGHT !== 'undefined') ? RUN_SEPARATOR_HEIGHT : 72;
    var _tierHidden = (typeof isTierHidden === 'function') ? isTierHidden(item) : false;
    if (item.type === 'stack-frame' && item.groupId >= 0) {
        var header = (typeof groupHeaderMap !== 'undefined') ? groupHeaderMap[item.groupId] : null;
        if (!header) return 0;
        if (header.collapsed === true) return 0;
        if (header.collapsed === false) {
            return (_tierHidden) ? 0 : ROW_HEIGHT;
        }
        if (header.collapsed === 'preview') {
            if (item.fw) return 0;
            var appIdx = (item._appFrameIdx !== undefined) ? item._appFrameIdx : -1;
            return (appIdx >= 0 && appIdx < (header.previewCount || 3)) ? ROW_HEIGHT : 0;
        }
        return 0;
    }
    /* Tier hide is a filter, not an explicit collapse — peekOverride bypasses it too. */
    if (_tierHidden && !item.peekOverride) return 0;
    if (item.type === 'repeat-notification' && item.sqlRepeatDrilldown && item.sqlRepeatDrilldownOpen) {
        return ROW_HEIGHT + estimateSqlRepeatDrilldownExtraHeight(item.sqlRepeatDrilldown);
    }
    return ROW_HEIGHT;
}
`;
}
