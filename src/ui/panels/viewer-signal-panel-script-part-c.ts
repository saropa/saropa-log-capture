/**
 * Signal panel script part C: performance hero, list click handlers, message handler.
 * Concatenated by viewer-signal-panel-script.ts to stay under max-lines.
 */

/** Returns the third fragment of the Signal panel IIFE (hero, delegates, messages). */
export function getSignalScriptPartC(): string {
    return /* js */ `
    function renderPerformanceHero() {
        var heroEl = document.getElementById('signal-performance-hero');
        if (!heroEl) return;
        if (!hasLog) { heroEl.style.display = 'none'; heroEl.innerHTML = ''; return; }
        if (heroLoading) {
            heroEl.innerHTML = '<span class="signal-hero-metrics">' + esc(SIGNAL_STRINGS.heroLoading) + '</span>';
            heroEl.style.display = '';
            return;
        }
        var parts = [];
        if (typeof heroErrorCount === 'number') parts.push('\\uD83D\\uDD34 Errors: ' + heroErrorCount);
        if (typeof heroWarningCount === 'number') parts.push('\\uD83D\\uDFE1 Warnings: ' + heroWarningCount);
        if (parts.length === 0 && hasLog && typeof heroErrorCount !== 'number' && typeof heroWarningCount !== 'number') parts.push(esc(SIGNAL_STRINGS.heroNoErrorsWarnings || 'No errors or warnings recorded'));
        if (heroSnapshotSummary) parts.push(heroSnapshotSummary);
        var hasSparkline = heroSparklineData && Array.isArray(heroSparklineData.freememMb) && heroSparklineData.freememMb.length >= 2;
        var sparklineHtml = '';
        if (hasSparkline) {
            var arr = heroSparklineData.freememMb;
            var min = Math.min.apply(null, arr);
            var max = Math.max.apply(null, arr);
            var range = max > min ? max - min : 1;
            var w = 120, h = 24;
            var pts = [];
            for (var i = 0; i < arr.length; i++) {
                var x = (i / (arr.length - 1)) * w;
                var norm = (arr[i] - min) / range;
                var y = h - norm * h;
                pts.push(x.toFixed(1) + ',' + y.toFixed(1));
            }
            var sparkTitle = esc(SIGNAL_STRINGS.heroSparklineTitle);
            var trendLabel = esc(SIGNAL_STRINGS.sessionTrendLabel || 'Session trend');
            sparklineHtml = '<span class="signal-hero-sparkline-wrap"><span class="signal-hero-sparkline-label">' + trendLabel + '</span><svg class="signal-hero-sparkline" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><title>' + sparkTitle + '</title><path fill="none" stroke="currentColor" stroke-width="1.5" d="M' + pts.join(' L') + '"/></svg></span>';
        }
        var hintHtml = '';
        if (!hasSparkline && parts.length === 0) hintHtml = '<span class="signal-hero-hint">' + esc(SIGNAL_STRINGS.heroNoSamplingHint) + '</span>';
        if (parts.length === 0 && !sparklineHtml && !hintHtml) { heroEl.style.display = 'none'; heroEl.innerHTML = ''; heroEl.parentElement && heroEl.parentElement.classList.remove('signal-hero-has-errors', 'signal-hero-has-warnings'); return; }
        heroEl.innerHTML = sparklineHtml + (parts.length > 0 ? '<span class="signal-hero-metrics">' + parts.join(' \\u00b7 ') + '</span>' : '') + hintHtml;
        heroEl.style.display = '';
        var heroBlock = document.getElementById('signal-hero-block');
        if (heroBlock) {
            heroBlock.classList.toggle('signal-hero-has-errors', typeof heroErrorCount === 'number' && heroErrorCount > 0);
            heroBlock.classList.toggle('signal-hero-has-warnings', typeof heroWarningCount === 'number' && heroWarningCount > 0);
        }
    }

    /** Build a single markdown string from current Signal state and Performance DOM (for copy-to-clipboard). */
    function buildSignalMarkdown() {
        var lines = [];
        lines.push('# Signals');
        lines.push('');
        lines.push('## Current log');
        lines.push(hasLog && currentLogLabel ? currentLogLabel : 'No log open');
        lines.push('');
        if (hasLog && (typeof heroErrorCount === 'number' || typeof heroWarningCount === 'number' || heroSnapshotSummary)) {
            var heroParts = [];
            if (typeof heroErrorCount === 'number') heroParts.push('Errors: ' + heroErrorCount);
            if (typeof heroWarningCount === 'number') heroParts.push('Warnings: ' + heroWarningCount);
            if (heroParts.length) lines.push(heroParts.join(' \\u00b7 '));
            if (heroSnapshotSummary) lines.push(heroSnapshotSummary);
            lines.push('');
        }
        var perfView = document.getElementById('signal-pp-current-view');
        if (perfView && perfView.children.length > 0) {
            lines.push('## Session details \\u2014 Performance');
            lines.push('');
            var groups = perfView.querySelectorAll('.pp-group');
            for (var g = 0; g < groups.length; g++) {
                var grp = groups[g];
                var header = grp.querySelector('.pp-group-header');
                var statsEl = grp.querySelector('.pp-group-stats');
                var title = (header && header.textContent) ? header.textContent.trim() : 'Performance';
                lines.push('### ' + title);
                if (statsEl && statsEl.textContent) lines.push(statsEl.textContent.trim());
                var rows = grp.querySelectorAll('.pp-event-row');
                for (var r = 0; r < rows.length; r++) {
                    var rowText = rows[r].textContent ? rows[r].textContent.trim() : '';
                    if (rowText) lines.push('- ' + rowText);
                }
                lines.push('');
            }
        }
        var errorsInLog = (signalDataCache.errorsInThisLog || []).filter(function(e) { return (signalDataCache.statuses || {})[e.fingerprint] !== 'muted'; });
        var recurringInLog = (signalDataCache.recurringInThisLog || []).filter(function(e) { return (signalDataCache.statuses || {})[e.fingerprint] !== 'muted'; });
        if (hasLog && (errorsInLog.length > 0 || recurringInLog.length > 0)) {
            lines.push('## This log');
            lines.push('');
            if (errorsInLog.length > 0) {
                lines.push('### Errors in this log');
                var totalErr = signalDataCache.errorsInThisLogTotal != null ? signalDataCache.errorsInThisLogTotal : errorsInLog.length;
                if (totalErr > errorsInLog.length) lines.push('Top ' + errorsInLog.length + ' of ' + totalErr + ':');
                for (var i = 0; i < errorsInLog.length; i++) {
                    var err = errorsInLog[i];
                    var text = (err.normalizedText || err.exampleLine || '').trim();
                    if (text) lines.push('- ' + text);
                }
                lines.push('');
            }
            if (recurringInLog.length > 0) {
                lines.push('### Recurring in this log');
                for (var j = 0; j < recurringInLog.length; j++) {
                    var rec = recurringInLog[j];
                    var recText = (rec.label || rec.detail || '').trim();
                    if (recText) lines.push('- ' + recText);
                }
                lines.push('');
            }
        }
        var invs = (investigationsData.investigations || []);
        if (invs.length > 0) {
            lines.push('## Your cases');
            lines.push('');
            for (var k = 0; k < invs.length; k++) lines.push('- ' + (invs[k].name || 'Unnamed'));
            lines.push('');
        }
        var recurring = (signalDataCache.errors || []).filter(function(e) { return (signalDataCache.statuses || {})[e.fingerprint] !== 'muted'; });
        var hotFiles = signalDataCache.hotFiles || [];
        if (recurring.length > 0 || hotFiles.length > 0) {
            lines.push('## Across your logs');
            lines.push('');
            if (recurring.length > 0) {
                lines.push('### Recurring errors');
                for (var r = 0; r < recurring.length; r++) {
                    var t = (recurring[r].label || recurring[r].detail || '').trim();
                    if (t) lines.push('- ' + t);
                }
                lines.push('');
            }
            if (hotFiles.length > 0) {
                lines.push('### Frequently modified files');
                for (var h = 0; h < hotFiles.length; h++) {
                    var f = hotFiles[h];
                    var fn = (f.filename || f.path || '').trim();
                    if (fn) lines.push('- ' + fn);
                }
                lines.push('');
            }
        }
        var platforms = signalDataCache.platforms || [];
        var sdks = signalDataCache.sdkVersions || [];
        var adapters = signalDataCache.debugAdapters || [];
        if (platforms.length > 0 || sdks.length > 0 || adapters.length > 0) {
            lines.push('## Environment');
            lines.push('');
            if (platforms.length > 0) lines.push('- **Platforms:** ' + platforms.join(', '));
            if (sdks.length > 0) lines.push('- **SDK versions:** ' + sdks.join(', '));
            if (adapters.length > 0) lines.push('- **Debug adapters:** ' + adapters.join(', '));
        }
        return lines.join('\\n');
    }

    /* Open in new tab: opens Signals as a main editor tab; extension handles via onOpenSignalTabRequest. */
    var openTabBtn = document.getElementById('signal-panel-open-tab');
    if (openTabBtn) openTabBtn.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'openSignalTab' });
    });

    /* Copy entire Signals summary to clipboard as markdown (header button). */
    var copyMdBtn = document.getElementById('signal-panel-copy-md');
    if (copyMdBtn) copyMdBtn.addEventListener('click', function() {
        var md = buildSignalMarkdown();
        if (md) vscodeApi.postMessage({ type: 'copyToClipboard', text: md });
    });

    var recurringListEl = document.getElementById('signal-recurring-list');
    if (recurringListEl) recurringListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addSignalItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); return; }
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });
    var hotfilesListEl = document.getElementById('signal-hotfiles-list');
    if (hotfilesListEl) hotfilesListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.preventDefault(); vscodeApi.postMessage({ type: 'addSignalItemToCase', payload: { type: 'hotfile', filename: addBtn.dataset.filename || '' } }); }
    });
    var recurringInLogListEl = document.getElementById('signal-recurring-in-log-list');
    if (recurringInLogListEl) recurringInLogListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addSignalItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); return; }
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });
    var errorsInLogListEl = document.getElementById('signal-errors-in-log-list');
    if (errorsInLogListEl) errorsInLogListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addSignalItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); }
    });

    var exportSummaryEl = document.getElementById('signal-export-summary');
    if (exportSummaryEl) exportSummaryEl.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'exportSignalsSummary' });
    });

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'openSignalPanel') {
            openSignalPanel();
            if (e.data.tab) setSignalTab(e.data.tab);
            return;
        }
        if (e.data.type === 'currentLogChanged') {
            if (hasLog) { heroLoading = true; renderPerformanceHero(); }
            vscodeApi.postMessage({ type: 'requestPerformanceData' });
            vscodeApi.postMessage({ type: 'requestSignalData' });
            return;
        }
        if (e.data.type === 'signalRefreshRecurring') {
            var loadEl = document.getElementById('signal-recurring-loading');
            var listEl = document.getElementById('signal-recurring-list');
            var emptyEl = document.getElementById('signal-recurring-empty');
            if (loadEl) loadEl.style.display = '';
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'none';
            vscodeApi.postMessage({ type: 'requestSignalData' });
            return;
        }
        if (e.data.type === 'investigationsList') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('signal-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            investigationsData = { investigations: e.data.investigations || [], activeId: e.data.activeId || '' };
            renderCasesList();
        }
        if (e.data.type === 'addToCaseCompleted') {
            expandCasesAndScrollToNew();
        }
        if (e.data.type === 'createInvestigationSucceeded') {
            expandCasesAndScrollToNew();
            var listEl = document.getElementById('signal-cases-list');
            var lastItem = listEl && listEl.lastElementChild;
            if (lastItem) lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (e.data.type === 'createInvestigationError') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('signal-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            var errEl = document.getElementById('signal-cases-create-error');
            if (errEl) { errEl.textContent = e.data.message || 'Failed to create'; errEl.style.display = ''; }
        }
        if (e.data.type === 'signalData') {
            var d = e.data;
            signalDataCache = {
                errors: d.errors || [], statuses: d.statuses || {}, hotFiles: d.hotFiles || [],
                recurringInThisLog: d.recurringInThisLog || [], errorsInThisLog: d.errorsInThisLog || [],
                errorsInThisLogTotal: d.errorsInThisLogTotal, platforms: d.platforms || [], sdkVersions: d.sdkVersions || [],
                debugAdapters: d.debugAdapters || [], regressionHints: d.regressionHints || {},
                allSignals: d.allSignals || [], signalsInThisLog: d.signalsInThisLog || []
            };
            var loadEl = document.getElementById('signal-recurring-loading');
            if (loadEl) loadEl.style.display = 'none';
            renderRecurringList(); renderHotFiles(); renderRecurringInLog();
            renderErrorsInLog(); renderThisLogEmptyState(); renderSignalsInThisLog();
            renderEnvironment(); renderSignalTrends();
        }
        if (e.data.type === 'recurringErrorsData') {
            signalDataCache.errors = e.data.errors || [];
            signalDataCache.statuses = e.data.statuses || {};
            var loadEl = document.getElementById('signal-recurring-loading');
            if (loadEl) loadEl.style.display = 'none';
            renderRecurringList();
            renderRecurringInLog();
            renderThisLogEmptyState();
        }
        if (e.data.type === 'performanceData') {
            heroLoading = false;
            hasLog = !!(e.data.sessionData);
            currentLogLabel = e.data.currentLogLabel || '';
            heroErrorCount = e.data.heroErrorCount;
            heroWarningCount = e.data.heroWarningCount;
            heroSnapshotSummary = (e.data.heroSnapshotSummary != null && e.data.heroSnapshotSummary !== '') ? String(e.data.heroSnapshotSummary) : '';
            heroSparklineData = e.data.heroSparklineData || undefined;
            var scopeEl = document.getElementById('signal-performance-scope');
            var labelEl = document.getElementById('signal-current-log-label');
            if (scopeEl && labelEl) {
                if (hasLog && currentLogLabel) { labelEl.textContent = currentLogLabel; scopeEl.style.display = ''; }
                else if (hasLog) { labelEl.textContent = 'No log open'; scopeEl.style.display = ''; }
                else { scopeEl.style.display = 'none'; }
            }
            renderPerformanceHero();
            applyStateAB();
        }
    });
`;
}
