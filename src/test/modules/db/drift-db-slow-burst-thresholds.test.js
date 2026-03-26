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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const node_test_1 = __importDefault(require("node:test"));
const drift_db_slow_burst_thresholds_1 = require("../../../modules/db/drift-db-slow-burst-thresholds");
(0, node_test_1.default)("normalizeViewerSlowBurstThresholds clamps and floors integers", () => {
    const n = (0, drift_db_slow_burst_thresholds_1.normalizeViewerSlowBurstThresholds)({
        slowQueryMs: 0.9,
        burstMinCount: 1.2,
        burstWindowMs: 50,
        cooldownMs: 9999999,
    });
    assert.strictEqual(n.slowQueryMs, 1);
    assert.strictEqual(n.burstMinCount, 2);
    assert.strictEqual(n.burstWindowMs, 100);
    assert.strictEqual(n.cooldownMs, 300_000);
});
(0, node_test_1.default)("normalizeViewerSlowBurstThresholds uses defaults for garbage", () => {
    const n = (0, drift_db_slow_burst_thresholds_1.normalizeViewerSlowBurstThresholds)({
        slowQueryMs: NaN,
        burstMinCount: Number.POSITIVE_INFINITY,
    });
    assert.strictEqual(n.slowQueryMs, drift_db_slow_burst_thresholds_1.VIEWER_SLOW_BURST_DEFAULTS.slowQueryMs);
    assert.strictEqual(n.burstMinCount, drift_db_slow_burst_thresholds_1.VIEWER_SLOW_BURST_DEFAULTS.burstMinCount);
});
//# sourceMappingURL=drift-db-slow-burst-thresholds.test.js.map