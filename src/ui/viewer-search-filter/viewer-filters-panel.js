"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTagsPanelScript = exports.getTagsPanelHtml = void 0;
exports.getFiltersPanelScript = getFiltersPanelScript;
/**
 * Filter panel script and backward-compat re-exports.
 *
 * Tag chip sections (Message Tags, Source Classes, SQL Commands) now
 * live inside the filter drawer as accordion sections. The slide-out
 * panel was removed.
 */
const viewer_filters_panel_html_1 = require("./viewer-filters-panel-html");
Object.defineProperty(exports, "getTagsPanelHtml", { enumerable: true, get: function () { return viewer_filters_panel_html_1.getTagsPanelHtml; } });
const viewer_filters_panel_script_1 = require("./viewer-filters-panel-script");
Object.defineProperty(exports, "getTagsPanelScript", { enumerable: true, get: function () { return viewer_filters_panel_script_1.getTagsPanelScript; } });
/**
 * @deprecated Use getTagsPanelScript — kept for backward compatibility.
 */
function getFiltersPanelScript() {
    return (0, viewer_filters_panel_script_1.getTagsPanelScript)();
}
//# sourceMappingURL=viewer-filters-panel.js.map