import * as assert from 'assert';
import { detectDeviceFromConfig, detectDeviceFromOutput } from '../modules/device-detector';

suite('Device Detector', () => {

    test('should detect device from Flutter output line', () => {
        const result = detectDeviceFromOutput('Launching lib/main.dart on Pixel 6 Pro in debug mode...');
        assert.strictEqual(result, 'Pixel 6 Pro');
    });

    test('should detect device from profile mode output', () => {
        const result = detectDeviceFromOutput('Launching lib/main.dart on SM-S908U in profile mode...');
        assert.strictEqual(result, 'SM-S908U');
    });

    test('should detect device from release mode output', () => {
        const result = detectDeviceFromOutput('Launching lib/main.dart on iPhone 15 in release mode...');
        assert.strictEqual(result, 'iPhone 15');
    });

    test('should return undefined for non-matching output', () => {
        assert.strictEqual(detectDeviceFromOutput('hello world'), undefined);
        assert.strictEqual(detectDeviceFromOutput(''), undefined);
    });

    test('should detect deviceId from launch config', () => {
        assert.strictEqual(detectDeviceFromConfig({ deviceId: 'emulator-5554' }), 'emulator-5554');
    });

    test('should detect device key from launch config', () => {
        assert.strictEqual(detectDeviceFromConfig({ device: 'my-pixel' }), 'my-pixel');
    });

    test('should detect deviceName from launch config', () => {
        assert.strictEqual(detectDeviceFromConfig({ deviceName: 'Pixel 7' }), 'Pixel 7');
    });

    test('should prefer deviceId over device', () => {
        assert.strictEqual(detectDeviceFromConfig({ deviceId: 'id-1', device: 'dev-2' }), 'id-1');
    });

    test('should return undefined when no device keys present', () => {
        assert.strictEqual(detectDeviceFromConfig({ type: 'dart', name: 'test' }), undefined);
    });

    test('should skip empty string values', () => {
        assert.strictEqual(detectDeviceFromConfig({ deviceId: '', device: '  ' }), undefined);
    });
});
