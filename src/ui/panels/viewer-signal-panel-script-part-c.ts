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
        var signalsInLog = signalDataCache.signalsInThisLog || [];
        if (hasLog && signalsInLog.length > 0) {
            lines.push('## Signals in this log');
            lines.push('');
            for (var i = 0; i < signalsInLog.length; i++) {
                var sig = signalsInLog[i];
                var sigText = (sig.label || sig.detail || '').trim();
                if (sigText) lines.push('- [' + sig.kind + '] ' + sigText + ' (' + sig.totalOccurrences + 'x)');
            }
            lines.push('');
        }
        var allSigs = (signalDataCache.allSignals || []).filter(function(s) { return s.kind !== 'error' && s.kind !== 'warning' || (signalDataCache.statuses || {})[s.fingerprint] !== 'muted'; });
        var hotFiles = signalDataCache.hotFiles || [];
        if (allSigs.length > 0 || hotFiles.length > 0) {
            lines.push('## Across your logs');
            lines.push('');
            if (allSigs.length > 0) {
                lines.push('### All signals');
                for (var r = 0; r < allSigs.length; r++) {
                    var sig = allSigs[r];
                    lines.push('- [' + sig.kind + '] ' + (sig.label || '').trim() + ' (' + sig.sessionCount + ' sessions, ' + sig.totalOccurrences + ' total)');
                }
                lines.push('');
            }
            if (hotFiles.length > 0) {
                lines.push('### Frequently modified files');
                for (var h = 0; h < hotFiles.length; h++) {
                    var fn = (hotFiles[h].filename || hotFiles[h].path || '').trim();
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
        if (e.data.type === 'signalData') {
            var d = e.data;
            signalDataCache = {
                statuses: d.statuses || {}, hotFiles: d.hotFiles || [],
                platforms: d.platforms || [], sdkVersions: d.sdkVersions || [],
                debugAdapters: d.debugAdapters || [],
                allSignals: d.allSignals || [], signalsInThisLog: d.signalsInThisLog || [],
                coOccurrences: d.coOccurrences || []
            };
            renderHotFiles(); renderSignalsInThisLog();
            renderEnvironment(); renderSignalTrends(); renderCoOccurrences();
            /* Update icon bar badge with total signal count (this log + all signals). */
            var sigTotal = (signalDataCache.signalsInThisLog || []).length + (signalDataCache.allSignals || []).length;
            if (typeof updateIconBadge === 'function') updateIconBadge('ib-signal-badge', 'ib-signal-count', sigTotal);
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
