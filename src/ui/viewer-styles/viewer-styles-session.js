"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionPanelStyles = getSessionPanelStyles;
/**
 * CSS styles for the session history slide-out panel.
 *
 * Follows the same fixed-position slide-in pattern as the search
 * and options panels, sitting to the left of the icon bar.
 * Styles are composed from submodules (layout, list, tags/loading) to stay under the 300-line file limit.
 */
const viewer_styles_session_panel_1 = require("./viewer-styles-session-panel");
const viewer_styles_session_list_1 = require("./viewer-styles-session-list");
const viewer_styles_session_tags_loading_1 = require("./viewer-styles-session-tags-loading");
const viewer_styles_session_group_1 = require("./viewer-styles-session-group");
/** Return CSS for the session panel and its list items. */
function getSessionPanelStyles() {
    return (0, viewer_styles_session_panel_1.getSessionPanelLayoutStyles)()
        + (0, viewer_styles_session_list_1.getSessionListStyles)()
        + (0, viewer_styles_session_tags_loading_1.getSessionTagsLoadingStyles)()
        + (0, viewer_styles_session_group_1.getSessionGroupStyles)();
}
//# sourceMappingURL=viewer-styles-session.js.map