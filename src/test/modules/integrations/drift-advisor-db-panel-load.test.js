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
const node_test_1 = require("node:test");
const drift_advisor_db_panel_payload_1 = require("../../../modules/integrations/drift-advisor-db-panel-payload");
(0, node_test_1.describe)("mergeDriftAdvisorDbPanelPayload", () => {
    (0, node_test_1.it)("returns null when both absent", () => {
        assert.strictEqual((0, drift_advisor_db_panel_payload_1.mergeDriftAdvisorDbPanelPayload)(undefined, null), null);
    });
    (0, node_test_1.it)("meta alone is returned", () => {
        const m = (0, drift_advisor_db_panel_payload_1.mergeDriftAdvisorDbPanelPayload)({ performance: { totalQueries: 3 } }, null);
        assert.strictEqual(m.performance.totalQueries, 3);
    });
    (0, node_test_1.it)("sidecar fills performance when meta omits it", () => {
        const m = (0, drift_advisor_db_panel_payload_1.mergeDriftAdvisorDbPanelPayload)({ baseUrl: "http://x" }, { performance: { slowCount: 2 }, baseUrl: "ignored" });
        assert.strictEqual(m.baseUrl, "http://x");
        assert.strictEqual(m.performance.slowCount, 2);
    });
});
//# sourceMappingURL=drift-advisor-db-panel-load.test.js.map