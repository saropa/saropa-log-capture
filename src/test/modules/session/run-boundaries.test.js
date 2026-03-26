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
const run_boundaries_1 = require("../../../modules/session/run-boundaries");
suite('run-boundaries', () => {
    test('detects Launching line', () => {
        const lines = ['[12:00:00] [stdout] Launching lib\\main.dart on sdk gphone64 x86 64 in debug mode...'];
        const b = (0, run_boundaries_1.detectRunBoundaries)(lines);
        assert.strictEqual(b.length, 1);
        assert.strictEqual(b[0].lineIndex, 0);
        assert.strictEqual(b[0].kind, 'launch');
        assert.strictEqual(b[0].label, 'Launch');
    });
    test('normal startup (Launching then Built) yields single run start', () => {
        const lines = [
            'Launching lib\\main.dart on sdk gphone64 x86 64 in debug mode...',
            '✓ Built build\\app\\outputs\\flutter-apk\\app-debug.apk',
            'FlutterJNI loaded.',
        ];
        const b = (0, run_boundaries_1.detectRunBoundaries)(lines);
        const starts = (0, run_boundaries_1.getRunStartIndices)(b);
        assert.strictEqual(starts.length, 1);
        assert.strictEqual(starts[0], 0);
    });
    test('detects Exited only (VM connect/Connected are mid-startup, not run starts)', () => {
        const lines = [
            'Connecting to VM Service at ws://127.0.0.1:64773/ws',
            'Connected to the VM Service.',
            'Application finished.',
            'Exited (-1).',
        ];
        const b = (0, run_boundaries_1.detectRunBoundaries)(lines);
        assert.strictEqual(b.length, 2);
        assert.strictEqual(b[0].kind, 'exited');
        assert.strictEqual(b[1].kind, 'exited');
    });
    test('detects hot restart and hot reload', () => {
        const lines = [
            'Performing hot restart...',
            'Hot reload done.',
        ];
        const b = (0, run_boundaries_1.detectRunBoundaries)(lines);
        assert.strictEqual(b.length, 2);
        assert.strictEqual(b[0].kind, 'hot_restart');
        assert.strictEqual(b[1].kind, 'hot_reload');
    });
    test('getRunStartIndices excludes exited', () => {
        const boundaries = [
            { lineIndex: 0, label: 'Launch', kind: 'launch' },
            { lineIndex: 5, label: 'Exited', kind: 'exited' },
            { lineIndex: 10, label: 'Launch', kind: 'launch' },
        ];
        const indices = (0, run_boundaries_1.getRunStartIndices)(boundaries);
        assert.deepStrictEqual(indices, [0, 10]);
    });
    test('line matching both start and end is classified as start only', () => {
        const lines = ['Launching app in debug mode'];
        const b = (0, run_boundaries_1.detectRunBoundaries)(lines);
        assert.strictEqual(b.length, 1);
        assert.strictEqual(b[0].kind, 'launch');
    });
    test('returns empty for no matches', () => {
        const lines = ['Some random log line', 'Another line'];
        const b = (0, run_boundaries_1.detectRunBoundaries)(lines);
        assert.strictEqual(b.length, 0);
    });
});
//# sourceMappingURL=run-boundaries.test.js.map