/**
 * Signal panel script part B: utils, cases list/form, recurring, hot files, errors in log, environment.
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

    function setCreateInvestigationLoading(loading) {
        createInvestigationInProgress = loading;
        var input = document.getElementById('signal-cases-name-input');
        var confirmBtn = document.getElementById('signal-cases-create-confirm');
        if (input) input.disabled = loading;
        if (confirmBtn) { confirmBtn.disabled = loading; confirmBtn.textContent = loading ? 'Creating…' : 'Create'; }
    }
    function showCreateInvestigationForm(show) {
        var row = document.getElementById('signal-cases-create-row');
        var form = document.getElementById('signal-cases-create-form');
        var input = document.getElementById('signal-cases-name-input');
        var errEl = document.getElementById('signal-cases-create-error');
        if (row) row.style.display = show ? 'none' : '';
        if (form) form.style.display = show ? 'flex' : 'none';
        if (input) { input.value = ''; input.disabled = createInvestigationInProgress; if (show) input.focus(); }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        var confirmBtn = document.getElementById('signal-cases-create-confirm');
        if (confirmBtn) { confirmBtn.disabled = createInvestigationInProgress; confirmBtn.textContent = createInvestigationInProgress ? 'Creating…' : 'Create'; }
    }
    function renderCasesList() {
        var listEl = document.getElementById('signal-cases-list');
        var emptyEl = document.getElementById('signal-cases-empty');
        var viewAllRow = document.getElementById('signal-cases-view-all');
        var viewAllLink = document.getElementById('signal-cases-view-all-link');
        var createBtn = document.getElementById('signal-cases-create');
        if (!listEl) return;
        var invs = (investigationsData.investigations || []);
        var activeId = investigationsData.activeId || '';
        var showCount = Math.min(3, invs.length);
        var toShow = invs.slice(0, showCount);
        if (emptyEl) emptyEl.style.display = invs.length === 0 ? '' : 'none';
        if (toShow.length === 0) listEl.innerHTML = '';
        else listEl.innerHTML = toShow.map(function(inv) { return buildCaseItemHtml(inv, activeId); }).join('');
        if (viewAllRow) viewAllRow.style.display = invs.length > 3 ? '' : 'none';
        if (viewAllLink) viewAllLink.textContent = 'View All (' + invs.length + ')';
        if (createBtn) createBtn.onclick = function() { showCreateInvestigationForm(true); };
        listEl.querySelectorAll('.session-investigation-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var id = el.getAttribute('data-investigation-id');
                if (id) vscodeApi.postMessage({ type: 'openInvestigationById', id: id });
            });
        });
        showCreateInvestigationForm(false);
    }
    function bindCreateInvestigationForm() {
        var form = document.getElementById('signal-cases-create-form');
        var input = document.getElementById('signal-cases-name-input');
        var confirmBtn = document.getElementById('signal-cases-create-confirm');
        var cancelBtn = document.getElementById('signal-cases-create-cancel');
        var errEl = document.getElementById('signal-cases-create-error');
        if (!form || !input || !confirmBtn || !cancelBtn || !errEl) return;
        function hideError() { errEl.style.display = 'none'; errEl.textContent = ''; }
        function showError(msg) { errEl.textContent = msg; errEl.style.display = ''; }
        function submit() {
            if (createInvestigationInProgress) return;
            var name = (input.value || '').trim();
            if (!name) { showError('Name is required'); return; }
            if (name.length > 100) { showError('Name must be 100 characters or less'); return; }
            hideError();
            setCreateInvestigationLoading(true);
            vscodeApi.postMessage({ type: 'createInvestigationWithName', name: name });
        }
        confirmBtn.addEventListener('click', submit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.preventDefault(); showCreateInvestigationForm(false); }
        });
        cancelBtn.addEventListener('click', function() { showCreateInvestigationForm(false); });
    }
    function buildCaseItemHtml(inv, activeId) {
        var active = inv.id === (activeId || '') ? ' session-investigation-active' : '';
        var srcStr = (inv.sourceCount != null) ? (SIGNAL_STRINGS.sourcesCount || '{0} source(s)').replace('{0}', String(inv.sourceCount)) : '';
        var upStr = (inv.updatedAt != null) ? (SIGNAL_STRINGS.updatedAgo || 'Updated {0}').replace('{0}', formatUpdatedAgo(inv.updatedAt)) : '';
        var meta = [srcStr, upStr].filter(Boolean).join(' \\u00b7 ');
        var label = inv.name + (meta ? ' \\u00b7 ' + meta : '');
        var activeMark = inv.id === (activeId || '') ? ' <span class="session-investigation-check">&#10003;</span>' : '';
        return '<div class="session-investigation-item' + active + '" data-investigation-id="' + escapeAttr(inv.id) + '">' + esc(label) + activeMark + '</div>';
    }
    var viewAllLinkEl = document.getElementById('signal-cases-view-all-link');
    if (viewAllLinkEl) viewAllLinkEl.addEventListener('click', function() {
        setSectionExpanded('cases', true);
        renderSectionAccordion('cases');
        var listEl = document.getElementById('signal-cases-list');
        if (listEl) {
            var invs = (investigationsData.investigations || []);
            var activeId = investigationsData.activeId || '';
            listEl.innerHTML = invs.map(function(inv) { return buildCaseItemHtml(inv, activeId); }).join('');
            listEl.querySelectorAll('.session-investigation-item').forEach(function(el) {
                el.addEventListener('click', function() {
                    var id = el.getAttribute('data-investigation-id');
                    if (id) vscodeApi.postMessage({ type: 'openInvestigationById', id: id });
                });
            });
        }
        var vw = document.getElementById('signal-cases-view-all');
        if (vw) vw.style.display = 'none';
    });
    bindCreateInvestigationForm();

    function regressionHintHtml(hint) {
        if (!hint || !hint.hash) return '';
        var link = hint.commitUrl
            ? '<a class="re-commit-link" href="' + escapeAttr(hint.commitUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(hint.hash) + '</a>'
            : '<code>' + esc(hint.hash) + '</code>';
        return '<div class="re-regression">Introduced in commit ' + link + '</div>';
    }
    function renderRecurringList() {
        var listEl = document.getElementById('signal-recurring-list');
        var emptyEl = document.getElementById('signal-recurring-empty');
        var visible = (signalDataCache.errors || []).filter(function(e) { return (signalDataCache.statuses || {})[e.fingerprint] !== 'muted'; });
        var toShow = visible.slice(0, 5);
        if (toShow.length === 0) {
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = toShow.map(function(e) {
            var status = (signalDataCache.statuses || {})[e.fingerprint] || 'open';
            var dimCls = status === 'closed' ? ' re-closed' : '';
            var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
            var total = e.totalOccurrences + ' total';
            var actions = status === 'open'
                ? '<span class="re-action" data-hash="' + esc(e.fingerprint) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.fingerprint) + '" data-status="muted">Mute</span>'
                : '<span class="re-action" data-hash="' + esc(e.fingerprint) + '" data-status="open">Re-open</span>';
            var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
            var fullText = e.label || '';
            var displayText = truncateForDisplay(fullText);
            var titleAttr = esc((e.detail || fullText).trim() || '');
            var addBtn = '<span class="re-action re-add-to-case" role="button" title="' + esc(SIGNAL_STRINGS.addToCase) + '" aria-label="' + esc(SIGNAL_STRINGS.addToCase) + '" data-hash="' + esc(e.fingerprint) + '" data-normalized="' + esc(e.label || '') + '" data-example="' + esc(e.detail || '') + '">+</span>';
            var intro = regressionHintHtml((signalDataCache.regressionHints || {})[e.fingerprint]);
            return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + titleAttr + '">' + cat + esc(displayText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div>' + intro + '<div class="re-actions">' + addBtn + ' ' + actions + '</div></div>';
        }).join('');
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
                return '<div class="signal-hotfile-item"><span class="re-action re-add-to-case signal-hotfile-add" role="button" title="' + esc(SIGNAL_STRINGS.addToCase) + '" aria-label="' + esc(SIGNAL_STRINGS.addToCase) + '" data-filename="' + esc(f.filename || '') + '">+</span><span class="signal-hotfile-name">' + esc(f.filename) + '</span><span class="signal-hotfile-meta">' + (f.sessionCount || 0) + ' session' + (f.sessionCount === 1 ? '' : 's') + '</span></div>';
            }).join('');
        }
    }
    function renderRecurringInLog() {
        var summaryEl = document.getElementById('signal-recurring-in-log-summary');
        var listEl = document.getElementById('signal-recurring-in-log-list');
        var inLog = (signalDataCache.recurringInThisLog || []).filter(function(e) { return (signalDataCache.statuses || {})[e.fingerprint] !== 'muted'; });
        if (summaryEl) summaryEl.textContent = inLog.length === 0 ? 'Recurring in this log' : (inLog.length + ' of your recurring error' + (inLog.length === 1 ? '' : 's') + ' appear in this log');
        if (listEl) {
            if (inLog.length === 0) listEl.innerHTML = '<p class="signal-hotfiles-empty">None of your recurring errors appear in this log.</p>';
            else listEl.innerHTML = inLog.map(function(e) {
                var status = (signalDataCache.statuses || {})[e.fingerprint] || 'open';
                var dimCls = status === 'closed' ? ' re-closed' : '';
                var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
                var total = e.totalOccurrences + ' total';
                var actions = status === 'open' ? '<span class="re-action" data-hash="' + esc(e.fingerprint) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.fingerprint) + '" data-status="muted">Mute</span>' : '<span class="re-action" data-hash="' + esc(e.fingerprint) + '" data-status="open">Re-open</span>';
                var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
                var fullText = e.label || '';
                var displayText = truncateForDisplay(fullText);
                var titleAttr = esc((e.detail || fullText).trim() || '');
                var addBtn = '<span class="re-action re-add-to-case" role="button" title="' + esc(SIGNAL_STRINGS.addToCase) + '" aria-label="' + esc(SIGNAL_STRINGS.addToCase) + '" data-hash="' + esc(e.fingerprint) + '" data-normalized="' + esc(e.label || '') + '" data-example="' + esc(e.detail || '') + '">+</span>';
                var intro = regressionHintHtml((signalDataCache.regressionHints || {})[e.fingerprint]);
                return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + titleAttr + '">' + cat + esc(displayText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div>' + intro + '<div class="re-actions">' + addBtn + ' ' + actions + '</div></div>';
            }).join('');
        }
    }
    function renderErrorsInLog() {
        var subtitleEl = document.getElementById('signal-errors-in-log-subtitle'), listEl = document.getElementById('signal-errors-in-log-list'), emptyEl = document.getElementById('signal-errors-in-log-empty');
        var items = (signalDataCache.errorsInThisLog || []).slice(0, 3), total = signalDataCache.errorsInThisLogTotal;
        var showTopOfN = items.length === 3 && (total != null && total > 3);
        if (subtitleEl) subtitleEl.textContent = showTopOfN && SIGNAL_STRINGS.topOfTotal
            ? (SIGNAL_STRINGS.topOfTotal.replace('{0}', String(total))) : (SIGNAL_STRINGS.sectionErrorsInLog || 'Errors in this log');
        if (emptyEl) { emptyEl.style.display = items.length === 0 ? '' : 'none'; if (items.length === 0) emptyEl.innerHTML = '<span class="signal-margin-emoji" aria-hidden="true">\\u2139\\uFE0F</span>' + esc(SIGNAL_STRINGS.errorsInLogEmpty); }
        if (listEl) {
            if (items.length === 0) listEl.innerHTML = '';
            else listEl.innerHTML = items.map(function(it) {
                var text = (it.normalizedText || it.exampleLine || '').trim() || 'Error';
                var displayText = truncateForDisplay(text);
                var count = (it.count != null) ? it.count : 0;
                var addBtn = '<span class="re-action re-add-to-case signal-errors-in-log-add" role="button" title="' + esc(SIGNAL_STRINGS.addToCase) + '" aria-label="' + esc(SIGNAL_STRINGS.addToCase) + '" data-normalized="' + esc(it.normalizedText || '') + '" data-example="' + esc(it.exampleLine || '') + '">+</span>';
                return '<div class="re-card signal-errors-in-log-item"><div class="re-text" title="' + esc(it.exampleLine || text) + '">' + esc(displayText) + '</div><div class="re-meta">' + count + ' occurrence' + (count === 1 ? '' : 's') + '</div><div class="re-actions">' + addBtn + '</div></div>';
            }).join('');
        }
    }
    function renderThisLogEmptyState() {
        var emptyBlock = document.getElementById('signal-this-log-empty'), contentBlock = document.getElementById('signal-this-log-content');
        var errorsEmpty = (signalDataCache.errorsInThisLog || []).length === 0;
        var recurringEmpty = (signalDataCache.recurringInThisLog || []).filter(function(e) { return (signalDataCache.statuses || {})[e.fingerprint] !== 'muted'; }).length === 0;
        var bothEmpty = errorsEmpty && recurringEmpty;
        if (emptyBlock) emptyBlock.style.display = bothEmpty ? '' : 'none';
        if (contentBlock) contentBlock.style.display = bothEmpty ? 'none' : '';
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

    /** Render the unified signal list across sessions — errors, warnings, perf, SQL, etc. all in one. */
    function renderSignalTrends() {
        var listEl = document.getElementById('signal-trends-list');
        var emptyEl = document.getElementById('signal-trends-empty');
        var summaryEl = document.getElementById('signal-trends-summary');
        var allSignals = (signalDataCache.allSignals || []).slice(0, 20);
        if (summaryEl) {
            summaryEl.textContent = allSignals.length === 0 ? 'All signals' : 'All signals (' + allSignals.length + ')';
        }
        if (allSignals.length === 0) {
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = allSignals.map(function(s) {
            var icon = kindLabels[s.kind] || '\u2139\uFE0F';
            var text = s.label.length > 60 ? s.label.slice(0, 57) + '...' : s.label;
            var meta = s.sessionCount + ' session' + (s.sessionCount === 1 ? '' : 's') + ', ' + s.totalOccurrences + ' total';
            if (s.avgDurationMs) { meta += ', avg ' + fmtMs(s.avgDurationMs); }
            if (s.maxDurationMs) { meta += ', max ' + fmtMs(s.maxDurationMs); }
            if (s.category) { meta += ' [' + esc(s.category) + ']'; }
            /* Cross-extension link buttons: lint rule docs and Drift Advisor */
            var lintBtn = buildLintRuleLink(s.detail || '');
            var daBtn = s.kind === 'sql' ? ' <span class="re-action signal-da-link" role="button" title="Open Drift Advisor">\\uD83D\\uDD0D DA</span>' : '';
            /* Severity badge: critical/high get colored indicators, recurring signals get a ↻ marker */
            var sevCls = s.severity === 'critical' ? ' signal-sev-critical' : s.severity === 'high' ? ' signal-sev-high' : '';
            var recurBadge = s.recurring ? ' <span class="signal-recurring-badge" title="Recurring in ' + s.sessionCount + ' sessions">\u21BB</span>' : '';
            /* Trend arrow: ↑ increasing, ↓ decreasing, — stable (only shown when trend data available) */
            var trendBadge = '';
            if (s.trend === 'increasing') { trendBadge = ' <span class="signal-trend-up" title="Increasing — getting worse">\u2191</span>'; }
            else if (s.trend === 'decreasing') { trendBadge = ' <span class="signal-trend-down" title="Decreasing — improving">\u2193</span>'; }
            else if (s.trend === 'stable') { trendBadge = ' <span class="signal-trend-stable" title="Stable — consistent rate">\u2014</span>'; }
            /* Add-to-case button on each signal row — data attributes carry the payload */
            var addBtn = '<span class="re-action re-add-to-case-signal" data-kind="' + esc(s.kind) + '" data-label="' + esc(s.label) + '" data-detail="' + esc(s.detail || '') + '" data-fp="' + esc(s.fingerprint || '') + '" title="' + SIGNAL_STRINGS.addToCase + '">+</span>';
            return '<div class="signal-env-row signal-trend-row' + sevCls + '" data-signal-type="' + esc(s.kind) + '" title="' + esc(s.label) + '">'
                + '<span>' + icon + recurBadge + trendBadge + ' ' + esc(text) + '</span>'
                + '<span class="signal-hotfile-meta">' + meta + '</span>' + lintBtn + daBtn + addBtn + '</div>';
        }).join('');
    }

    /** Render signals detected in the current log session (all kinds). */
    function renderSignalsInThisLog() {
        var listEl = document.getElementById('signals-in-log-list'), summaryEl = document.getElementById('signals-in-log-summary');
        var signals = signalDataCache.signalsInThisLog || [];
        if (summaryEl) summaryEl.textContent = signals.length === 0 ? 'All signals in this log' : 'All signals in this log (' + signals.length + ')';
        if (!listEl) { return; }
        if (signals.length === 0) { listEl.innerHTML = ''; return; }
        listEl.innerHTML = signals.slice(0, 15).map(function(s) {
            var icon = kindLabels[s.kind] || '\u2139\uFE0F', text = s.label.length > 50 ? s.label.slice(0, 47) + '...' : s.label;
            var meta = s.totalOccurrences + 'x' + (s.avgDurationMs ? ', avg ' + fmtMs(s.avgDurationMs) : '');
            var lineAttr = s.lineIndices && s.lineIndices.length > 0 ? ' data-line="' + s.lineIndices[0] + '"' : '';
            var clickCls = lineAttr ? ' signal-jumpable' : '';
            return '<div class="signal-env-row signal-in-log-row' + clickCls + '"' + lineAttr + ' title="' + esc(s.label) + (lineAttr ? ' — click to jump' : '') + '"><span>' + icon + ' ' + esc(text) + '</span><span class="signal-hotfile-meta">' + meta + '</span></div>';
        }).join('');
    }
`;
}
