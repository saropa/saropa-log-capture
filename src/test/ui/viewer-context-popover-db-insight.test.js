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
 * Regression tests for integration context popover: database line insight + Drift CTA gating.
 */
const assert = __importStar(require("assert"));
const viewer_context_popover_script_1 = require("../../ui/viewer-context-menu/viewer-context-popover-script");
const viewer_data_1 = require("../../ui/viewer/viewer-data");
suite('Context popover database insight', () => {
    test('embed defines line-local Database insight section', () => {
        const script = (0, viewer_context_popover_script_1.getContextPopoverScript)();
        assert.ok(script.includes('buildDatabaseInsightPopoverSection'));
        assert.ok(script.includes('popover-section-db-insight'));
        assert.ok(script.includes('popover-sql-snippet'));
        assert.ok(script.includes('if (!ins) return'));
        assert.ok(script.includes('seenCountSafe'));
    });
    test('viewer data embed defines db rollup and sqlSnippet for dbInsight on lines', () => {
        const data = (0, viewer_data_1.getViewerDataScript)();
        assert.ok(data.includes('updateDbInsightRollup'));
        assert.ok(data.includes('sqlSnippet'));
    });
    test('Drift Advisor CTA is gated on driftAdvisorAvailable in popover markup', () => {
        const script = (0, viewer_context_popover_script_1.getContextPopoverScript)();
        assert.ok(script.includes('window.driftAdvisorAvailable'));
        assert.ok(script.includes('if (driftAdvisorAvail)'));
        assert.ok(script.includes('if (driftAvail)'));
    });
    test('multiple Drift buttons use querySelectorAll for click binding', () => {
        const script = (0, viewer_context_popover_script_1.getContextPopoverScript)();
        assert.ok(script.includes("querySelectorAll('.popover-drift-open')"));
    });
});
//# sourceMappingURL=viewer-context-popover-db-insight.test.js.map