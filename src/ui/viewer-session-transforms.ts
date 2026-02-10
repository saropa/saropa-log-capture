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
    var spaced = parts[0].replace(/[_-]+/g, ' ').trim();
    var titled = spaced.split(/\\s+/).map(function(w) {
        return w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }).join(' ');
    return (titled || parts[0]) + parts[1];
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

function renderSeverityDots(s) {
    var parts = [];
    if (s.errorCount > 0) parts.push('<span class="sev-dot sev-error"></span>' + s.errorCount);
    if (s.warningCount > 0) parts.push('<span class="sev-dot sev-warning"></span>' + s.warningCount);
    if (s.perfCount > 0) parts.push('<span class="sev-dot sev-perf"></span>' + s.perfCount);
    if (parts.length === 0) return '';
    var total = (s.errorCount || 0) + (s.warningCount || 0) + (s.perfCount || 0);
    var bar = total > 0 ? renderSeverityBar(s.errorCount || 0, s.warningCount || 0, s.perfCount || 0, total) : '';
    return '<span class="sev-dots">' + parts.join(' ') + bar + '</span>';
}

function renderSeverityBar(err, warn, perf, total) {
    var ePct = Math.round((err / total) * 100);
    var wPct = Math.round((warn / total) * 100);
    var pPct = 100 - ePct - wPct;
    return '<span class="sev-bar" title="' + total + ' issues"><span class="sev-bar-e" style="width:' + ePct + '%"></span><span class="sev-bar-w" style="width:' + wPct + '%"></span><span class="sev-bar-p" style="width:' + pPct + '%"></span></span>';
}

/** Mark the newest session per unique display name as isLatestOfName. */
function markLatestByName(sessions, applyOptions) {
    var byName = {};
    for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        if (s.trashed) continue;
        var name = applyOptions(s.displayName || s.filename);
        if (!byName[name] || (s.mtime || 0) > (byName[name].mtime || 0)) byName[name] = s;
    }
    var hasDupes = {};
    for (var j = 0; j < sessions.length; j++) {
        var sj = sessions[j];
        if (sj.trashed) continue;
        var nj = applyOptions(sj.displayName || sj.filename);
        if (!hasDupes[nj]) hasDupes[nj] = 0;
        hasDupes[nj]++;
    }
    for (var k = 0; k < sessions.length; k++) {
        var sk = sessions[k];
        var nk = applyOptions(sk.displayName || sk.filename);
        sk.isLatestOfName = !sk.trashed && hasDupes[nk] > 1 && byName[nk] === sk;
    }
}

/* --- Panel resize --- */
function initSessionPanelResize(panelEl, saveWidth) {
    var handle = document.getElementById('session-resize');
    if (!handle || !panelEl) return;
    var dragging = false;
    handle.addEventListener('mousedown', function(e) {
        e.preventDefault(); dragging = true;
        handle.classList.add('dragging');
        panelEl.style.transition = 'none';
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var vw = document.documentElement.clientWidth;
        var isRight = document.body.dataset.iconBar === 'right';
        var w = isRight ? vw - e.clientX : e.clientX;
        panelEl.style.width = Math.max(280, Math.min(vw * 0.8, w)) + 'px';
    });
    document.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('dragging');
        panelEl.style.transition = '';
        saveWidth(parseInt(panelEl.style.width, 10) || 0);
    });
}
`;
}
