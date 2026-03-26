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
const vm = __importStar(require("node:vm"));
const node_test_1 = __importDefault(require("node:test"));
const db_detector_framework_1 = require("../../../modules/db/db-detector-framework");
const viewer_db_detector_framework_script_1 = require("../../../ui/viewer/viewer-db-detector-framework-script");
/** Snapshot merge output for parity checks (embed returns VM plain objects; avoid deepStrictEqual quirks). */
function mergeResultSummary(results) {
    return results.map((r) => ({
        detectorId: typeof r.detectorId === "string" ? r.detectorId : "",
        stableKey: typeof r.stableKey === "string" ? r.stableKey : "",
        priority: typeof r.priority === "number" && Number.isFinite(r.priority) ? r.priority : 0,
    }));
}
function assertMergeParity(a, b) {
    assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
}
/** Loads the webview embed chunk so `mergeDbDetectorResultsByStableKey` matches production JS (plan DB_15 drift guard). */
function loadEmbedMerge() {
    const code = (0, viewer_db_detector_framework_script_1.getViewerDbDetectorFrameworkScript)(true);
    const ctx = vm.createContext({ console });
    vm.runInContext(code, ctx, { filename: "db-detector-framework-embed-merge-parity.js", timeout: 10_000 });
    const fn = ctx.mergeDbDetectorResultsByStableKey;
    if (typeof fn !== "function") {
        throw new TypeError("embed missing mergeDbDetectorResultsByStableKey");
    }
    return fn;
}
(0, node_test_1.default)("mergeDbDetectorResultsByStableKey: higher-priority result wins same stableKey", () => {
    const low = {
        kind: "synthetic-line",
        detectorId: "a",
        stableKey: "k1",
        priority: 0,
        payload: { syntheticType: "n-plus-one-insight" },
    };
    const high = {
        kind: "synthetic-line",
        detectorId: "b",
        stableKey: "k1",
        priority: 10,
        payload: { syntheticType: "n-plus-one-insight" },
    };
    const merged = (0, db_detector_framework_1.mergeDbDetectorResultsByStableKey)([low, high]);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].detectorId, "b");
});
(0, node_test_1.default)("mergeDbDetectorResultsByStableKey: embed matches TypeScript (DB_15 drift guard)", () => {
    const embedMerge = loadEmbedMerge();
    const low = {
        kind: "synthetic-line",
        detectorId: "a",
        stableKey: "k1",
        priority: 0,
        payload: {},
    };
    const high = {
        kind: "synthetic-line",
        detectorId: "b",
        stableKey: "k1",
        priority: 10,
        payload: {},
    };
    const tsOut = mergeResultSummary((0, db_detector_framework_1.mergeDbDetectorResultsByStableKey)([low, high]));
    const embedOut = mergeResultSummary(embedMerge([low, high]));
    assertMergeParity(embedOut, tsOut);
    const a = {
        kind: "marker",
        detectorId: "m1",
        stableKey: "ka",
        priority: 1,
        payload: {},
    };
    const b = {
        kind: "marker",
        detectorId: "m2",
        stableKey: "kb",
        priority: 2,
        payload: {},
    };
    const ts2 = mergeResultSummary((0, db_detector_framework_1.mergeDbDetectorResultsByStableKey)([a, b]));
    const embed2 = mergeResultSummary(embedMerge([a, b]));
    assertMergeParity(embed2, ts2);
    // Same priority + same key: last array element wins in both implementations.
    const tie1 = {
        kind: "synthetic-line",
        detectorId: "first",
        stableKey: "tie",
        priority: 5,
        payload: {},
    };
    const tie2 = {
        kind: "synthetic-line",
        detectorId: "second",
        stableKey: "tie",
        priority: 5,
        payload: {},
    };
    const ts3 = mergeResultSummary((0, db_detector_framework_1.mergeDbDetectorResultsByStableKey)([tie1, tie2]));
    const embed3 = mergeResultSummary(embedMerge([tie1, tie2]));
    assertMergeParity(embed3, ts3);
    assert.strictEqual(ts3[0]?.detectorId, "second");
    // Skips falsy stableKey (embed uses truthy check).
    const emptyKey = { ...low, stableKey: "" };
    const ts4 = mergeResultSummary((0, db_detector_framework_1.mergeDbDetectorResultsByStableKey)([emptyKey]));
    const embed4 = mergeResultSummary(embedMerge([emptyKey]));
    assertMergeParity(embed4, ts4);
    assert.strictEqual(ts4.length, 0);
});
//# sourceMappingURL=db-detector-framework-merge.test.js.map