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
const session_time_buckets_1 = require("../../../modules/viewer/session-time-buckets");
(0, node_test_1.describe)("session-time-buckets", () => {
    (0, node_test_1.it)("sessionTimeBucketCountForHeightPx matches minimap clamp", () => {
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketCountForHeightPx)(100), 50);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketCountForHeightPx)(120), 60);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketCountForHeightPx)(400), 180);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketCountForHeightPx)(40), 48);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketCountForHeightPx)(NaN), 48);
    });
    (0, node_test_1.it)("sessionTimeBucketIndex clamps to bucket range", () => {
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketIndex)(0, 0, 100, 10), 0);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketIndex)(100, 0, 100, 10), 9);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketIndex)(50, 0, 100, 10), 5);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketIndex)(-1, 0, 100, 10), 0);
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketIndex)(200, 0, 100, 10), 9);
    });
    (0, node_test_1.it)("sessionTimeBucketIndex treats tMin===tMax as span 1 (same as minimap legacy)", () => {
        // span = (tMax - tMin) || 1 → 1; ts=42 vs anchor 10 → proportion maps to last bucket for n=5.
        assert.strictEqual((0, session_time_buckets_1.sessionTimeBucketIndex)(42, 10, 10, 5), 4);
    });
});
//# sourceMappingURL=session-time-buckets.test.js.map