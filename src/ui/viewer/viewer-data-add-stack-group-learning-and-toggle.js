"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerDataAddStackGroupLearningAndToggleScript = getViewerDataAddStackGroupLearningAndToggleScript;
function getViewerDataAddStackGroupLearningAndToggleScript() {
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

function toggleStackGroup(groupId) {
    var header = groupHeaderMap[groupId];
    if (!header) return;
    var beforeCollapsed = header.collapsed;
    // Cycle: expanded -> collapsed -> preview -> expanded
    if (header.collapsed === 'preview') {
        header.collapsed = false; // Expand all
    } else if (header.collapsed === false) {
        header.collapsed = true; // Collapse all
    } else {
        header.collapsed = 'preview'; // Show preview ([+N more] for extra frames)
    }
    if (header.collapsed === true && beforeCollapsed !== true) {
        trackLearningDismissForStackGroup(groupId);
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}
`;
}
//# sourceMappingURL=viewer-data-add-stack-group-learning-and-toggle.js.map