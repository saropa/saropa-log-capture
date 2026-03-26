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
const assert = __importStar(require("assert"));
const error_rate_alert_1 = require("../../../modules/features/error-rate-alert");
suite('ErrorRateAlert', () => {
    test('should initialize with default config', () => {
        const alert = new error_rate_alert_1.ErrorRateAlert();
        assert.strictEqual(alert.getCurrentCount(), 0);
    });
    test('should track error count', () => {
        const alert = new error_rate_alert_1.ErrorRateAlert();
        alert.recordError();
        alert.recordError();
        alert.recordError();
        assert.strictEqual(alert.getCurrentCount(), 3);
    });
    test('should reset state', () => {
        const alert = new error_rate_alert_1.ErrorRateAlert();
        alert.recordError();
        alert.recordError();
        alert.reset();
        assert.strictEqual(alert.getCurrentCount(), 0);
    });
    test('should trigger alert when threshold exceeded', () => {
        let alertTriggered = false;
        const alert = new error_rate_alert_1.ErrorRateAlert({
            threshold: 3,
            windowMs: 10000,
            cooldownMs: 0,
        });
        alert.setAlertCallback(() => { alertTriggered = true; });
        alert.recordError();
        assert.strictEqual(alertTriggered, false);
        alert.recordError();
        assert.strictEqual(alertTriggered, false);
        alert.recordError(); // Reaches threshold
        assert.strictEqual(alertTriggered, true);
    });
    test('should respect cooldown period', () => {
        let alertCount = 0;
        const alert = new error_rate_alert_1.ErrorRateAlert({
            threshold: 1,
            windowMs: 10000,
            cooldownMs: 60000, // Long cooldown
        });
        alert.setAlertCallback(() => { alertCount++; });
        alert.recordError(); // First alert
        assert.strictEqual(alertCount, 1);
        alert.recordError(); // Should be in cooldown
        assert.strictEqual(alertCount, 1);
    });
    test('should track category breakdown', () => {
        const alert = new error_rate_alert_1.ErrorRateAlert();
        alert.recordError('error');
        alert.recordError('error');
        alert.recordError('warning');
        const breakdown = alert.getCategoryBreakdown();
        assert.strictEqual(breakdown['error'], 2);
        assert.strictEqual(breakdown['warning'], 1);
    });
    test('should be disabled when config.enabled is false', () => {
        let alertTriggered = false;
        const alert = new error_rate_alert_1.ErrorRateAlert({
            enabled: false,
            threshold: 1,
        });
        alert.setAlertCallback(() => { alertTriggered = true; });
        alert.recordError();
        assert.strictEqual(alertTriggered, false);
        assert.strictEqual(alert.getCurrentCount(), 0);
    });
    test('should calculate rate per minute', () => {
        const alert = new error_rate_alert_1.ErrorRateAlert({
            windowMs: 60000, // 1 minute window
        });
        alert.recordError();
        alert.recordError();
        alert.recordError();
        const rate = alert.getCurrentRate();
        assert.strictEqual(rate, 3); // 3 per minute
    });
});
suite('isErrorLine', () => {
    test('should detect stderr category as error', () => {
        assert.strictEqual((0, error_rate_alert_1.isErrorLine)('some text', 'stderr'), true);
    });
    test('should detect error keyword', () => {
        assert.strictEqual((0, error_rate_alert_1.isErrorLine)('An error occurred', 'stdout'), true);
    });
    test('should detect exception keyword', () => {
        assert.strictEqual((0, error_rate_alert_1.isErrorLine)('NullPointerException', 'stdout'), true);
    });
    test('should detect fatal keyword', () => {
        assert.strictEqual((0, error_rate_alert_1.isErrorLine)('FATAL: cannot continue', 'stdout'), true);
    });
    test('should detect failed keyword', () => {
        assert.strictEqual((0, error_rate_alert_1.isErrorLine)('Build failed', 'stdout'), true);
    });
    test('should not match regular text', () => {
        assert.strictEqual((0, error_rate_alert_1.isErrorLine)('Everything is fine', 'stdout'), false);
    });
});
suite('isWarningLine', () => {
    test('should detect warn keyword', () => {
        assert.strictEqual((0, error_rate_alert_1.isWarningLine)('Warning: deprecated API'), true);
    });
    test('should be case insensitive', () => {
        assert.strictEqual((0, error_rate_alert_1.isWarningLine)('WARN: something'), true);
    });
    test('should not match regular text', () => {
        assert.strictEqual((0, error_rate_alert_1.isWarningLine)('All good'), false);
    });
});
//# sourceMappingURL=error-rate-alert.test.js.map