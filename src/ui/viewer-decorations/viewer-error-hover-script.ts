/**
 * Client-side JavaScript for the error hover popup.
 *
 * Shows a floating popup when hovering over error badges in the log viewer.
 * Displays instant client-side data (classification, level) and requests
 * cross-session data from the extension. Provides an "Analyze" button
 * to open the full analysis panel.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getErrorHoverScript(): string {
    return /* javascript */ `
var errorHoverEl = null;
var errorHoverTimer = null;
var errorHoverLineIdx = -1;
var errorHoverHideTimer = null;

/**
 * Show the error hover popup near the badge element.
 * @param {Element} badge - The .error-badge element
 * @param {number} lineIdx - Index into allLines
 */
function showErrorHover(badge, lineIdx) {
    closeErrorHover();
    if (typeof closeContextPopover === 'function') { closeContextPopover(); }
    errorHoverLineIdx = lineIdx;

    var item = allLines[lineIdx];
    if (!item) return;

    var plain = stripTags(item.html || '');
    var popover = document.createElement('div');
    popover.className = 'error-hover';
    popover.innerHTML = buildErrorHoverSkeleton(item, plain);
    document.body.appendChild(popover);
    errorHoverEl = popover;

    positionErrorHover(popover, badge);
    attachErrorHoverHandlers(popover, lineIdx, plain);

    // Request cross-session data from extension
    vscodeApi.postMessage({
        type: 'requestErrorHoverData',
        text: plain,
        lineIndex: lineIdx,
    });
}

/** Build skeleton HTML with client-side-only data. */
function buildErrorHoverSkeleton(item, plain) {
    var cls = item.errorClass || '';
    var level = item.level || 'error';
    var fw = item.fw ? ' (framework)' : '';

    var badge = '';
    if (cls === 'critical') { badge = '<span class="eh-badge eh-badge-critical">CRITICAL</span>'; }
    else if (cls === 'transient') { badge = '<span class="eh-badge eh-badge-transient">TRANSIENT</span>'; }
    else if (cls === 'bug') { badge = '<span class="eh-badge eh-badge-bug">BUG</span>'; }

    var levelBadge = '<span class="eh-level eh-level-' + level + '">' + level + '</span>';
    var text = plain.length > 120 ? plain.substring(0, 120) + '\\u2026' : plain;

    return '<div class="eh-header">' + badge + levelBadge +
        '<span class="eh-fw">' + fw + '</span>' +
        '<button class="eh-close" title="Close">\\u00d7</button></div>' +
        '<div class="eh-text">' + escapeForAttr(text) + '</div>' +
        '<div class="eh-stats">' +
        '<div class="eh-stat eh-stat-loading"><span class="eh-spinner"></span> Loading history\\u2026</div>' +
        '</div>' +
        '<div class="eh-actions">' +
        '<button class="eh-analyze-btn" title="Open full analysis">Analyze</button>' +
        '</div>';
}

/** Fill in cross-session data when extension responds. */
function handleErrorHoverData(msg) {
    if (!errorHoverEl || msg.lineIndex !== errorHoverLineIdx) return;
    var stats = errorHoverEl.querySelector('.eh-stats');
    if (!stats) return;

    if (msg.empty) {
        stats.innerHTML = '<div class="eh-stat eh-stat-new">First occurrence</div>';
        return;
    }

    var cat = escapeForAttr(msg.crashCategory || '');
    var category = cat && cat !== 'non-fatal'
        ? '<span class="eh-crash-cat eh-cat-' + cat + '">' + cat.toUpperCase() + '</span> '
        : '';

    var ts = escapeForAttr(msg.triageStatus || 'open');
    var triage = '<span class="eh-triage eh-triage-' + ts + '">' + ts + '</span>';
    var logs = msg.sessionCount > 0
        ? msg.sessionCount + ' log' + (msg.sessionCount !== 1 ? 's' : '')
        : 'New';
    var total = msg.totalOccurrences > 0
        ? msg.totalOccurrences + ' total'
        : '';
    var seen = '';
    if (msg.firstSeen && msg.lastSeen) {
        var first = escapeForAttr((msg.firstSeen.split(/[_T]/)[0] || msg.firstSeen));
        var last = escapeForAttr((msg.lastSeen.split(/[_T]/)[0] || msg.lastSeen));
        seen = '<div class="eh-stat">First: ' + first + ' &middot; Last: ' + last + '</div>';
    }

    var hash = escapeForAttr(msg.hash || '');
    stats.innerHTML = '<div class="eh-stat">' + category + triage + '</div>' +
        '<div class="eh-stat">' + logs + (total ? ' &middot; ' + total : '') + '</div>' +
        seen +
        '<div class="eh-stat eh-hash" title="Fingerprint: ' + hash + '">#' + hash + '</div>';
}

function escapeForAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Position the popover near the badge, clamped to viewport. */
function positionErrorHover(popover, badge) {
    var rect = badge.getBoundingClientRect();
    var left = rect.left;
    var top = rect.bottom + 4;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    // Adjust after render
    requestAnimationFrame(function() {
        var pr = popover.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        if (left + pr.width > vw - 16) { popover.style.left = Math.max(8, vw - pr.width - 16) + 'px'; }
        if (top + pr.height > vh - 16) { popover.style.top = Math.max(8, rect.top - pr.height - 4) + 'px'; }
    });
}

function attachErrorHoverHandlers(popover, lineIdx, plain) {
    popover.querySelector('.eh-close').addEventListener('click', function(e) {
        e.stopPropagation();
        closeErrorHover();
    });
    popover.querySelector('.eh-analyze-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'openErrorAnalysis', text: plain, lineIndex: lineIdx });
        closeErrorHover();
    });

    popover.addEventListener('mouseenter', function() { clearHideTimer(); });
    popover.addEventListener('mouseleave', function() { startHideTimer(); });

    setTimeout(function() {
        document.addEventListener('click', onErrorHoverOutsideClick);
        document.addEventListener('keydown', onErrorHoverEscape);
    }, 0);
}

function onErrorHoverOutsideClick(e) {
    if (errorHoverEl && !errorHoverEl.contains(e.target)) { closeErrorHover(); }
}

function onErrorHoverEscape(e) {
    if (e.key === 'Escape') { closeErrorHover(); }
}

function closeErrorHover() {
    clearHoverTimer();
    clearHideTimer();
    if (errorHoverEl) {
        errorHoverEl.remove();
        errorHoverEl = null;
    }
    errorHoverLineIdx = -1;
    document.removeEventListener('click', onErrorHoverOutsideClick);
    document.removeEventListener('keydown', onErrorHoverEscape);
}

function clearHoverTimer() {
    if (errorHoverTimer) { clearTimeout(errorHoverTimer); errorHoverTimer = null; }
}
function clearHideTimer() {
    if (errorHoverHideTimer) { clearTimeout(errorHoverHideTimer); errorHoverHideTimer = null; }
}
function startHideTimer() {
    clearHideTimer();
    errorHoverHideTimer = setTimeout(closeErrorHover, 300);
}

// Hover listeners on viewport for error badges
viewportEl.addEventListener('mouseenter', function(e) {
    var badge = e.target.closest('.error-badge');
    if (!badge) return;
    var lineEl = badge.closest('[data-idx]');
    if (!lineEl) return;
    var idx = parseInt(lineEl.dataset.idx, 10);
    if (isNaN(idx)) return;

    clearHoverTimer();
    clearHideTimer();
    errorHoverTimer = setTimeout(function() { showErrorHover(badge, idx); }, 300);
}, true);

viewportEl.addEventListener('mouseleave', function(e) {
    var badge = e.target.closest('.error-badge');
    if (!badge) return;
    clearHoverTimer();
    if (errorHoverEl) { startHideTimer(); }
}, true);
`;
}
