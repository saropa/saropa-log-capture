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
        if (d < 60000) return SIGNAL_STRINGS.timeJustNow;
        if (d < 3600000) return fillSignalString(SIGNAL_STRINGS.timeMinAgo, Math.floor(d / 60000));
        if (d < 86400000) return fillSignalString(SIGNAL_STRINGS.timeHoursAgo, Math.floor(d / 3600000));
        if (d < 604800000) return fillSignalString(SIGNAL_STRINGS.timeDaysAgo, Math.floor(d / 86400000));
        return fillSignalString(SIGNAL_STRINGS.timeWeeksAgo, Math.floor(d / 604800000));
    }

    /** Plan 053-A: render the pending filter-suggestions section inside the Insights panel.
     *  Block is hidden entirely when no pending suggestions (don't show empty headers). Each row
     *  has Accept and Reject actions delegated through the panel's click handler. */
    function renderFilterSuggestions() {
        var blockEl = document.getElementById('signal-suggestions-block');
        var listEl = document.getElementById('signal-suggestions-list');
        var summaryEl = document.getElementById('signal-suggestions-summary');
        var items = signalSuggestionsCache || [];
        if (!blockEl || !listEl) return;
        if (items.length === 0) { blockEl.style.display = 'none'; listEl.innerHTML = ''; return; }
        blockEl.style.display = '';
        if (summaryEl) summaryEl.textContent = fillSignalString(SIGNAL_STRINGS.suggestionsSummary, items.length);
        listEl.innerHTML = items.slice(0, 8).map(function(s) {
            var pat = s.pattern.length > 64 ? s.pattern.slice(0, 61) + '\\u2026' : s.pattern;
            var pct = (s.impact && typeof s.impact.percentageReduction === 'number') ? s.impact.percentageReduction : 0;
            var lines = (s.impact && typeof s.impact.linesAffected === 'number') ? s.impact.linesAffected : 0;
            var sample = (s.sampleLines && s.sampleLines[0]) ? s.sampleLines[0] : '';
            var sampleCompact = sample.length > 90 ? sample.slice(0, 87) + '\\u2026' : sample;
            return '<div class="signal-suggestion-row" data-sid="' + esc(s.id) + '">'
                + '<div class="signal-suggestion-head"><code class="signal-suggestion-pattern" title="' + esc(s.pattern) + '">' + esc(pat) + '</code><span class="signal-suggestion-impact">' + esc(fillSignalString(SIGNAL_STRINGS.suggestionImpact, lines, pct)) + '</span></div>'
                + (sampleCompact ? '<div class="signal-suggestion-sample" title="' + esc(sample) + '">' + esc(sampleCompact) + '</div>' : '')
                + '<div class="signal-suggestion-actions">'
                +   '<button type="button" class="signal-suggestion-accept" data-sid="' + esc(s.id) + '" data-pattern="' + escapeAttr(s.pattern) + '">' + esc(SIGNAL_STRINGS.accept) + '</button>'
                +   '<button type="button" class="signal-suggestion-reject" data-sid="' + esc(s.id) + '">' + esc(SIGNAL_STRINGS.reject) + '</button>'
                + '</div>'
                + '</div>';
        }).join('');
    }

    function renderHotFiles() {
        var summaryEl = document.getElementById('signal-hotfiles-summary');
        var emptyEl = document.getElementById('signal-hotfiles-empty');
        var listEl = document.getElementById('signal-hotfiles-list');
        var files = signalDataCache.hotFiles || [];
        if (summaryEl) summaryEl.textContent = files.length === 0 ? SIGNAL_STRINGS.hotfilesSummaryEmpty : fillSignalString(files.length === 1 ? SIGNAL_STRINGS.hotfilesSummaryOne : SIGNAL_STRINGS.hotfilesSummaryMany, files.length);
        var toShow = files.slice(0, 5);
        if (emptyEl) emptyEl.style.display = toShow.length === 0 ? '' : 'none';
        if (listEl) {
            listEl.innerHTML = toShow.length === 0 ? '' : toShow.map(function(f) {
                var meta = fillSignalString(f.sessionCount === 1 ? SIGNAL_STRINGS.hotfilesSessionsOne : SIGNAL_STRINGS.hotfilesSessionsMany, (f.sessionCount || 0));
                // Freshness overlay (idea #12): a recently-changed hot file is a prime suspect — churn meets noise.
                if (f.freshness && f.freshness !== 'unknown' && typeof f.lastCommitDaysAgo === 'number') {
                    var dot = f.freshness === 'recent' ? '🔴' : f.freshness === 'moderate' ? '🟡' : '🟢';
                    meta += ' · ' + dot + ' ' + esc(fillSignalString(SIGNAL_STRINGS.hotfilesChangedDaysAgo, f.lastCommitDaysAgo));
                }
                return '<div class="signal-hotfile-item"><span class="signal-hotfile-name">' + esc(f.filename) + '</span><span class="signal-hotfile-meta">' + meta + '</span></div>';
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
        if (summaryEl) summaryEl.textContent = total === 0 ? SIGNAL_STRINGS.envSummaryEmpty : fillSignalString(SIGNAL_STRINGS.envSummary, total);
        if (!listEl) return;
        var parts = [envGroupHtml(SIGNAL_STRINGS.envPlatforms, platforms), envGroupHtml(SIGNAL_STRINGS.envSdkRuntime, sdks), envGroupHtml(SIGNAL_STRINGS.envDebugAdapters, adapters)].filter(Boolean);
        listEl.innerHTML = parts.length === 0 ? '<p class="signal-hotfiles-empty">' + SIGNAL_STRINGS.envEmpty + '</p>' : parts.join('');
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
        return ' <span class="re-action signal-lint-link" role="button" title="' + fillSignalString(SIGNAL_STRINGS.openRuleTitle, esc(rule)) + '" data-rule="' + esc(rule) + '" data-source="saropa_lints">\\uD83D\\uDCCB ' + esc(SIGNAL_STRINGS.ruleLabel) + '</span>';
    }

    /** Build triage buttons for error-kind signals (Close/Mute/Re-open). */
    function buildTriageHtml(s) {
        if (s.kind !== 'error' && s.kind !== 'warning') return '';
        var status = (signalDataCache.statuses || {})[s.fingerprint] || 'open';
        if (status === 'open') return ' <span class="re-action" data-hash="' + esc(s.fingerprint) + '" data-status="closed">' + esc(SIGNAL_STRINGS.triageClose) + '</span><span class="re-action" data-hash="' + esc(s.fingerprint) + '" data-status="muted">' + esc(SIGNAL_STRINGS.triageMute) + '</span>';
        return ' <span class="re-action" data-hash="' + esc(s.fingerprint) + '" data-status="open">' + esc(SIGNAL_STRINGS.triageReopen) + '</span>';
    }

    /** Render the unified signal list across sessions — the single cross-session signal view. */
    function renderSignalTrends() {
        var listEl = document.getElementById('signal-trends-list'), emptyEl = document.getElementById('signal-trends-empty'), summaryEl = document.getElementById('signal-trends-summary');
        /* Filter out muted error/warning signals — same triage filtering the old recurring list had */
        var allSignals = (signalDataCache.allSignals || []).filter(function(s) {
            if (s.kind !== 'error' && s.kind !== 'warning') return true;
            return (signalDataCache.statuses || {})[s.fingerprint] !== 'muted';
        }).slice(0, 30);
        if (summaryEl) summaryEl.textContent = allSignals.length === 0 ? SIGNAL_STRINGS.allSummaryEmpty : fillSignalString(SIGNAL_STRINGS.allSummary, allSignals.length);
        if (allSignals.length === 0) { if (listEl) listEl.innerHTML = ''; if (emptyEl) emptyEl.style.display = ''; return; }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = allSignals.map(function(s) {
            var icon = kindLabels[s.kind] || '\u2139\uFE0F';
            var text = s.label.length > 60 ? s.label.slice(0, 57) + '...' : s.label;
            var meta = fillSignalString(SIGNAL_STRINGS.sessionMeta, s.sessionCount, s.totalOccurrences);
            if (s.avgDurationMs) { meta += fillSignalString(SIGNAL_STRINGS.metaAvg, fmtMs(s.avgDurationMs)); }
            if (s.maxDurationMs) { meta += fillSignalString(SIGNAL_STRINGS.metaMax, fmtMs(s.maxDurationMs)); }
            if (s.category) { meta += ' [' + esc(s.category) + ']'; }
            /* Reliability tag (idea #11): how many of all sessions this signal appears in. Makes
               intermittent "ghost" signals visible — the hardest bugs hide in the middle band. */
            if (s.reliability && typeof s.sessionPercentage === 'number') {
                var relTpl = s.reliability === 'consistent' ? SIGNAL_STRINGS.reliabilityConsistent
                    : s.reliability === 'intermittent' ? SIGNAL_STRINGS.reliabilityIntermittent
                    : SIGNAL_STRINGS.reliabilityRare;
                meta += ' · ' + esc(fillSignalString(relTpl, s.sessionPercentage));
            }
            var lintBtn = buildLintRuleLink(s.detail || '');
            var daBtn = s.kind === 'sql' ? ' <span class="re-action signal-da-link" role="button" title="' + esc(SIGNAL_STRINGS.openDriftAdvisorTitle) + '">\\uD83D\\uDD0D DA</span>' : '';
            var sevCls = s.severity === 'critical' ? ' signal-sev-critical' : s.severity === 'high' ? ' signal-sev-high' : '';
            var recurBadge = s.recurring ? ' <span class="signal-recurring-badge" title="' + esc(fillSignalString(SIGNAL_STRINGS.recurringTitle, s.sessionCount)) + '">\u21BB</span>' : '';
            var trendBadge = '';
            if (s.trend === 'increasing') { trendBadge = ' <span class="signal-trend-up" title="' + esc(SIGNAL_STRINGS.trendIncreasing) + '">\u2191</span>'; }
            else if (s.trend === 'decreasing') { trendBadge = ' <span class="signal-trend-down" title="' + esc(SIGNAL_STRINGS.trendDecreasing) + '">\u2193</span>'; }
            else if (s.trend === 'stable') { trendBadge = ' <span class="signal-trend-stable" title="' + esc(SIGNAL_STRINGS.trendStable) + '">\u2014</span>'; }
            var triageHtml = buildTriageHtml(s);
            /* Per-row copy: emits a paste-ready detail block (metadata + example + supporting
               log lines) so the user can drop one signal into an analysis engine without
               copying the whole panel. Handler lives in part D, keyed by fingerprint/label. */
            var copyBtn = ' <span class="re-action signal-copy-btn" role="button" title="' + esc(SIGNAL_STRINGS.copySignalTitle) + '" data-fingerprint="' + esc(s.fingerprint) + '" data-label="' + esc(s.label) + '">\\uD83D\\uDCCB ' + esc(SIGNAL_STRINGS.copyLabel) + '</span>';
            var dimCls = (signalDataCache.statuses || {})[s.fingerprint] === 'closed' ? ' re-closed' : '';
            /* data-fingerprint + data-label + data-detail travel to the click handler so the host
               can resolve to the specific session containing this fingerprint and the webview can
               scroll to the matching line. detail is the raw example text (substring-searchable);
               label is the normalized form (token placeholders like <N>/<TS>, not directly matchable).
               Without these, the host can only resolve by kind ("any session with any error"), which
               often lands on the already-open log and looks like a dead click. */
            return '<div class="signal-env-row signal-trend-row' + sevCls + dimCls
                + '" data-signal-type="' + esc(s.kind)
                + '" data-fingerprint="' + esc(s.fingerprint)
                + '" data-label="' + esc(s.label)
                + '" data-detail="' + esc(s.detail || '')
                + '" title="' + esc(s.label) + '">'
                + '<span>' + icon + recurBadge + trendBadge + ' ' + esc(text) + '</span>'
                + '<span class="signal-hotfile-meta">' + meta + '</span>'
                + '<span class="signal-row-actions">' + lintBtn + daBtn + copyBtn + triageHtml + '</span></div>';
        }).join('');
    }

    /** Fu7: latest non-zero timestamp in the current allLines buffer, used as the session reference.
     *  Walks from the end so it's typically a few iterations, not full O(n). Returns 0 if no timestamps. */
    function sessionLatestTs() {
        if (typeof allLines === 'undefined' || !allLines || !allLines.length) return 0;
        for (var k = allLines.length - 1; k >= 0; k--) {
            var li = allLines[k];
            var t = li && li.timestamp;
            if (typeof t === 'number' && t > 0) return t;
        }
        return 0;
    }

    /** Fu7: representative timestamp for a signal — its first lineIndex's timestamp, or 0 if unknown. */
    function signalRepTs(s) {
        if (typeof allLines === 'undefined' || !s.lineIndices || s.lineIndices.length === 0) return 0;
        var li = allLines[s.lineIndices[0]];
        var t = li && li.timestamp;
        return (typeof t === 'number' && t > 0) ? t : 0;
    }

    /** Fu3 evidence preview: render up to 3 supporting lines for a signal as a sub-block.
     *  Each line is stripped of HTML and truncated at 90 chars to keep the panel column compact.
     *  Empty when no lineIndices or when allLines lookups fail. */
    function buildEvidencePreviewHtml(s) {
        if (typeof allLines === 'undefined' || !s.lineIndices || s.lineIndices.length === 0) return '';
        var snippets = [];
        var seen = {};
        for (var e = 0; e < s.lineIndices.length && snippets.length < 3; e++) {
            var idx = s.lineIndices[e];
            if (seen[idx]) continue;
            seen[idx] = 1;
            var li = allLines[idx];
            if (!li || !li.html) continue;
            /* Reuse stripTags from the shared webview scope (defined in collect-general). */
            var plain = (typeof stripTags === 'function' ? stripTags(li.html) : li.html).replace(/\\s+/g, ' ').trim();
            if (!plain) continue;
            var compact = plain.length > 90 ? plain.slice(0, 87) + '\\u2026' : plain;
            snippets.push('<div class="signal-evidence-line" title="' + fillSignalString(SIGNAL_STRINGS.evidenceLineTitle, idx + 1, esc(plain)) + '">' + esc(compact) + '</div>');
        }
        if (snippets.length === 0) return '';
        return '<div class="signal-evidence-preview" aria-label="' + esc(SIGNAL_STRINGS.supportingLogLines) + '">' + snippets.join('') + '</div>';
    }

    /** Render signals detected in the current log session (all kinds). Also manages the "This log" empty state. */
    function renderSignalsInThisLog() {
        var listEl = document.getElementById('signals-in-log-list'), summaryEl = document.getElementById('signals-in-log-summary');
        var emptyBlock = document.getElementById('signal-this-log-empty');
        var signalsAll = signalDataCache.signalsInThisLog || [];
        /* Fu7: time-window filter. Signals lacking a timestamp are hidden under any active window
           (you can't time-locate them, so they aren't in "the last X"). No-op when window is null. */
        var signals;
        if (signalsInLogWindowMs == null) {
            signals = signalsAll;
        } else {
            var refTs = sessionLatestTs();
            if (refTs === 0) {
                signals = signalsAll;
            } else {
                var cutoff = refTs - signalsInLogWindowMs;
                signals = signalsAll.filter(function(s) {
                    var st = signalRepTs(s);
                    return st > 0 && st >= cutoff;
                });
            }
        }
        /* Fu5: chronological sort is opt-in. 'severity' keeps the producer's order (already
           severity-ranked) so the default is unchanged; 'time' sorts a copy ascending by the
           signal's representative timestamp (signals with no timestamp sink to the end). */
        if (signalsInLogSortMode === 'time') {
            signals = signals.slice().sort(function(a, b) {
                var ta = signalRepTs(a), tb = signalRepTs(b);
                if (ta <= 0) { return tb <= 0 ? 0 : 1; }
                if (tb <= 0) { return -1; }
                return ta - tb;
            });
        }
        var hasWindow = (signalsInLogWindowMs != null && signals.length !== signalsAll.length);
        if (summaryEl) summaryEl.textContent = signalsAll.length === 0
            ? SIGNAL_STRINGS.inLogSummaryEmpty
            : (hasWindow
                ? fillSignalString(SIGNAL_STRINGS.inLogSummaryWindow, signals.length, signalsAll.length)
                : fillSignalString(SIGNAL_STRINGS.inLogSummary, signals.length));
        if (emptyBlock) emptyBlock.style.display = signalsAll.length === 0 ? '' : 'none';
        if (!listEl) { return; }
        if (signals.length === 0) { listEl.innerHTML = ''; return; }
        listEl.innerHTML = signals.slice(0, 20).map(function(s) {
            var icon = kindLabels[s.kind] || '\u2139\uFE0F', text = s.label.length > 50 ? s.label.slice(0, 47) + '...' : s.label;
            var meta = s.totalOccurrences + 'x' + (s.avgDurationMs ? ', avg ' + fmtMs(s.avgDurationMs) : '');
            var lineAttr = s.lineIndices && s.lineIndices.length > 0 ? ' data-line="' + s.lineIndices[0] + '"' : '';
            /* A row is jumpable when it points at a log line. Otherwise, if it carries a detail
               (e.g. the "Drift Advisor issues" classified signal, which summarizes DA diagnostics
               and has no single source line), it becomes a detail-toggle row so the user can still
               click to read the detail inline. Rows with neither stay inert. */
            var jumpable = !!lineAttr;
            var hasDetail = !!(s.detail && String(s.detail).trim());
            var clickCls = jumpable ? ' signal-jumpable' : (hasDetail ? ' signal-detail-toggle' : '');
            var titleSuffix = jumpable ? ' — click to jump' : (hasDetail ? ' — click to see detail' : '');
            var preview = buildEvidencePreviewHtml(s);
            /* fingerprint + label travel on the row so the part-D copy handler can re-find this
               exact signal object (which carries lineIndices) to build the detail block. */
            var copyBtn = ' <span class="re-action signal-copy-btn" role="button" title="' + esc(SIGNAL_STRINGS.copySignalTitle) + '" data-fingerprint="' + esc(s.fingerprint || '') + '" data-label="' + esc(s.label) + '">\\uD83D\\uDCCB ' + esc(SIGNAL_STRINGS.copyLabel) + '</span>';
            /* Inline detail body, hidden until the row is clicked. Only emitted for non-jumpable
               rows that have a detail — jumpable rows reveal context by scrolling to the line. */
            var detailBlock = (!jumpable && hasDetail)
                ? '<div class="signal-detail-body" hidden>' + esc(String(s.detail).trim()) + '</div>'
                : '';
            return '<div class="signal-env-row signal-in-log-row' + clickCls + '"' + lineAttr + ' data-fingerprint="' + esc(s.fingerprint || '') + '" data-label="' + esc(s.label) + '" title="' + esc(s.label) + titleSuffix + '">'
                + '<span>' + icon + ' ' + esc(text) + '</span>'
                + '<span class="signal-hotfile-meta">' + meta + '</span>'
                + '<span class="signal-row-actions">' + copyBtn + '</span>'
                + preview
                + detailBlock
                + '</div>';
        }).join('');
    }
`;
}
