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
/**
 * String-level checks: host → webview messages for root-cause explain trigger stay wired.
 */
const assert = __importStar(require("node:assert"));
const viewer_script_messages_1 = require("../../ui/viewer/viewer-script-messages");
suite("viewer-script-messages root-cause host triggers", () => {
    test("includes triggerExplainRootCauseHypotheses case delegating to embed helper", () => {
        const handler = (0, viewer_script_messages_1.getViewerScriptMessageHandler)();
        assert.ok(handler.includes("case 'triggerExplainRootCauseHypotheses'"));
        assert.ok(handler.includes("runTriggerExplainRootCauseHypothesesFromHost"));
    });
    test("setRootCauseHintHostFields still uses hasOwnProperty partial updates", () => {
        const handler = (0, viewer_script_messages_1.getViewerScriptMessageHandler)();
        assert.ok(handler.includes("case 'setRootCauseHintHostFields'"));
        assert.ok(handler.includes("hasOwnProperty.call(msg, 'driftAdvisorSummary')"));
        assert.ok(handler.includes("hasOwnProperty.call(msg, 'sessionDiffSummary')"));
    });
});
//# sourceMappingURL=viewer-script-messages-root-cause.test.js.map