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

function addToData(html, isMarker, category, ts, fw, sp) {
    if (isMarker) {
        if (activeGroupHeader) {
            if (typeof finalizeStackGroup === 'function') finalizeStackGroup(activeGroupHeader);
            if (typeof registerClassTags === 'function') registerClassTags(activeGroupHeader);
            activeGroupHeader = null;
        }
        allLines.push({ html: html, type: 'marker', height: MARKER_HEIGHT, category: category, groupId: -1, timestamp: ts, sourcePath: sp || null });
        totalHeight += MARKER_HEIGHT;
        return;
    }
    if (isStackFrameText(html)) {
        var plainFrame = stripTags(html);
        var context = (typeof extractContext === 'function') ? extractContext(plainFrame) : null;

        if (activeGroupHeader) {
            if (!activeGroupHeader._appFrameCount) activeGroupHeader._appFrameCount = 0;
            var appIdx = fw ? -1 : activeGroupHeader._appFrameCount;
            if (!fw) activeGroupHeader._appFrameCount++;
            var cTagsF = (typeof parseClassTags === 'function') ? parseClassTags(plainFrame) : [];
            if (cTagsF.length > 0 && activeGroupHeader.classTags) {
                for (var ci = 0; ci < cTagsF.length; ci++) {
                    if (activeGroupHeader.classTags.indexOf(cTagsF[ci]) < 0) activeGroupHeader.classTags.push(cTagsF[ci]);
                }
            }
            allLines.push({ html: html, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, level: 'error', sourceTag: activeGroupHeader.sourceTag, logcatTag: activeGroupHeader.logcatTag, sourceFiltered: false, classFiltered: false, classTags: cTagsF, context: context, _appFrameIdx: appIdx, sourcePath: sp || null, scopeFiltered: false });
            activeGroupHeader.frameCount++;
            return;
        }
        var gid = nextGroupId++;
        var sTagH = (typeof parseSourceTag === 'function') ? parseSourceTag(plainFrame) : null;
        var lTagH = (typeof parseLogcatTag === 'function') ? parseLogcatTag(plainFrame) : null;
        if (lTagH && lTagH === sTagH) lTagH = null;
        var cTagsH = (typeof parseClassTags === 'function') ? parseClassTags(plainFrame) : [];
        var hdr = { html: html, type: 'stack-header', height: ROW_HEIGHT, category: category, groupId: gid, frameCount: 1, collapsed: 'preview', previewCount: 3, timestamp: ts, fw: fw, level: 'error', seq: nextSeq++, sourceTag: sTagH, logcatTag: lTagH, sourceFiltered: false, classFiltered: false, classTags: cTagsH, context: context, _appFrameCount: (fw ? 0 : 1), sourcePath: sp || null, scopeFiltered: false };
        allLines.push(hdr);
        if (typeof registerSourceTag === 'function') { registerSourceTag(hdr); }
        groupHeaderMap[gid] = hdr;
        activeGroupHeader = hdr;
        totalHeight += ROW_HEIGHT;
        return;
    }
    if (activeGroupHeader) {
        if (typeof finalizeStackGroup === 'function') finalizeStackGroup(activeGroupHeader);
        if (typeof registerClassTags === 'function') registerClassTags(activeGroupHeader);
        activeGroupHeader = null;
    }
    var plain = stripTags(html);
    var isSep = isSeparatorLine(plain);
    var lvl = (typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info';
    var sTag = (typeof parseSourceTag === 'function') ? parseSourceTag(plain) : null;
    var lTag = (typeof parseLogcatTag === 'function') ? parseLogcatTag(plain) : null;
    if (lTag && lTag === sTag) lTag = null;
    var cTags = (typeof parseClassTags === 'function') ? parseClassTags(plain) : [];

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
            logcatTag: lTag,
            sourceFiltered: false,
            classFiltered: false,
            classTags: cTags,
            isSeparator: false,
            sourcePath: sp || null,
            scopeFiltered: false
        };
        allLines.push(repeatItem);
        if (typeof registerSourceTag === 'function') { registerSourceTag(repeatItem); }
        if (typeof registerClassTags === 'function') { registerClassTags(repeatItem); }
        totalHeight += ROW_HEIGHT;
    } else {
        // New unique message - reset tracker
        repeatTracker.lastHash = currentHash;
        repeatTracker.lastPlainText = plain;
        repeatTracker.lastLevel = lvl;
        repeatTracker.count = 1;
        repeatTracker.lastTimestamp = now;

        // Add the original line normally
        var errorClass = (typeof classifyError === 'function' && (!strictLevelDetection || lvl === 'error')) ? classifyError(plain) : null;
        var errorSuppressed = (typeof suppressTransientErrors !== 'undefined' && suppressTransientErrors && errorClass === 'transient');

        // Check for critical errors
        if (typeof checkCriticalError === 'function') {
            checkCriticalError(plain);
        }

        var appHidden = (typeof appOnlyMode !== 'undefined' && appOnlyMode && fw);
        var classHidden = (typeof isClassFiltered === 'function' && isClassFiltered({ classTags: cTags, type: 'line' }));
        var lineH = (errorSuppressed || appHidden || classHidden) ? 0 : ROW_HEIGHT;
        var scopeFilt = (typeof calcScopeFiltered === 'function') ? calcScopeFiltered(sp) : false;
        var finalH = scopeFilt ? 0 : lineH;
        var lineItem = { html: html, type: 'line', height: finalH, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, logcatTag: lTag, sourceFiltered: false, classFiltered: !!classHidden, classTags: cTags, isSeparator: isSep, errorClass: errorClass, errorSuppressed: errorSuppressed, fw: fw, sourcePath: sp || null, scopeFiltered: scopeFilt };
        allLines.push(lineItem);
        if (typeof registerSourceTag === 'function') { registerSourceTag(lineItem); }
        if (typeof registerClassTags === 'function') { registerClassTags(lineItem); }
        totalHeight += finalH;
    }
}

