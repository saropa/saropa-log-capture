/**
 * Insight panel script part C: performance hero, list click handlers, message handler.
 * Concatenated by viewer-insight-panel-script.ts to stay under max-lines.
 */

/** Returns the third fragment of the Insight panel IIFE (hero, delegates, messages). */
export function getInsightScriptPartC(): string {
    return /* js */ `
    function renderPerformanceHero() {
        var heroEl = document.getElementById('insight-performance-hero');
        if (!heroEl) return;
        if (!hasLog) { heroEl.style.display = 'none'; heroEl.innerHTML = ''; return; }
        if (heroLoading) {
            heroEl.innerHTML = '<span class="insight-hero-metrics">' + esc(INSIGHT_STRINGS.heroLoading) + '</span>';
            heroEl.style.display = '';
            return;
        }
        var parts = [];
        if (typeof heroErrorCount === 'number') parts.push('\\uD83D\\uDD34 Errors: ' + heroErrorCount);
        if (typeof heroWarningCount === 'number') parts.push('\\uD83D\\uDFE1 Warnings: ' + heroWarningCount);
        if (parts.length === 0 && hasLog && typeof heroErrorCount !== 'number' && typeof heroWarningCount !== 'number') parts.push(esc(INSIGHT_STRINGS.heroNoErrorsWarnings || 'No errors or warnings recorded'));
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
            var sparkTitle = esc(INSIGHT_STRINGS.heroSparklineTitle);
            var trendLabel = esc(INSIGHT_STRINGS.sessionTrendLabel || 'Session trend');
            sparklineHtml = '<span class="insight-hero-sparkline-wrap"><span class="insight-hero-sparkline-label">' + trendLabel + '</span><svg class="insight-hero-sparkline" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><title>' + sparkTitle + '</title><path fill="none" stroke="currentColor" stroke-width="1.5" d="M' + pts.join(' L') + '"/></svg></span>';
        }
        var hintHtml = '';
        if (!hasSparkline && parts.length === 0) hintHtml = '<span class="insight-hero-hint">' + esc(INSIGHT_STRINGS.heroNoSamplingHint) + '</span>';
        if (parts.length === 0 && !sparklineHtml && !hintHtml) { heroEl.style.display = 'none'; heroEl.innerHTML = ''; heroEl.parentElement && heroEl.parentElement.classList.remove('insight-hero-has-errors', 'insight-hero-has-warnings'); return; }
        heroEl.innerHTML = sparklineHtml + (parts.length > 0 ? '<span class="insight-hero-metrics">' + parts.join(' \\u00b7 ') + '</span>' : '') + hintHtml;
        heroEl.style.display = '';
        var heroBlock = document.getElementById('insight-hero-block');
        if (heroBlock) {
            heroBlock.classList.toggle('insight-hero-has-errors', typeof heroErrorCount === 'number' && heroErrorCount > 0);
            heroBlock.classList.toggle('insight-hero-has-warnings', typeof heroWarningCount === 'number' && heroWarningCount > 0);
        }
    }
    var recurringListEl = document.getElementById('insight-recurring-list');
    if (recurringListEl) recurringListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); return; }
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });
    var hotfilesListEl = document.getElementById('insight-hotfiles-list');
    if (hotfilesListEl) hotfilesListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.preventDefault(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'hotfile', filename: addBtn.dataset.filename || '' } }); }
    });
    var recurringInLogListEl = document.getElementById('insight-recurring-in-log-list');
    if (recurringInLogListEl) recurringInLogListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); return; }
        var act = e.target.closest('.re-action');
        if (!act) return;
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: act.dataset.hash, status: act.dataset.status });
    });
    var errorsInLogListEl = document.getElementById('insight-errors-in-log-list');
    if (errorsInLogListEl) errorsInLogListEl.addEventListener('click', function(e) {
        var addBtn = e.target.closest('.re-add-to-case');
        if (addBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'addInsightItemToCase', payload: { type: 'recurring', normalizedText: addBtn.dataset.normalized || '', exampleLine: addBtn.dataset.example || '' } }); }
    });

    var exportSummaryEl = document.getElementById('insight-export-summary');
    if (exportSummaryEl) exportSummaryEl.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'exportInsightsSummary' });
    });

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'openInsight') {
            openInsightPanel();
            if (e.data.tab) setInsightTab(e.data.tab);
            return;
        }
        if (e.data.type === 'currentLogChanged') {
            if (hasLog) { heroLoading = true; renderPerformanceHero(); }
            vscodeApi.postMessage({ type: 'requestPerformanceData' });
            vscodeApi.postMessage({ type: 'requestInsightData' });
            return;
        }
        if (e.data.type === 'insightRefreshRecurring') {
            var loadEl = document.getElementById('insight-recurring-loading');
            var listEl = document.getElementById('insight-recurring-list');
            var emptyEl = document.getElementById('insight-recurring-empty');
            if (loadEl) loadEl.style.display = '';
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'none';
            vscodeApi.postMessage({ type: 'requestInsightData' });
            return;
        }
        if (e.data.type === 'investigationsList') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            investigationsData = { investigations: e.data.investigations || [], activeId: e.data.activeId || '' };
            renderCasesList();
        }
        if (e.data.type === 'addToCaseCompleted') {
            expandCasesAndScrollToNew();
        }
        if (e.data.type === 'createInvestigationSucceeded') {
            expandCasesAndScrollToNew();
            var listEl = document.getElementById('insight-cases-list');
            var lastItem = listEl && listEl.lastElementChild;
            if (lastItem) lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (e.data.type === 'createInvestigationError') {
            setCreateInvestigationLoading(false);
            var casesLoad = document.getElementById('insight-cases-loading');
            if (casesLoad) casesLoad.style.display = 'none';
            var errEl = document.getElementById('insight-cases-create-error');
            if (errEl) { errEl.textContent = e.data.message || 'Failed to create'; errEl.style.display = ''; }
        }
        if (e.data.type === 'insightData') {
            insightDataCache = {
                errors: e.data.errors || [], statuses: e.data.statuses || {}, hotFiles: e.data.hotFiles || [],
                recurringInThisLog: e.data.recurringInThisLog || [], errorsInThisLog: e.data.errorsInThisLog || [],
                errorsInThisLogTotal: e.data.errorsInThisLogTotal,
                platforms: e.data.platforms || [], sdkVersions: e.data.sdkVersions || [], debugAdapters: e.data.debugAdapters || [],
                regressionHints: e.data.regressionHints || {}
            };
            var loadEl = document.getElementById('insight-recurring-loading');
            if (loadEl) loadEl.style.display = 'none';
            renderRecurringList();
            renderHotFiles();
            renderRecurringInLog();
            renderErrorsInLog();
            renderThisLogEmptyState();
            renderEnvironment();
        }
        if (e.data.type === 'recurringErrorsData') {
            insightDataCache.errors = e.data.errors || [];
            insightDataCache.statuses = e.data.statuses || {};
            var loadEl = document.getElementById('insight-recurring-loading');
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
            var scopeEl = document.getElementById('insight-performance-scope');
            var labelEl = document.getElementById('insight-current-log-label');
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
