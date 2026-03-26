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
 * Drift Advisor → root-cause hint summary extraction.
 */
const assert = __importStar(require("node:assert"));
const drift_advisor_constants_1 = require("../../../modules/integrations/drift-advisor-constants");
const root_cause_hint_drift_meta_1 = require("../../../modules/root-cause-hints/root-cause-hint-drift-meta");
suite("root-cause-hint-drift-meta", () => {
    test("returns undefined when integrations missing or empty", () => {
        assert.strictEqual((0, root_cause_hint_drift_meta_1.rootCauseDriftSummaryFromSessionIntegrations)(undefined), undefined);
        assert.strictEqual((0, root_cause_hint_drift_meta_1.rootCauseDriftSummaryFromSessionIntegrations)(null), undefined);
        assert.strictEqual((0, root_cause_hint_drift_meta_1.rootCauseDriftSummaryFromSessionIntegrations)({}), undefined);
    });
    test("maps issuesSummary.count and top byCode rule", () => {
        const integrations = {
            [drift_advisor_constants_1.DRIFT_ADVISOR_META_KEY]: {
                issuesSummary: {
                    count: 5,
                    byCode: { rule_a: 2, rule_b: 3 },
                    bySeverity: { error: 1 },
                },
            },
        };
        const s = (0, root_cause_hint_drift_meta_1.rootCauseDriftSummaryFromSessionIntegrations)(integrations);
        assert.deepStrictEqual(s, { issueCount: 5, topRuleId: "rule_b" });
    });
    test("returns undefined when issue count is zero", () => {
        const integrations = {
            [drift_advisor_constants_1.DRIFT_ADVISOR_META_KEY]: {
                issuesSummary: { count: 0, byCode: { x: 1 } },
            },
        };
        assert.strictEqual((0, root_cause_hint_drift_meta_1.rootCauseDriftSummaryFromSessionIntegrations)(integrations), undefined);
    });
});
//# sourceMappingURL=root-cause-hint-drift-meta.test.js.map