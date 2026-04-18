/**
 * Signal panel script part B: utils, hot files, environment, and unified signal renderers.
 * Concatenated by viewer-signal-panel-script.ts to stay under max-lines.
 */

/** Returns the second fragment of the Signal panel IIFE (render helpers and lists). */
export function getSignalScriptPartB(maxRecurringTextLen: number): string {
    return /* js */ `
    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function escapeAttr(str) { return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    var maxRecurringTextLen = ${maxRecurringTextLen};
    function truncateForDisplay(text) { var t = (text || '').trim(); return t.length <= maxRecurringTextLen ? t : t.slice(0, maxRecurringTextLen) + '\\u2026'; }
    function formatUpdatedAgo(ms) {
        if (ms == null || !Number.isFinite(ms)) return '';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3600000) return Math.floor(d / 60000) + ' min ago';
        if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
        if (d < 604800000) return Math.floor(d / 86400000) + ' days ago';
        return Math.floor(d / 604800000) + 'w ago';
    }

    function renderHotFiles() {
        var summaryEl = document.getElementById('signal-hotfiles-summary');
        var emptyEl = document.getElementById('signal-hotfiles-empty');
        var listEl = document.getElementById('signal-hotfiles-list');
        var files = signalDataCache.hotFiles || [];
        if (summaryEl) summaryEl.textContent = files.length === 0 ? 'Frequently modified files' : (files.length + ' file' + (files.length === 1 ? '' : 's') + ' frequently modified');
        var toShow = files.slice(0, 5);
        if (emptyEl) emptyEl.style.display = toShow.length === 0 ? '' : 'none';
        if (listEl) {
            listEl.innerHTML = toShow.length === 0 ? '' : toShow.map(function(f) {
                return '<div class="signal-hotfile-item"><span class="signal-hotfile-name">' + esc(f.filename) + '</span><span class="signal-hotfile-meta">' + (f.sessionCount || 0) + ' session' + (f.sessionCount === 1 ? '' : 's') + '</span></div>';
            }).join('');
        }
    }
    function envGroupHtml(title, items) {
        if (!items.length) return '';
        var rows = items.slice(0, 5).map(function(p) { return '<div class="signal-env-row"><span>' + esc(p.value) + '</span><span class="signal-hotfile-meta">' + p.sessionCount + '</span></div>'; }).join('');
        return '<div class="signal-env-group"><div class="signal-env-title">' + title + '</div>' + rows + '</div>';
    }
    function renderEnvironment() {
        var summaryEl = document.getElementById('signal-environment-summary');
        var listEl = document.getElementById('signal-environment-list');
        var platforms = signalDataCache.platforms || [], sdks = signalDataCache.sdkVersions || [], adapters = signalDataCache.debugAdapters || [];
        var total = platforms.length + sdks.length + adapters.length;
        if (summaryEl) summaryEl.textContent = total === 0 ? 'Environment' : ('Environment (' + total + ' entries)');
        if (!listEl) return;
        var parts = [envGroupHtml('Platforms', platforms), envGroupHtml('SDK / runtime', sdks), envGroupHtml('Debug adapters', adapters)].filter(Boolean);
        listEl.innerHTML = parts.length === 0 ? '<p class="signal-hotfiles-empty">No environment data across sessions.</p>' : parts.join('');
    }

    /** Human-readable labels for signal kinds. */
    var kindLabels = {
        error: '\u26D4', warning: '\u26A0\uFE0F', perf: '\u23F1\uFE0F', sql: '\uD83D\uDDC4\uFE0F',
        network: '\uD83C\uDF10', memory: '\uD83E\uDDE0', 'slow-op': '\uD83D\uDC22',
        anr: '\u26A0\uFE0F', permission: '\uD83D\uDD12', classified: '\uD83D\uDEA8'
    };

    /** Format duration for display (ms → readable). */
    function fmtMs(ms) { return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : Math.round(ms) + 'ms'; }

    /** Extract lint rule name from signal detail and build a clickable link button. */
    function buildLintRuleLink(detail) {
        if (!detail) return '';
        /* Match pattern: [saropa_lints] rule_name (severity): message */
        var m = detail.match(/\\[saropa_lints\\]\\s+(\\S+)\\s+\\(/);
        if (!m) return '';
        var rule = m[1];
        return ' <span class="re-action signal-lint-link" role="button" title="Open rule docs for ' + esc(rule) + '" data-rule="' + esc(rule) + '" data-source="saropa_lints">\\uD83D\\uDCCB Rule</span>';
    }

    /** Build triage buttons for error-kind signals (Close/Mute/Re-open). */
    function buildTriageHtml(s) {
        if (s.kind !== 'error' && s.kind !== 'warning') return '';
        var status = (signalDataCache.statuses || {})[s.fingerprint] || 'open';
        if (status === 'open') return ' <span class="re-action" data-hash="' + esc(s.fingerprint) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(s.fingerprint) + '" data-status="muted">Mute</span>';
        return ' <span class="re-action" data-hash="' + esc(s.fingerprint) + '" data-status="open">Re-open</span>';
    }

    /** Render the unified signal list across sessions — the single cross-session signal view. */
    function renderSignalTrends() {
        var listEl = document.getElementById('signal-trends-list'), emptyEl = document.getElementById('signal-trends-empty'), summaryEl = document.getElementById('signal-trends-summary');
        /* Filter out muted error/warning signals — same triage filtering the old recurring list had */
        var allSignals = (signalDataCache.allSignals || []).filter(function(s) {
            if (s.kind !== 'error' && s.kind !== 'warning') return true;
            return (signalDataCache.statuses || {})[s.fingerprint] !== 'muted';
        }).slice(0, 30);
        if (summaryEl) summaryEl.textContent = allSignals.length === 0 ? 'All signals' : 'All signals (' + allSignals.length + ')';
        if (allSignals.length === 0) { if (listEl) listEl.innerHTML = ''; if (emptyEl) emptyEl.style.display = ''; return; }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = allSignals.map(function(s) {
            var icon = kindLabels[s.kind] || '\u2139\uFE0F';
            var text = s.label.length > 60 ? s.label.slice(0, 57) + '...' : s.label;
            var meta = s.sessionCount + ' session' + (s.sessionCount === 1 ? '' : 's') + ', ' + s.totalOccurrences + ' total';
            if (s.avgDurationMs) { meta += ', avg ' + fmtMs(s.avgDurationMs); }
            if (s.maxDurationMs) { meta += ', max ' + fmtMs(s.maxDurationMs); }
            if (s.category) { meta += ' [' + esc(s.category) + ']'; }
            var lintBtn = buildLintRuleLink(s.detail || '');
            var daBtn = s.kind === 'sql' ? ' <span class="re-action signal-da-link" role="button" title="Open Drift Advisor">\\uD83D\\uDD0D DA</span>' : '';
            var sevCls = s.severity === 'critical' ? ' signal-sev-critical' : s.severity === 'high' ? ' signal-sev-high' : '';
            var recurBadge = s.recurring ? ' <span class="signal-recurring-badge" title="Recurring in ' + s.sessionCount + ' sessions">\u21BB</span>' : '';
            var trendBadge = '';
            if (s.trend === 'increasing') { trendBadge = ' <span class="signal-trend-up" title="Increasing">\u2191</span>'; }
            else if (s.trend === 'decreasing') { trendBadge = ' <span class="signal-trend-down" title="Decreasing">\u2193</span>'; }
            else if (s.trend === 'stable') { trendBadge = ' <span class="signal-trend-stable" title="Stable">\u2014</span>'; }
            var triageHtml = buildTriageHtml(s);
            var dimCls = (signalDataCache.statuses || {})[s.fingerprint] === 'closed' ? ' re-closed' : '';
            return '<div class="signal-env-row signal-trend-row' + sevCls + dimCls + '" data-signal-type="' + esc(s.kind) + '" title="' + esc(s.label) + '">'
                + '<span>' + icon + recurBadge + trendBadge + ' ' + esc(text) + '</span>'
                + '<span class="signal-hotfile-meta">' + meta + '</span>' + lintBtn + daBtn + triageHtml + '</div>';
        }).join('');
    }

    /** Render signals detected in the current log session (all kinds). Also manages the "This log" empty state. */
    function renderSignalsInThisLog() {
        var listEl = document.getElementById('signals-in-log-list'), summaryEl = document.getElementById('signals-in-log-summary');
        var emptyBlock = document.getElementById('signal-this-log-empty');
        var signals = signalDataCache.signalsInThisLog || [];
        if (summaryEl) summaryEl.textContent = signals.length === 0 ? 'Signals in this log' : 'Signals in this log (' + signals.length + ')';
        if (emptyBlock) emptyBlock.style.display = signals.length === 0 ? '' : 'none';
        if (!listEl) { return; }
        if (signals.length === 0) { listEl.innerHTML = ''; return; }
        listEl.innerHTML = signals.slice(0, 20).map(function(s) {
            var icon = kindLabels[s.kind] || '\u2139\uFE0F', text = s.label.length > 50 ? s.label.slice(0, 47) + '...' : s.label;
            var meta = s.totalOccurrences + 'x' + (s.avgDurationMs ? ', avg ' + fmtMs(s.avgDurationMs) : '');
            var lineAttr = s.lineIndices && s.lineIndices.length > 0 ? ' data-line="' + s.lineIndices[0] + '"' : '';
            var clickCls = lineAttr ? ' signal-jumpable' : '';
            return '<div class="signal-env-row signal-in-log-row' + clickCls + '"' + lineAttr + ' title="' + esc(s.label) + (lineAttr ? ' — click to jump' : '') + '"><span>' + icon + ' ' + esc(text) + '</span><span class="signal-hotfile-meta">' + meta + '</span></div>';
        }).join('');
    }
`;
}
