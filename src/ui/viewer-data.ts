/**
 * Core data management and rendering for the log viewer webview.
 *
 * Contains the line data store (addToData, trimData), height calculations
 * (recalcHeights, calcItemHeight), and the virtual scrolling renderer
 * (renderItem, renderViewport).
 */
import { getViewerDataHelpers } from './viewer-data-helpers';

export function getViewerDataScript(): string {
    return getViewerDataHelpers() + /* javascript */ `

function addToData(html, isMarker, category, ts, fw) {
    if (isMarker) {
        if (typeof finalizeStackGroup === 'function' && activeGroupHeader) finalizeStackGroup(activeGroupHeader); activeGroupHeader = null;
        allLines.push({ html: html, type: 'marker', height: MARKER_HEIGHT, category: category, groupId: -1, timestamp: ts });
        totalHeight += MARKER_HEIGHT;
        return;
    }
    if (isStackFrameText(html)) {
        var plainFrame = stripTags(html);
        var context = (typeof extractContext === 'function') ? extractContext(plainFrame) : null;

        if (activeGroupHeader) {
            allLines.push({ html: html, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, level: 'error', sourceTag: activeGroupHeader.sourceTag, sourceFiltered: false, context: context });
            activeGroupHeader.frameCount++;
            return;
        }
        var gid = nextGroupId++;
        var sTagH = (typeof parseSourceTag === 'function') ? parseSourceTag(plainFrame) : null;
        var hdr = { html: html, type: 'stack-header', height: ROW_HEIGHT, category: category, groupId: gid, frameCount: 1, collapsed: 'preview', previewCount: 3, timestamp: ts, fw: fw, level: 'error', seq: nextSeq++, sourceTag: sTagH, sourceFiltered: false, context: context };
        allLines.push(hdr);
        if (typeof registerSourceTag === 'function') { registerSourceTag(hdr); }
        activeGroupHeader = hdr;
        totalHeight += ROW_HEIGHT;
        return;
    }
    if (typeof finalizeStackGroup === 'function' && activeGroupHeader) finalizeStackGroup(activeGroupHeader); activeGroupHeader = null;
    var plain = stripTags(html);
    var isSep = isSeparatorLine(plain);
    var lvl = (typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info';
    var sTag = (typeof parseSourceTag === 'function') ? parseSourceTag(plain) : null;

    // Real-time repeat detection
    var currentHash = generateRepeatHash(lvl, plain);
    var now = ts || Date.now();
    var isRepeat = false;

    if (repeatTracker.lastHash === currentHash &&
        (now - repeatTracker.lastTimestamp) < repeatWindowMs) {
        // This is a repeat within the time window
        isRepeat = true;
        repeatTracker.count++;
        repeatTracker.lastTimestamp = now;

        // Create repeat notification line
        var preview = repeatTracker.lastPlainText.substring(0, repeatPreviewLength);
        if (repeatTracker.lastPlainText.length > repeatPreviewLength) {
            preview += '...';
        }
        var levelDot = (typeof getLevelDot === 'function') ? getLevelDot(lvl) : '';
        var repeatHtml = '<span class="repeat-notification">' + levelDot +
            ' Repeated log #' + repeatTracker.count +
            ' <span class="repeat-preview">(' + escapeHtml(preview) + ')</span></span>';
        var repeatItem = {
            html: repeatHtml,
            type: 'repeat-notification',
            height: ROW_HEIGHT,
            category: category,
            groupId: -1,
            timestamp: ts,
            level: lvl,
            seq: nextSeq++,
            sourceTag: sTag,
            sourceFiltered: false,
            isSeparator: false
        };
        allLines.push(repeatItem);
        if (typeof registerSourceTag === 'function') { registerSourceTag(repeatItem); }
        totalHeight += ROW_HEIGHT;
    } else {
        // New unique message - reset tracker
        repeatTracker.lastHash = currentHash;
        repeatTracker.lastPlainText = plain;
        repeatTracker.lastLevel = lvl;
        repeatTracker.count = 1;
        repeatTracker.lastTimestamp = now;

        // Add the original line normally
        var errorClass = (typeof classifyError === 'function') ? classifyError(plain) : null;
        var errorSuppressed = (typeof suppressTransientErrors !== 'undefined' && suppressTransientErrors && errorClass === 'transient');

        // Check for critical errors
        if (typeof checkCriticalError === 'function') {
            checkCriticalError(plain);
        }

        var lineItem = { html: html, type: 'line', height: ROW_HEIGHT, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, sourceFiltered: false, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed };
        allLines.push(lineItem);
        if (typeof registerSourceTag === 'function') { registerSourceTag(lineItem); }
        totalHeight += (errorSuppressed ? 0 : ROW_HEIGHT);
    }
}

function toggleStackGroup(groupId) {
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].groupId === groupId && allLines[i].type === 'stack-header') {
            var header = allLines[i];
            // Cycle: preview → expanded → collapsed → preview
            if (header.collapsed === 'preview') {
                header.collapsed = false; // Expand all
            } else if (header.collapsed === false) {
                header.collapsed = true; // Collapse all
            } else {
                header.collapsed = 'preview'; // Show preview
            }
            break;
        }
    }
    recalcHeights();
    renderViewport(true);
}

function trimData() {
    if (allLines.length <= MAX_LINES) return;
    var excess = allLines.length - MAX_LINES;
    if (typeof unregisterSourceTag === 'function') {
        for (var i = 0; i < excess; i++) { unregisterSourceTag(allLines[i]); }
    }
    for (var i = 0; i < excess; i++) { totalHeight -= allLines[i].height; }
    allLines.splice(0, excess);
    activeGroupHeader = null;
}

/**
 * Recalculate all line heights from scratch.
 * Called by every filter (category, exclusion, level) after setting their flags,
 * and by toggleStackGroup after toggling collapsed state. This is the single
 * source of truth for height — individual filters never manipulate heights directly.
 */
function recalcHeights() {
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].height = calcItemHeight(allLines[i]);
        totalHeight += allLines[i].height;
    }
}

function renderViewport(force) {
    if (!logEl.clientHeight) return;
    var scrollTop = logEl.scrollTop;
    var viewH = logEl.clientHeight;
    var bufferPx = OVERSCAN * ROW_HEIGHT;
    var topTarget = Math.max(0, scrollTop - bufferPx);
    var bottomTarget = scrollTop + viewH + bufferPx;
    var cumH = 0, startIdx = 0, startOffset = 0;
    for (var i = 0; i < allLines.length; i++) {
        if (cumH + allLines[i].height > topTarget) { startIdx = i; startOffset = cumH; break; }
        cumH += allLines[i].height;
        if (i === allLines.length - 1) { startIdx = allLines.length; startOffset = cumH; }
    }
    // Lightweight end-index scan — no HTML generation yet
    var endH = 0, endIdx = startIdx;
    for (var i = startIdx; i < allLines.length; i++) {
        if (allLines[i].height === 0) { endIdx = i; continue; }
        endH += allLines[i].height; endIdx = i;
        if (startOffset + endH > bottomTarget) break;
    }
    // Hysteresis: let the overscan buffer absorb small scroll movements
    // natively. Only rebuild the DOM when the visible area shifts close to
    // the edge of the previously rendered content.
    var hyst = Math.floor(OVERSCAN / 2);
    if (!force && lastStart >= 0 &&
        Math.abs(startIdx - lastStart) < hyst &&
        Math.abs(endIdx - lastEnd) < hyst) { return; }
    lastStart = startIdx; lastEnd = endIdx;
    var parts = [];
    for (var i = startIdx; i <= endIdx && i < allLines.length; i++) {
        if (allLines[i].height === 0) continue;
        parts.push(renderItem(allLines[i], i));
    }
    viewportEl.innerHTML = parts.join('');
    spacerTop.style.height = startOffset + 'px';
    var bottomH = 0;
    for (var i = endIdx + 1; i < allLines.length; i++) bottomH += allLines[i].height;
    spacerBottom.style.height = bottomH + 'px';
}
`;
}
