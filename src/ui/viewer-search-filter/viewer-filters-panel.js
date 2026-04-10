"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFiltersPanelScript = exports.getFiltersPanelHtml = void 0;
/**
 * Filters panel for the log viewer.
 *
 * Provides a slide-out panel with filter controls:
 *   - Quick Filters (presets + reset)
 *   - Log Inputs (merged sources + DAP category checkboxes)
 *   - Exclusions (exclusion patterns)
 *   - Message Tags (source tag chips with search)
 *   - Code Origins (class/method tag chips with search)
 *   - File Scope (code location narrowing)
 *   - SQL Commands (query type chips)
 */
const viewer_filters_panel_html_1 = require("./viewer-filters-panel-html");
Object.defineProperty(exports, "getFiltersPanelHtml", { enumerable: true, get: function () { return viewer_filters_panel_html_1.getFiltersPanelHtml; } });
const viewer_filters_panel_script_1 = require("./viewer-filters-panel-script");
Object.defineProperty(exports, "getFiltersPanelScript", { enumerable: true, get: function () { return viewer_filters_panel_script_1.getFiltersPanelScript; } });
//# sourceMappingURL=viewer-filters-panel.js.map