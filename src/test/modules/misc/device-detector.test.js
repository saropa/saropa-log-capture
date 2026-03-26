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
const device_detector_1 = require("../../../modules/misc/device-detector");
suite('Device Detector', () => {
    test('should detect device from Flutter output line', () => {
        const result = (0, device_detector_1.detectDeviceFromOutput)('Launching lib/main.dart on Pixel 6 Pro in debug mode...');
        assert.strictEqual(result, 'Pixel 6 Pro');
    });
    test('should detect device from profile mode output', () => {
        const result = (0, device_detector_1.detectDeviceFromOutput)('Launching lib/main.dart on SM-S908U in profile mode...');
        assert.strictEqual(result, 'SM-S908U');
    });
    test('should detect device from release mode output', () => {
        const result = (0, device_detector_1.detectDeviceFromOutput)('Launching lib/main.dart on iPhone 15 in release mode...');
        assert.strictEqual(result, 'iPhone 15');
    });
    test('should return undefined for non-matching output', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromOutput)('hello world'), undefined);
        assert.strictEqual((0, device_detector_1.detectDeviceFromOutput)(''), undefined);
    });
    test('should detect deviceId from launch config', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromConfig)({ deviceId: 'emulator-5554' }), 'emulator-5554');
    });
    test('should detect device key from launch config', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromConfig)({ device: 'my-pixel' }), 'my-pixel');
    });
    test('should detect deviceName from launch config', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromConfig)({ deviceName: 'Pixel 7' }), 'Pixel 7');
    });
    test('should prefer deviceId over device', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromConfig)({ deviceId: 'id-1', device: 'dev-2' }), 'id-1');
    });
    test('should return undefined when no device keys present', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromConfig)({ type: 'dart', name: 'test' }), undefined);
    });
    test('should skip empty string values', () => {
        assert.strictEqual((0, device_detector_1.detectDeviceFromConfig)({ deviceId: '', device: '  ' }), undefined);
    });
});
//# sourceMappingURL=device-detector.test.js.map