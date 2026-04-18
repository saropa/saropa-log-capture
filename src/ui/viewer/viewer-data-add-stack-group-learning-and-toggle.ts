export function getViewerDataAddStackGroupLearningAndToggleScript(): string {
  return /* javascript */ `
function trackLearningDismissForStackGroup(groupId) {
    if (typeof learningEnabled === 'undefined' || !learningEnabled) return;
    var maxL = typeof learningMaxLineLen === 'number' ? learningMaxLineLen : 2000;
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (!it || it.groupId !== groupId) continue;
        if (it.type !== 'stack-frame' && it.type !== 'stack-header') continue;
        var plain = stripTags(it.html || '');
        if (!plain) continue;
        if (plain.length > maxL) plain = plain.substring(0, maxL);
        vscodeApi.postMessage({
            type: 'trackInteraction',
            interactionType: 'dismiss',
            lineText: plain,
            lineLevel: it.level || ''
        });
    }
}

/** Collapse every toggleable section: stack groups, continuation groups, and SQL repeat drilldowns. */
function collapseAllSections() {
    var gid;
    for (gid in groupHeaderMap) {
        if (groupHeaderMap[gid] && groupHeaderMap[gid].collapsed !== true) {
            groupHeaderMap[gid].collapsed = true;
        }
    }
    if (typeof contHeaderMap !== 'undefined') {
        for (gid in contHeaderMap) {
            if (contHeaderMap[gid] && !contHeaderMap[gid].contCollapsed) {
                contHeaderMap[gid].contCollapsed = true;
            }
        }
    }
    for (var ci = 0; ci < allLines.length; ci++) {
        var cit = allLines[ci];
        if (cit && cit.sqlRepeatDrilldownOpen) {
            cit.sqlRepeatDrilldownOpen = false;
            cit.html = buildSqlRepeatNotificationRowHtml(cit);
        }
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/** Expand every toggleable section: stack groups and continuation groups.
 *  Note: SQL repeat drilldowns are NOT reopened — the user may never have opened them. */
function expandAllSections() {
    var gid;
    for (gid in groupHeaderMap) {
        if (groupHeaderMap[gid] && groupHeaderMap[gid].collapsed) {
            groupHeaderMap[gid].collapsed = false;
        }
    }
    if (typeof contHeaderMap !== 'undefined') {
        for (gid in contHeaderMap) {
            if (contHeaderMap[gid] && contHeaderMap[gid].contCollapsed) {
                contHeaderMap[gid].contCollapsed = false;
            }
        }
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

function toggleStackGroup(groupId) {
    var header = groupHeaderMap[groupId];
    if (!header) return;
    var beforeCollapsed = header.collapsed;
    // Two-state toggle: collapsed ↔ expanded.
    // Preview mode is only used as an initial default (set in addToData),
    // not as a user-facing toggle state — clicking always goes to the
    // opposite extreme so a single click fully opens or fully closes.
    if (header.collapsed === false) {
        header.collapsed = true;
    } else {
        header.collapsed = false;
    }
    if (header.collapsed === true && beforeCollapsed !== true) {
        trackLearningDismissForStackGroup(groupId);
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}
`;
}

