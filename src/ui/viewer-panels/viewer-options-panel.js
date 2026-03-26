"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptionsPanelScript = exports.getOptionsPanelHtml = void 0;
/**
 * Options panel for the log viewer.
 *
 * Provides a slide-out panel with organized sections for all viewer settings:
 *   - Display options (word wrap, decorations, font size, line height)
 *   - Level filters
 *   - Search and filtering
 *   - Exclusions and watch
 *   - Layout (visual spacing)
 *   - Audio alerts
 *
 * The panel slides in from the right side of the viewer and can be toggled
 * via a gear icon button in the footer.
 */
const viewer_options_panel_html_1 = require("./viewer-options-panel-html");
Object.defineProperty(exports, "getOptionsPanelHtml", { enumerable: true, get: function () { return viewer_options_panel_html_1.getOptionsPanelHtml; } });
const viewer_options_panel_script_1 = require("./viewer-options-panel-script");
Object.defineProperty(exports, "getOptionsPanelScript", { enumerable: true, get: function () { return viewer_options_panel_script_1.getOptionsPanelScript; } });
//# sourceMappingURL=viewer-options-panel.js.map