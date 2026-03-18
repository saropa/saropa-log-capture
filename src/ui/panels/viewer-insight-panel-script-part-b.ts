/**
 * Insight panel script part B: utils, cases list/form, recurring, hot files, errors in log, environment.
 * Concatenated by viewer-insight-panel-script.ts to stay under max-lines.
 */

/** Returns the second fragment of the Insight panel IIFE (render helpers and lists). */
export function getInsightScriptPartB(maxRecurringTextLen: number): string {
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
        var input = document.getElementById('insight-cases-name-input');
        var confirmBtn = document.getElementById('insight-cases-create-confirm');
        if (input) input.disabled = loading;
        if (confirmBtn) { confirmBtn.disabled = loading; confirmBtn.textContent = loading ? 'Creating…' : 'Create'; }
    }
    function showCreateInvestigationForm(show) {
        var row = document.getElementById('insight-cases-create-row');
        var form = document.getElementById('insight-cases-create-form');
        var input = document.getElementById('insight-cases-name-input');
        var errEl = document.getElementById('insight-cases-create-error');
        if (row) row.style.display = show ? 'none' : '';
        if (form) form.style.display = show ? 'flex' : 'none';
        if (input) { input.value = ''; input.disabled = createInvestigationInProgress; if (show) input.focus(); }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        var confirmBtn = document.getElementById('insight-cases-create-confirm');
        if (confirmBtn) { confirmBtn.disabled = createInvestigationInProgress; confirmBtn.textContent = createInvestigationInProgress ? 'Creating…' : 'Create'; }
    }
    function renderCasesList() {
        var listEl = document.getElementById('insight-cases-list');
        var emptyEl = document.getElementById('insight-cases-empty');
        var viewAllRow = document.getElementById('insight-cases-view-all');
        var viewAllLink = document.getElementById('insight-cases-view-all-link');
        var createBtn = document.getElementById('insight-cases-create');
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
        var form = document.getElementById('insight-cases-create-form');
        var input = document.getElementById('insight-cases-name-input');
        var confirmBtn = document.getElementById('insight-cases-create-confirm');
        var cancelBtn = document.getElementById('insight-cases-create-cancel');
        var errEl = document.getElementById('insight-cases-create-error');
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
        var srcStr = (inv.sourceCount != null) ? (INSIGHT_STRINGS.sourcesCount || '{0} source(s)').replace('{0}', String(inv.sourceCount)) : '';
        var upStr = (inv.updatedAt != null) ? (INSIGHT_STRINGS.updatedAgo || 'Updated {0}').replace('{0}', formatUpdatedAgo(inv.updatedAt)) : '';
        var meta = [srcStr, upStr].filter(Boolean).join(' \\u00b7 ');
        var label = inv.name + (meta ? ' \\u00b7 ' + meta : '');
        var activeMark = inv.id === (activeId || '') ? ' <span class="session-investigation-check">&#10003;</span>' : '';
        return '<div class="session-investigation-item' + active + '" data-investigation-id="' + escapeAttr(inv.id) + '">' + esc(label) + activeMark + '</div>';
    }
    var viewAllLinkEl = document.getElementById('insight-cases-view-all-link');
    if (viewAllLinkEl) viewAllLinkEl.addEventListener('click', function() {
        setSectionExpanded('cases', true);
        renderSectionAccordion('cases');
        var listEl = document.getElementById('insight-cases-list');
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
        var vw = document.getElementById('insight-cases-view-all');
        if (vw) vw.style.display = 'none';
    });
    bindCreateInvestigationForm();

    function renderRecurringList() {
        var listEl = document.getElementById('insight-recurring-list');
        var emptyEl = document.getElementById('insight-recurring-empty');
        var visible = (insightDataCache.errors || []).filter(function(e) { return (insightDataCache.statuses || {})[e.hash] !== 'muted'; });
        var toShow = visible.slice(0, 5);
        if (toShow.length === 0) {
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.innerHTML = toShow.map(function(e) {
            var status = (insightDataCache.statuses || {})[e.hash] || 'open';
            var dimCls = status === 'closed' ? ' re-closed' : '';
            var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
            var total = e.totalOccurrences + ' total';
            var actions = status === 'open'
                ? '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.hash) + '" data-status="muted">Mute</span>'
                : '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="open">Re-open</span>';
            var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
            var fullText = e.normalizedText || '';
            var displayText = truncateForDisplay(fullText);
            var titleAttr = esc((e.exampleLine || fullText).trim() || '');
            var addBtn = '<span class="re-action re-add-to-case" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-hash="' + esc(e.hash) + '" data-normalized="' + esc(e.normalizedText || '') + '" data-example="' + esc(e.exampleLine || '') + '">+</span>';
            return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + titleAttr + '">' + cat + esc(displayText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div><div class="re-actions">' + addBtn + ' ' + actions + '</div></div>';
        }).join('');
    }
    function renderHotFiles() {
        var summaryEl = document.getElementById('insight-hotfiles-summary');
        var emptyEl = document.getElementById('insight-hotfiles-empty');
        var listEl = document.getElementById('insight-hotfiles-list');
        var files = insightDataCache.hotFiles || [];
        if (summaryEl) summaryEl.textContent = files.length === 0 ? 'Frequently modified files' : (files.length + ' file' + (files.length === 1 ? '' : 's') + ' frequently modified');
        var toShow = files.slice(0, 5);
        if (emptyEl) emptyEl.style.display = toShow.length === 0 ? '' : 'none';
        if (listEl) {
            listEl.innerHTML = toShow.length === 0 ? '' : toShow.map(function(f) {
                return '<div class="insight-hotfile-item"><span class="re-action re-add-to-case insight-hotfile-add" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-filename="' + esc(f.filename || '') + '">+</span><span class="insight-hotfile-name">' + esc(f.filename) + '</span><span class="insight-hotfile-meta">' + (f.sessionCount || 0) + ' session' + (f.sessionCount === 1 ? '' : 's') + '</span></div>';
            }).join('');
        }
    }
    function renderRecurringInLog() {
        var summaryEl = document.getElementById('insight-recurring-in-log-summary');
        var listEl = document.getElementById('insight-recurring-in-log-list');
        var inLog = (insightDataCache.recurringInThisLog || []).filter(function(e) { return (insightDataCache.statuses || {})[e.hash] !== 'muted'; });
        if (summaryEl) summaryEl.textContent = inLog.length === 0 ? 'Recurring in this log' : (inLog.length + ' of your recurring error' + (inLog.length === 1 ? '' : 's') + ' appear in this log');
        if (listEl) {
            if (inLog.length === 0) listEl.innerHTML = '<p class="insight-hotfiles-empty">None of your recurring errors appear in this log.</p>';
            else listEl.innerHTML = inLog.map(function(e) {
                var status = (insightDataCache.statuses || {})[e.hash] || 'open';
                var dimCls = status === 'closed' ? ' re-closed' : '';
                var sessions = e.sessionCount === 1 ? '1 session' : e.sessionCount + ' sessions';
                var total = e.totalOccurrences + ' total';
                var actions = status === 'open' ? '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="closed">Close</span><span class="re-action" data-hash="' + esc(e.hash) + '" data-status="muted">Mute</span>' : '<span class="re-action" data-hash="' + esc(e.hash) + '" data-status="open">Re-open</span>';
                var cat = e.category ? '<span class="re-cat-badge re-cat-' + esc(e.category) + '">' + esc(e.category).toUpperCase() + '</span> ' : '';
                var fullText = e.normalizedText || '';
                var displayText = truncateForDisplay(fullText);
                var titleAttr = esc((e.exampleLine || fullText).trim() || '');
                var addBtn = '<span class="re-action re-add-to-case" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-hash="' + esc(e.hash) + '" data-normalized="' + esc(e.normalizedText || '') + '" data-example="' + esc(e.exampleLine || '') + '">+</span>';
                return '<div class="re-card' + dimCls + '"><div class="re-text" title="' + titleAttr + '">' + cat + esc(displayText) + '</div><div class="re-meta">' + sessions + ' \\u00b7 ' + total + '</div><div class="re-actions">' + addBtn + ' ' + actions + '</div></div>';
            }).join('');
        }
    }
    function renderErrorsInLog() {
        var subtitleEl = document.getElementById('insight-errors-in-log-subtitle');
        var listEl = document.getElementById('insight-errors-in-log-list');
        var emptyEl = document.getElementById('insight-errors-in-log-empty');
        var items = (insightDataCache.errorsInThisLog || []).slice(0, 3);
        var total = insightDataCache.errorsInThisLogTotal;
        var showTopOfN = items.length === 3 && (total != null && total > 3);
        if (subtitleEl) subtitleEl.textContent = showTopOfN && INSIGHT_STRINGS.topOfTotal
            ? (INSIGHT_STRINGS.topOfTotal.replace('{0}', String(total))) : (INSIGHT_STRINGS.sectionErrorsInLog || 'Errors in this log');
        if (emptyEl) { emptyEl.style.display = items.length === 0 ? '' : 'none'; if (items.length === 0) emptyEl.innerHTML = '<span class="insight-margin-emoji" aria-hidden="true">\\u2139\\uFE0F</span>' + esc(INSIGHT_STRINGS.errorsInLogEmpty); }
        if (listEl) {
            if (items.length === 0) listEl.innerHTML = '';
            else listEl.innerHTML = items.map(function(it) {
                var text = (it.normalizedText || it.exampleLine || '').trim() || 'Error';
                var displayText = truncateForDisplay(text);
                var count = (it.count != null) ? it.count : 0;
                var addBtn = '<span class="re-action re-add-to-case insight-errors-in-log-add" role="button" title="' + esc(INSIGHT_STRINGS.addToCase) + '" aria-label="' + esc(INSIGHT_STRINGS.addToCase) + '" data-normalized="' + esc(it.normalizedText || '') + '" data-example="' + esc(it.exampleLine || '') + '">+</span>';
                return '<div class="re-card insight-errors-in-log-item"><div class="re-text" title="' + esc(it.exampleLine || text) + '">' + esc(displayText) + '</div><div class="re-meta">' + count + ' occurrence' + (count === 1 ? '' : 's') + '</div><div class="re-actions">' + addBtn + '</div></div>';
            }).join('');
        }
    }
    function renderThisLogEmptyState() {
        var emptyBlock = document.getElementById('insight-this-log-empty');
        var contentBlock = document.getElementById('insight-this-log-content');
        var errorsEmpty = (insightDataCache.errorsInThisLog || []).length === 0;
        var inLog = (insightDataCache.recurringInThisLog || []).filter(function(e) { return (insightDataCache.statuses || {})[e.hash] !== 'muted'; });
        var recurringEmpty = inLog.length === 0;
        var bothEmpty = errorsEmpty && recurringEmpty;
        if (emptyBlock) emptyBlock.style.display = bothEmpty ? '' : 'none';
        if (contentBlock) contentBlock.style.display = bothEmpty ? 'none' : '';
    }
    function renderEnvironment() {
        var summaryEl = document.getElementById('insight-environment-summary');
        var listEl = document.getElementById('insight-environment-list');
        var platforms = insightDataCache.platforms || [];
        var sdks = insightDataCache.sdkVersions || [];
        var adapters = insightDataCache.debugAdapters || [];
        var total = platforms.length + sdks.length + adapters.length;
        if (summaryEl) summaryEl.textContent = total === 0 ? 'Environment' : ('Environment (' + total + ' entries)');
        if (listEl) {
            var parts = [];
            if (platforms.length) parts.push('<div class="insight-env-group"><div class="insight-env-title">Platforms</div>' + platforms.slice(0, 5).map(function(p) { return '<div class="insight-env-row"><span>' + esc(p.value) + '</span><span class="insight-hotfile-meta">' + p.sessionCount + ' session' + (p.sessionCount === 1 ? '' : 's') + '</span></div>'; }).join('') + '</div>');
            if (sdks.length) parts.push('<div class="insight-env-group"><div class="insight-env-title">SDK / runtime</div>' + sdks.slice(0, 5).map(function(p) { return '<div class="insight-env-row"><span>' + esc(p.value) + '</span><span class="insight-hotfile-meta">' + p.sessionCount + '</span></div>'; }).join('') + '</div>');
            if (adapters.length) parts.push('<div class="insight-env-group"><div class="insight-env-title">Debug adapters</div>' + adapters.slice(0, 5).map(function(p) { return '<div class="insight-env-row"><span>' + esc(p.value) + '</span><span class="insight-hotfile-meta">' + p.sessionCount + '</span></div>'; }).join('') + '</div>');
            listEl.innerHTML = parts.length === 0 ? '<p class="insight-hotfiles-empty">No environment data across sessions.</p>' : parts.join('');
        }
    }
`;
}
