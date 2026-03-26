"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComponentStyles = getComponentStyles;
/**
 * CSS styles for interactive UI components in the viewer webview.
 *
 * Covers search bar, keyword watch chips, pinned section,
 * exclusion controls, level filter buttons, and inline peek.
 */
const viewer_styles_search_1 = require("./viewer-styles-search");
const viewer_styles_ui_1 = require("./viewer-styles-ui");
const viewer_styles_level_1 = require("./viewer-styles-level");
function getComponentStyles() {
    return (0, viewer_styles_search_1.getSearchStyles)() + (0, viewer_styles_ui_1.getUiStyles)() + (0, viewer_styles_level_1.getLevelStyles)();
}
//# sourceMappingURL=viewer-styles-components.js.map