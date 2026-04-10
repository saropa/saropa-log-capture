"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const viewer_workspace_bool_message_map_1 = require("../../ui/provider/viewer-workspace-bool-message-map");
/**
 * Before: `setMinimapSqlDensity` was the only webview message type handled by a dedicated switch case.
 * After: the same and related layout toggles route through `SAROPA_BOOL_SETTING_BY_MSG_TYPE` so new
 * boolean settings do not duplicate `getConfiguration().update` blocks.
 */
suite("viewer-message-handler workspace bool messages", () => {
    test("maps each webview message type to the saropaLogCapture config key", () => {
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapSqlDensity, "minimapShowSqlDensity");
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapProportionalLines, "minimapProportionalLines");
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setShowScrollbar, "showScrollbar");
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapShowInfoMarkers, "minimapShowInfoMarkers");
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapViewportRedOutline, "minimapViewportRedOutline");
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapViewportOutsideArrow, "minimapViewportOutsideArrow");
    });
    test("does not include unrelated message types", () => {
        assert.strictEqual(viewer_workspace_bool_message_map_1.SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapWidth, undefined);
    });
});
//# sourceMappingURL=viewer-message-handler-workspace-bool.test.js.map