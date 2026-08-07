/**
 * Webview-side JS for session display name transforms,
 * day heading formatting, and meta line helpers.
 *
 * These functions run in the webview and are used by the
 * session panel script (viewer-session-panel.ts).
 */

/** Return JS that defines session display transform + formatting functions. */
export function getSessionTransformsScript(): string {
    return /* js */ `
var leadingDatetimeRe = /^\\d{4}-?\\d{2}-?\\d{2}[_T -]?(?:\\d{2}[-:]?\\d{2}(?:[-:]?\\d{2})?[_ -]?)?/;
var leadingShortDateRe = /^\\d{6}[_T -]?(?:\\d{6}[_ -]?)?/;
var trailingDatetimeRe = /[_ -]\\d{4}-?\\d{2}-?\\d{2}(?:[_T -]?\\d{2}[-:]?\\d{2}(?:[-:]?\\d{2})?)?$/;
var trailingShortDateRe = /[_ -]\\d{6}(?:[_T -]?\\d{6})?$/;
var knownExtRe = /\\.(log|txt|md|csv|json|jsonl|html)$/i;

function splitFileExt(name) {
    var m = name.match(knownExtRe);
    if (m) return [name.slice(0, m.index), m[0]];
    return [name, ''];
}

function trimSessionSeconds(name) {
    var parts = splitFileExt(name);
    var trimmed = parts[0].replace(
        /(\\d{8}[_T -])(\\d{2})([-:]?)(\\d{2})\\3\\d{2}(?:[.,]\\d+)?/,
        '$1$2$3$4'
    );
    return trimmed + parts[1];
}

function stripSessionDatetime(name) {
    var parts = splitFileExt(name);
    var original = parts[0];
    var base = original;
    base = base.replace(leadingDatetimeRe, '') || base;
    if (base === original) base = base.replace(leadingShortDateRe, '') || base;
    base = base.replace(trailingDatetimeRe, '') || base;
    base = base.replace(trailingShortDateRe, '') || base;
    base = base.replace(/^[_ -]+|[_ -]+$/g, '');
    return (base || original) + parts[1];
}

function normalizeSessionName(name) {
    var parts = splitFileExt(name);
    // Dots are separators in names like "contacts.drift-advisor"
    var spaced = parts[0].replace(/[_.\-]+/g, ' ').trim();
    var titled = spaced.split(/\\s+/).map(function(w) {
        return w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }).join(' ');
    return (titled || parts[0]) + parts[1];
}

/** Extract basename from a path (strip folder prefix). */
function getSessionBasename(name) {
    var idx = name.lastIndexOf('/');
    return idx >= 0 ? name.substring(idx + 1) : name;
}

/* --- Day heading formatting --- */
var shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ordinalSuffix(n) {
    var s = ['th','st','nd','rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDayHeading(epochMs) {
    var d = new Date(epochMs);
    return dayNames[d.getDay()] + ', ' + ordinalSuffix(d.getDate()) + ' '
        + shortMonths[d.getMonth()] + ' ' + d.getFullYear();
}

function toDateKey(epochMs) {
    var d = new Date(epochMs);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/* --- Meta line helpers --- */
function formatSessionSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatSessionDuration(ms) {
    if (ms >= 3600000) {
        var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
        return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
    }
    if (ms >= 60000) {
        var min = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
        return s > 0 ? min + 'm ' + s + 's' : min + 'm';
    }
    return Math.round(ms / 1000) + 's';
}

/* Render the severity-dot chips that appear in each session row's meta line.
 * Order mirrors the viewer's top-bar so the same file reads consistently in both panels.
 * Each chip renders only when its count > 0 to keep crowded rows readable.
 * "Other" is the residual (lineCount minus all classified buckets) so structural rows
 * the classifier skipped — separators, stack frames — still appear as a count.
 * fwCount is V1-only (legacy "framework" bucket pre-classifyLevel migration) and
 * renders only when a stale V1 sidecar value is still around. */
/** Group a non-negative integer with thousands separators (1234 -> "1,234"). Forced to
 *  en-US so the separator is always a comma, matching the host's toLocaleString('en-US')
 *  use — a five-figure line count in a pill is unreadable without it. Shared by every
 *  count surface in the Logs panel (severity pills, day heading, pinned heading).
 *  Input is coerced to a finite integer first: counts are logically non-negative ints, but
 *  a malformed count field (undefined, a string, NaN from an arithmetic residual, Infinity)
 *  must never surface as "NaN" or "∞" inside a pill — it degrades to "0" instead. */
function groupThousands(n) {
    var v = (typeof n === 'number' && isFinite(n)) ? Math.trunc(n) : 0;
    return v.toLocaleString('en-US');
}
/** One severity chip: a filled high-contrast count pill (sev-count-<cls>) carrying the
 *  category's prefix letter AND count in one pill. The letter has no color of its own so it
 *  inherits the pill's per-category contrasting foreground — letter and number are the same
 *  color on the category-colored fill. Mirrors the viewer top-bar level pills so a log reads
 *  the same in the list and open. */
function sevPair(cls, letter, title, n) {
    return '<span class="sev-pair" title="' + title + '">'
        + '<span class="sev-count sev-count-' + cls + '">'
        + '<span class="sev-count-letter">' + letter + '</span>' + groupThousands(n) + '</span></span>';
}
function renderSeverityDots(s) {
    var parts = [];
    // Prefix letters mirror the toolbar level glyphs (E/W/I/P/T/N/D/DB); framework and the
    // residual "other" bucket have no toolbar equivalent, so they use FW / O.
    if (s.errorCount > 0) parts.push(sevPair('error', 'E', 'Errors', s.errorCount));
    if (s.warningCount > 0) parts.push(sevPair('warning', 'W', 'Warnings', s.warningCount));
    if (s.infoCount > 0) parts.push(sevPair('info', 'I', 'Info', s.infoCount));
    if (s.debugCount > 0) parts.push(sevPair('debug', 'D', 'Debug', s.debugCount));
    if (s.databaseCount > 0) parts.push(sevPair('database', 'DB', 'Database', s.databaseCount));
    if (s.perfCount > 0) parts.push(sevPair('perf', 'P', 'Performance', s.perfCount));
    if (s.todoCount > 0) parts.push(sevPair('todo', 'T', 'Todo', s.todoCount));
    if (s.noticeCount > 0) parts.push(sevPair('notice', 'N', 'Notice', s.noticeCount));
    if (s.fwCount > 0) parts.push(sevPair('fw', 'FW', 'Framework', s.fwCount));
    var categorized = (s.errorCount || 0) + (s.warningCount || 0) + (s.perfCount || 0)
        + (s.fwCount || 0) + (s.infoCount || 0) + (s.debugCount || 0)
        + (s.databaseCount || 0) + (s.todoCount || 0) + (s.noticeCount || 0);
    var other = (s.lineCount || 0) - categorized;
    if (other > 0) parts.push(sevPair('other', 'O', 'Other lines', other));
    if (parts.length === 0) return '';
    return '<span class="sev-dots">' + parts.join('') + '</span>';
}

/** Extract hours and minutes from a datetime pattern in the filename. */
function extractFilenameTime(name) {
    var base = splitFileExt(getSessionBasename(name))[0];
    var m = base.match(/^\\d{4}-?\\d{2}-?\\d{2}[_T -](\\d{2})[-:]?(\\d{2})/);
    if (!m) m = base.match(/^\\d{6}[_T -](\\d{2})[-:]?(\\d{2})/);
    if (!m) m = base.match(/[_ -]\\d{4}-?\\d{2}-?\\d{2}[_T -](\\d{2})[-:]?(\\d{2})/);
    return m ? { hours: parseInt(m[1], 10), minutes: parseInt(m[2], 10) } : null;
}

/** Format hours and minutes as 12-hour time (e.g. "10:19 AM"). */
function formatTime12hFromParts(hours, minutes) {
    var h = hours % 12 || 12;
    var ampm = hours >= 12 ? 'PM' : 'AM';
    return h + ':' + pad2(minutes) + ' ' + ampm;
}

/* Mark each session that is the newest entry under its visible display name.
   Key choice: this used to apply transforms to the FULL stored path (which may
   carry a subfolder prefix added during disambiguation). The rendered row
   shows only the basename, so two files with the same basename in different
   subfolders displayed as the same name yet were tracked under different keys
   here — both ended up flagged as "latest" and the "Latest only" filter
   surfaced both. Always key on the basename so this matches what renderItem
   shows, and what the user therefore reads as "the same name".

   isLatestOfName powers the "Latest only" view (which must include singles
   too — a name with one entry IS the latest of that name). hasNamesakes is a
   separate flag used purely for the rendered badge so the dim "(latest)"
   chrome only appears when there is more than one to disambiguate from.

   In "Latest only" mode the older namesakes are no longer hard-filtered out of
   the list (they used to vanish without a trace). Instead each latest row keeps
   _canonName (the exact key these counts were bucketed under, so render and the
   "+N older" expand toggle agree) and _olderCount (how many older same-name
   rows are hidden behind it). The render layer shows "+N older" on the latest
   row and reveals the hidden rows on click — discoverability the hard filter
   destroyed. */
function markLatestByName(sessions, applyOptions) {
    var byName = {};
    var counts = {};
    for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        if (s.trashed) continue;
        var name = applyOptions(getSessionBasename(s.displayName || s.filename));
        counts[name] = (counts[name] || 0) + 1;
        if (!byName[name] || (s.mtime || 0) > (byName[name].mtime || 0)) byName[name] = s;
    }
    for (var k = 0; k < sessions.length; k++) {
        var sk = sessions[k];
        var nk = applyOptions(getSessionBasename(sk.displayName || sk.filename));
        sk._canonName = nk;
        sk.isLatestOfName = !sk.trashed && byName[nk] === sk;
        sk.hasNamesakes = !sk.trashed && (counts[nk] || 0) > 1;
        // Older-count lives on the LATEST row only (the one that renders the badge); every
        // namesake minus the latest itself. 0 on trashed rows and on names with no namesakes.
        sk._olderCount = (sk.isLatestOfName && !sk.trashed) ? Math.max(0, (counts[nk] || 0) - 1) : 0;
    }
}

/* --- Panel resize (controls slot width; every panel fills via CSS width:100%) ---
   The handle lives on #panel-slot, not inside any single panel, so resizing
   applies to whichever panel is currently shown. Bound once at startup. */
function initPanelSlotResize(saveWidth) {
    var handle = document.getElementById('panel-slot-resize');
    var slotEl = document.getElementById('panel-slot');
    if (!handle || !slotEl) return;
    var dragging = false;
    /* True once the pointer actually moves during a drag. A press without
       movement is a plain click and must NOT be swallowed (see the capture
       handler below); only a real resize drag should suppress its trailing
       click. */
    var moved = false;
    /* Anchor the drag to where it started. The old code set the width from the
       absolute mouse X (e.clientX, or vw - e.clientX on a right icon bar), which
       is NOT the slot's current width — it's off by the icon-bar width and any
       other left offset. That mismatch made the panel snap sideways the instant
       you grabbed the handle. Tracking a delta from the start position keeps the
       first move a no-op. */
    var startX = 0;
    var startWidth = 0;
    handle.addEventListener('mousedown', function(e) {
        e.preventDefault(); dragging = true; moved = false;
        startX = e.clientX;
        startWidth = slotEl.getBoundingClientRect().width;
        handle.classList.add('dragging');
        slotEl.style.transition = 'none';
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        moved = true;
        var vw = document.documentElement.clientWidth;
        var isRight = document.body.dataset.iconBar === 'right';
        /* On a right-side icon bar the panel grows as the mouse moves left, so
           the delta sign is inverted. */
        var delta = isRight ? (startX - e.clientX) : (e.clientX - startX);
        /* 420 floor matches the CSS .session-panel min-width and the JS
           MIN_PANEL_WIDTH constants. Any divergence here re-introduces the
           bug where the drag handle refused to shrink past 560 even though
           the other gates allowed it. */
        var w = Math.max(420, Math.min(vw * 0.8, startWidth + delta)) + 'px';
        slotEl.style.width = w;
    });
    document.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('dragging');
        slotEl.style.transition = '';
        saveWidth(parseInt(slotEl.style.width, 10) || 0);
        /* Guard against a drag that ends without a trailing click (rare browser
           cases): clear the flag on the next tick so a stale 'moved' can never
           swallow a future genuine click. The real post-drag click fires before
           this timeout, so the capture handler below still consumes it. */
        setTimeout(function() { moved = false; }, 0);
    });
    /* A drag ends with a synthetic 'click' fired on the common ancestor of the
       press and release targets — usually OUTSIDE the open panel. Every slide-out
       panel has an outside-click dismiss handler (e.g. the Crashlytics list), so
       without this guard, resizing the slot would immediately close the panel you
       were trying to make room for. Swallow that one click in the capture phase
       (before any bubble-phase dismiss handler) when it follows a real drag. */
    document.addEventListener('click', function(e) {
        if (!moved) return;
        moved = false;
        e.stopPropagation();
        e.preventDefault();
    }, true);
}
`;
}
