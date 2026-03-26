"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExportScript = exports.getExportModalHtml = void 0;
/**
 * Viewer Export Script
 *
 * Provides export functionality with level-based filtering and preset templates.
 * Users can export logs with custom level filters or use predefined templates like:
 * - Errors Only: Only error-level messages
 * - Full Debug: All levels including debug/trace
 * - Production Ready: Info, warnings, errors (no debug/trace)
 */
const viewer_export_html_1 = require("./viewer-export-html");
Object.defineProperty(exports, "getExportModalHtml", { enumerable: true, get: function () { return viewer_export_html_1.getExportModalHtml; } });
const viewer_export_script_1 = require("./viewer-export-script");
Object.defineProperty(exports, "getExportScript", { enumerable: true, get: function () { return viewer_export_script_1.getExportScript; } });
//# sourceMappingURL=viewer-export.js.map