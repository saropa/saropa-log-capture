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
 * Unit tests for integration-context popover empty-state gating (database line escape hatch).
 */
const assert = __importStar(require("assert"));
const context_handlers_1 = require("../../ui/shared/handlers/context-handlers");
suite('context-handlers integration popover gate', () => {
    test('posts noIntegrationData only when window data, Drift meta, and DB line are all absent', () => {
        assert.strictEqual((0, context_handlers_1.shouldPostNoIntegrationDataError)({
            hasContextWindowData: false,
            hasDriftAdvisorIntegrationMeta: false,
            hasDatabaseLine: false,
        }), true);
    });
    test('does not post error when line is database-tagged (before: would wrongly require window data)', () => {
        assert.strictEqual((0, context_handlers_1.shouldPostNoIntegrationDataError)({
            hasContextWindowData: false,
            hasDriftAdvisorIntegrationMeta: false,
            hasDatabaseLine: true,
        }), false);
    });
    test('does not post error when Drift Advisor session meta exists', () => {
        assert.strictEqual((0, context_handlers_1.shouldPostNoIntegrationDataError)({
            hasContextWindowData: false,
            hasDriftAdvisorIntegrationMeta: true,
            hasDatabaseLine: false,
        }), false);
    });
    test('does not post error when context window has any integration data', () => {
        assert.strictEqual((0, context_handlers_1.shouldPostNoIntegrationDataError)({
            hasContextWindowData: true,
            hasDriftAdvisorIntegrationMeta: false,
            hasDatabaseLine: false,
        }), false);
    });
    test('does not post error when security meta exists', () => {
        assert.strictEqual((0, context_handlers_1.shouldPostNoIntegrationDataError)({
            hasContextWindowData: false,
            hasDriftAdvisorIntegrationMeta: false,
            hasDatabaseLine: false,
            hasSecurityMeta: true,
        }), false);
    });
    test('does not post error when all three signals are present (after: non-empty popover)', () => {
        assert.strictEqual((0, context_handlers_1.shouldPostNoIntegrationDataError)({
            hasContextWindowData: true,
            hasDriftAdvisorIntegrationMeta: true,
            hasDatabaseLine: true,
        }), false);
    });
});
//# sourceMappingURL=context-handlers-integration-popover-gate.test.js.map