function toggleStackGroup(groupId) {
    var header = groupHeaderMap[groupId];
    if (!header) return;
    // Cycle: preview → expanded → collapsed → preview
    if (header.collapsed === 'preview') {
        header.collapsed = false; // Expand all
    } else if (header.collapsed === false) {
        header.collapsed = true; // Collapse all
    } else {
        header.collapsed = 'preview'; // Show preview
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

function trimData() {
    if (allLines.length <= MAX_LINES) return;
    var excess = allLines.length - MAX_LINES;
    var removedHeight = 0;
    for (var i = 0; i < excess; i++) {
        if (typeof unregisterSourceTag === 'function') unregisterSourceTag(allLines[i]);
        if (typeof unregisterClassTags === 'function') unregisterClassTags(allLines[i]);
        if (allLines[i].type === 'stack-header') delete groupHeaderMap[allLines[i].groupId];
        removedHeight += allLines[i].height;
        totalHeight -= allLines[i].height;
    }
    allLines.splice(0, excess);
    activeGroupHeader = null;
    if (removedHeight > 0 && !autoScroll) {
        suppressScroll = true;
        logEl.scrollTop = Math.max(0, logEl.scrollTop - removedHeight);
        suppressScroll = false;
    }
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
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
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
}

function renderViewport(force) {
    if (!logEl.clientHeight) return;
    var scrollTop = logEl.scrollTop;
    var viewH = logEl.clientHeight;
    var bufferPx = OVERSCAN * ROW_HEIGHT;
    var topTarget = Math.max(0, scrollTop - bufferPx);
    var bottomTarget = scrollTop + viewH + bufferPx;
    var startIdx, startOffset, endIdx;

    if (typeof findIndexAtOffset === 'function' && prefixSums) {
        var sa = findIndexAtOffset(topTarget);
        startIdx = sa.index;
        startOffset = prefixSums[startIdx];
        var ea = findIndexAtOffset(bottomTarget);
        endIdx = ea.index;
    } else {
        // Fallback before prefix sums are built
        var cumH = 0; startIdx = 0; startOffset = 0;
        for (var i = 0; i < allLines.length; i++) {
            if (cumH + allLines[i].height > topTarget) { startIdx = i; startOffset = cumH; break; }
            cumH += allLines[i].height;
            if (i === allLines.length - 1) { startIdx = allLines.length; startOffset = cumH; }
        }
        var endH = 0; endIdx = startIdx;
        for (var i = startIdx; i < allLines.length; i++) {
            if (allLines[i].height === 0) { endIdx = i; continue; }
            endH += allLines[i].height; endIdx = i;
            if (startOffset + endH > bottomTarget) break;
        }
    }

    // Hysteresis: only rebuild DOM when visible area shifts past half the overscan buffer
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
    var bottomH = (prefixSums && endIdx + 1 < prefixSums.length)
        ? totalHeight - prefixSums[endIdx + 1] : 0;
    spacerBottom.style.height = bottomH + 'px';
}
`;
}
