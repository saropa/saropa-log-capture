/**
 * Typography message handlers for the log viewer webview.
 *
 * Applies typography-related host messages (`setLogFontSize`, `setLogLineHeight`, `logViewerVisualSpacing`,
 * `showCollapseDividerLabels`) that seed from workspace settings (`logFontSize`, `logLineHeight`,
 * `logViewerVisualSpacing`, `accessibility.showCollapseDividerLabels`), keeping layout and divider captions
 * in sync with the workspace. Extracted from viewer-script-messages.ts to keep that file under the line-count limit
 * and to mirror the `handleDbMessages` pre-handler pattern.
 *
 * Invariants:
 * - Updates `logFontSizeDefault` / `logLineHeightDefault` BEFORE calling setFontSize/setLineHeight,
 *   so a subsequent reset (Ctrl+0 / Ctrl+Shift+0) returns to the *settings-driven* value, not the
 *   hard-coded fallback in viewer-layout.ts.
 * - Guards typeof + Number.isFinite so a malformed host message cannot corrupt state.
 */

export function getViewerScriptTypographyMessageHandler(): string {
    return /* javascript */ `
function handleTypographyMessages(msg) {
    switch (msg.type) {
        case 'setLogFontSize':
            if (typeof msg.size === 'number' && Number.isFinite(msg.size)) {
                logFontSizeDefault = msg.size;
                if (typeof setFontSize === 'function') setFontSize(msg.size);
            }
            return true;
        case 'setLogLineHeight':
            if (typeof msg.height === 'number' && Number.isFinite(msg.height)) {
                logLineHeightDefault = msg.height;
                /* While a markdown document is open it runs at its own comfortable line height
                   (applyMarkdownTypography). A settings-seeded host message must NOT clobber that
                   — record the default (so exiting markdown restores it) but don't apply it now. */
                var mdActive = (typeof fileMode !== 'undefined' && fileMode === 'markdown' && typeof formatEnabled !== 'undefined' && formatEnabled);
                if (!mdActive && typeof setLineHeight === 'function') setLineHeight(msg.height);
            }
            return true;
        case 'logViewerVisualSpacing': {
            var lvvs = msg.value === true;
            logViewerVisualSpacingDefault = lvvs;
            visualSpacingEnabled = lvvs;
            if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
            if (typeof recalcAndRender === 'function') recalcAndRender();
            else {
                if (typeof recalcHeights === 'function') recalcHeights();
                if (typeof renderViewport === 'function') renderViewport(true);
            }
            return true;
        }
        case 'showCollapseDividerLabels': {
            showCollapseDividerLabels = msg.value === true;
            if (typeof renderViewport === 'function') renderViewport(true);
            return true;
        }
    }
    return false;
}
`;
}
