"use strict";
/**
 * Drift Advisor includeInLogCaptureSession normalization (built-in + bridge alignment).
 */
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
const drift_advisor_include_level_1 = require("../../../modules/integrations/drift-advisor-include-level");
suite('DriftAdvisorIncludeSetting', () => {
    test('normalizeDriftIncludeInLogCaptureSession accepts known values', () => {
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)('none'), 'none');
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)('header'), 'header');
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)('full'), 'full');
    });
    test('normalizeDriftIncludeInLogCaptureSession defaults to full for unknown', () => {
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)(undefined), 'full');
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)(''), 'full');
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)('partial'), 'full');
        assert.strictEqual((0, drift_advisor_include_level_1.normalizeDriftIncludeInLogCaptureSession)(1), 'full');
    });
    test('driftBuiltinContributesMetaSidecar only for full', () => {
        assert.strictEqual((0, drift_advisor_include_level_1.driftBuiltinContributesMetaSidecar)('none'), false);
        assert.strictEqual((0, drift_advisor_include_level_1.driftBuiltinContributesMetaSidecar)('header'), false);
        assert.strictEqual((0, drift_advisor_include_level_1.driftBuiltinContributesMetaSidecar)('full'), true);
    });
});
//# sourceMappingURL=drift-advisor-include-setting.test.js.map