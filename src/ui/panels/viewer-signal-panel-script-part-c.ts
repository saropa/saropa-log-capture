/**
 * Signal panel script part C: performance hero, list click handlers, message handler.
 * Concatenated by viewer-signal-panel-script.ts to stay under max-lines.
 */

/** Returns the third fragment of the Signal panel IIFE (hero, delegates, messages). */
export function getSignalScriptPartC(): string {
    return /* js */ `
    /* Live fallback for "Signals in this log". Error/warning fingerprints are written only on session
       finalize (session-lifecycle-finalize.ts), so a loaded or not-yet-finalized report has none and
       the host sends an empty signalsInThisLog. Rather than show nothing while the viewer plainly
       displays errors, synthesize signals from the already-classified error/warning lines in allLines,
       grouping identical text into one entry with an occurrence count and the line indices needed to
       jump and to build the evidence preview.

       Line selection mirrors the viewer's own severity badge (viewer-stats.ts recomputeStatsCounters:
       every non-marker item carrying a level) so an error rendered as a stack HEADER — not a plain
       'line' — is not silently dropped, which the earlier type==='line'-only filter did. Two kinds are
       still excluded so distinct issues aren't inflated: stack-FRAME continuations (one error's 20
       frames would otherwise become 20 signals) and recentErrorContext lines (proximity-inherited
       coloring, not real errors — the root-cause collector skips them for the same reason). */
    var LIVE_SIGNAL_GROUP_CAP = 500;
    function buildLiveSignalsFromLines() {
        if (typeof allLines === 'undefined' || !allLines || !allLines.length) { return []; }
        var groups = Object.create(null), order = [];
        for (var i = 0; i < allLines.length; i++) {
            var li = allLines[i];
            if (!li || li.type === 'marker' || li.type === 'stack-frame') { continue; }
            if (li.recentErrorContext) { continue; }
            if (li.level !== 'error' && li.level !== 'warning') { continue; }
            var raw = li.rawText != null ? li.rawText : (typeof stripTags === 'function' ? stripTags(li.html || '') : (li.html || ''));
            var text = (raw || '').replace(/\\s+/g, ' ').trim();
            if (!text) { continue; }
            /* NUL-join kind + text so an error and a warning with identical text stay distinct groups. */
            var key = li.level + '\\u0000' + text;
            var g = groups[key];
            /* Runaway guard: a pathological log of all-distinct errors must not grow an unbounded array.
               Existing groups keep accumulating occurrences; only NEW distinct groups stop past the cap. */
            if (!g) {
                if (order.length >= LIVE_SIGNAL_GROUP_CAP) { continue; }
                g = groups[key] = { kind: li.level, label: text, detail: text, fingerprint: 'live:' + key, totalOccurrences: 0, lineIndices: [] };
                order.push(key);
            }
            g.totalOccurrences++;
            g.lineIndices.push(i);
        }
        /* Errors before warnings so the most severe surface first, matching the producer's severity order. */
        var out = order.map(function(k) { return groups[k]; });
        out.sort(function(a, b) { return a.kind === b.kind ? 0 : (a.kind === 'error' ? -1 : 1); });
        return out;
    }

    /* Prefer host metadata signals; fall back to on-screen lines only when the host sent none. Caches
       the resolved list in liveSignalsInThisLog so the per-row copy handler (part D) can re-find a
       clicked fallback entry by fingerprint. */
    function resolveSignalsInThisLog() {
        var fromHost = signalDataCache.signalsInThisLog || [];
        var resolved = fromHost.length > 0 ? fromHost : buildLiveSignalsFromLines();
        liveSignalsInThisLog = resolved;
        return resolved;
    }

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
        // The count is the headline of the hero — wrap the number so CSS can give it weight + severity
        // color, so "5" reads before its label instead of the whole line being flat same-size text.
        // heroErrorCount/heroWarningCount are numbers from the payload, so no escaping is needed.
        // Each metric is a nowrap unit so the panel can wrap BETWEEN them but never split an emoji
        // from its count ("🟡" landing on a line above "Warnings: 3") — the old ' · '-joined string
        // wrapped mid-metric on a narrow panel.
        if (typeof heroErrorCount === 'number') parts.push('<span class="signal-hero-metric">\\uD83D\\uDD34 ' + fillSignalString(SIGNAL_STRINGS.heroErrors, '<span class="signal-hero-num signal-hero-num-error">' + heroErrorCount + '</span>') + '</span>');
        if (typeof heroWarningCount === 'number') parts.push('<span class="signal-hero-metric">\\uD83D\\uDFE1 ' + fillSignalString(SIGNAL_STRINGS.heroWarnings, '<span class="signal-hero-num signal-hero-num-warn">' + heroWarningCount + '</span>') + '</span>');
        if (parts.length === 0 && hasLog && typeof heroErrorCount !== 'number' && typeof heroWarningCount !== 'number') parts.push('<span class="signal-hero-metric">' + esc(SIGNAL_STRINGS.heroNoErrorsWarnings || 'No errors or warnings recorded') + '</span>');
        if (heroSnapshotSummary) parts.push('<span class="signal-hero-metric signal-hero-snapshot">' + heroSnapshotSummary + '</span>');
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
        // Counts lead (they're the headline), trend sparkline follows. Metrics join with '' — the
        // flex gap on .signal-hero-metrics provides spacing, so wrapped units don't drag a stray '·'.
        heroEl.innerHTML = (parts.length > 0 ? '<span class="signal-hero-metrics">' + parts.join('') + '</span>' : '') + sparklineHtml + hintHtml;
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
            if (typeof heroErrorCount === 'number') heroParts.push(fillSignalString(SIGNAL_STRINGS.heroErrors, heroErrorCount));
            if (typeof heroWarningCount === 'number') heroParts.push(fillSignalString(SIGNAL_STRINGS.heroWarnings, heroWarningCount));
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
        /* Resolve host-or-fallback so the copy reflects what the panel shows (fallback live signals
           included), gated on logOpen not hasLog — a no-perf log still has this-log signals. */
        var signalsInLog = resolveSignalsInThisLog();
        if (logOpen && signalsInLog.length > 0) {
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
        /* Host resolved a clicked signal and is scrolling to it — the slow open is done, so clear the
           row shimmer + loading bar. The main viewer bus also handles this message (to scroll); both
           listeners receive it in the shared webview scope. */
        if (e.data.type === 'scrollToSignal') { if (typeof signalClearOpening === 'function') signalClearOpening(); return; }
        if (e.data.type === 'openSignalPanel') {
            openSignalPanel();
            if (e.data.tab) setSignalTab(e.data.tab);
            // Deep-link (saropaLogCapture.openSignal) carries the target fingerprint to scroll to.
            if (e.data.focusFingerprint && typeof window.focusSignalFingerprint === 'function') {
                window.focusSignalFingerprint(e.data.focusFingerprint);
            }
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
                coOccurrences: d.coOccurrences || [], pulse: d.pulse || null
            };
            /* Plan 053-A: noise-learning suggestions arrive in the same signalData payload so
               the panel never makes a separate round-trip. Empty list hides the section. */
            signalSuggestionsCache = d.filterSuggestions || [];
            renderPulse();
            renderHotFiles(); renderSignalsInThisLog();
            /* Trouble Mode Signals band reads the same signalsInThisLog cache — refresh it here
               so the band populates without its own round-trip. Guarded: absent in some harnesses. */
            if (typeof renderTroubleSignalsBand === 'function') renderTroubleSignalsBand();
            renderEnvironment(); renderSignalTrends(); renderCoOccurrences();
            renderFilterSuggestions();
            /* Update icon bar badge with total signal count (this log + all signals). Resolve the
               this-log list directly (idempotent, cached) rather than reading liveSignalsInThisLog —
               that removes the dependency on renderSignalsInThisLog having run first, and still counts
               fallback live signals (signalDataCache.signalsInThisLog is empty in the fallback case). */
            var sigTotal = (resolveSignalsInThisLog() || []).length + (signalDataCache.allSignals || []).length;
            if (typeof updateIconBadge === 'function') updateIconBadge('ib-signal-badge', 'ib-signal-count', sigTotal);
        }
        if (e.data.type === 'performanceData') {
            heroLoading = false;
            hasLog = !!(e.data.sessionData);
            currentLogLabel = e.data.currentLogLabel || '';
            /* A log is open iff the host sent a label for it (basename of the viewed file). Drives the
               "This log" section visibility independently of perf-sampling data (see logOpen decl).
               OR hasLog defensively: perf data can only exist for an open log, so treat that as open
               even in the unlikely event a label is missing. */
            logOpen = !!currentLogLabel || hasLog;
            heroErrorCount = e.data.heroErrorCount;
            heroWarningCount = e.data.heroWarningCount;
            heroSnapshotSummary = (e.data.heroSnapshotSummary != null && e.data.heroSnapshotSummary !== '') ? String(e.data.heroSnapshotSummary) : '';
            heroSparklineData = e.data.heroSparklineData || undefined;
            var scopeEl = document.getElementById('signal-performance-scope');
            var labelEl = document.getElementById('signal-current-log-label');
            if (scopeEl && labelEl) {
                if (hasLog && currentLogLabel) { labelEl.textContent = currentLogLabel; scopeEl.style.display = ''; }
                else if (hasLog) { labelEl.textContent = SIGNAL_STRINGS.noLogOpen; scopeEl.style.display = ''; }
                else { scopeEl.style.display = 'none'; }
            }
            renderPerformanceHero();
            applyStateAB();
        }
    });
`;
}
