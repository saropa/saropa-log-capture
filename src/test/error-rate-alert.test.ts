import * as assert from 'assert';
import { ErrorRateAlert, isErrorLine, isWarningLine } from '../modules/error-rate-alert';

suite('ErrorRateAlert', () => {

    test('should initialize with default config', () => {
        const alert = new ErrorRateAlert();
        assert.strictEqual(alert.getCurrentCount(), 0);
    });

    test('should track error count', () => {
        const alert = new ErrorRateAlert();
        alert.recordError();
        alert.recordError();
        alert.recordError();
        assert.strictEqual(alert.getCurrentCount(), 3);
    });

    test('should reset state', () => {
        const alert = new ErrorRateAlert();
        alert.recordError();
        alert.recordError();
        alert.reset();
        assert.strictEqual(alert.getCurrentCount(), 0);
    });

    test('should trigger alert when threshold exceeded', () => {
        let alertTriggered = false;
        const alert = new ErrorRateAlert({
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
        const alert = new ErrorRateAlert({
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
        const alert = new ErrorRateAlert();
        alert.recordError('error');
        alert.recordError('error');
        alert.recordError('warning');

        const breakdown = alert.getCategoryBreakdown();
        assert.strictEqual(breakdown['error'], 2);
        assert.strictEqual(breakdown['warning'], 1);
    });

    test('should be disabled when config.enabled is false', () => {
        let alertTriggered = false;
        const alert = new ErrorRateAlert({
            enabled: false,
            threshold: 1,
        });
        alert.setAlertCallback(() => { alertTriggered = true; });

        alert.recordError();
        assert.strictEqual(alertTriggered, false);
        assert.strictEqual(alert.getCurrentCount(), 0);
    });

    test('should calculate rate per minute', () => {
        const alert = new ErrorRateAlert({
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
        assert.strictEqual(isErrorLine('some text', 'stderr'), true);
    });

    test('should detect error keyword', () => {
        assert.strictEqual(isErrorLine('An error occurred', 'stdout'), true);
    });

    test('should detect exception keyword', () => {
        assert.strictEqual(isErrorLine('NullPointerException', 'stdout'), true);
    });

    test('should detect fatal keyword', () => {
        assert.strictEqual(isErrorLine('FATAL: cannot continue', 'stdout'), true);
    });

    test('should detect failed keyword', () => {
        assert.strictEqual(isErrorLine('Build failed', 'stdout'), true);
    });

    test('should not match regular text', () => {
        assert.strictEqual(isErrorLine('Everything is fine', 'stdout'), false);
    });
});

suite('isWarningLine', () => {

    test('should detect warn keyword', () => {
        assert.strictEqual(isWarningLine('Warning: deprecated API'), true);
    });

    test('should be case insensitive', () => {
        assert.strictEqual(isWarningLine('WARN: something'), true);
    });

    test('should not match regular text', () => {
        assert.strictEqual(isWarningLine('All good'), false);
    });
});
