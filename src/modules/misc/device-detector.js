"use strict";
/** Detect target device/emulator from debug session launch config and output. */
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
exports.detectDeviceFromConfig = detectDeviceFromConfig;
exports.detectDeviceFromOutput = detectDeviceFromOutput;
exports.detectTargetDevice = detectTargetDevice;
const vscode = __importStar(require("vscode"));
/** Config keys that commonly hold a device identifier. */
const deviceConfigKeys = ['deviceId', 'device', 'target', 'deviceName'];
/** Detect device identifier from launch configuration properties. */
function detectDeviceFromConfig(config) {
    for (const key of deviceConfigKeys) {
        const val = config[key];
        if (typeof val === 'string' && val.trim()) {
            return val.trim();
        }
    }
    return undefined;
}
/** Regex for Flutter's "Launching ... on DEVICE_NAME in MODE mode" output. */
const launchOnDeviceRe = /^Launching\s.+?\son\s(.+?)\sin\s(?:debug|profile|release)\smode/;
/** Parse device name from a Flutter launch output line. */
function detectDeviceFromOutput(text) {
    const m = launchOnDeviceRe.exec(text.trim());
    return m ? m[1].trim() : undefined;
}
const headerDeviceIdRe = /^deviceId:\s+(.+)/;
const maxScanLines = 40;
/** Scan a log file for target device info (launch config header + early output). */
async function detectTargetDevice(fileUri) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n', maxScanLines);
    for (const line of lines) {
        const trimmed = line.trim();
        const fromOutput = detectDeviceFromOutput(trimmed);
        if (fromOutput) {
            return fromOutput;
        }
        const headerMatch = headerDeviceIdRe.exec(trimmed);
        if (headerMatch) {
            return headerMatch[1].trim();
        }
    }
    return undefined;
}
//# sourceMappingURL=device-detector.js.map