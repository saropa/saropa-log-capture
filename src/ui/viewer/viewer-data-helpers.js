"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerDataHelpers = getViewerDataHelpers;
const viewer_data_helpers_core_1 = require("./viewer-data-helpers-core");
const viewer_data_helpers_render_1 = require("./viewer-data-helpers-render");
const viewer_data_n_plus_one_script_1 = require("./viewer-data-n-plus-one-script");
const viewer_db_detector_framework_script_1 = require("./viewer-db-detector-framework-script");
function getViewerDataHelpers(repeatThresholds, viewerDbInsightsEnabled = true, slowBurstThresholds, dbDetectorToggles) {
    return ((0, viewer_data_n_plus_one_script_1.getNPlusOneDetectorScript)(repeatThresholds) +
        (0, viewer_db_detector_framework_script_1.getViewerDbDetectorFrameworkScript)(viewerDbInsightsEnabled, slowBurstThresholds, dbDetectorToggles) +
        (0, viewer_data_helpers_core_1.getViewerDataHelpersCore)() +
        (0, viewer_data_helpers_render_1.getViewerDataHelpersRender)());
}
//# sourceMappingURL=viewer-data-helpers.js.map