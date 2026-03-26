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
const diff_engine_1 = require("../../../modules/misc/diff-engine");
suite('DiffEngine', () => {
    suite('findClosestByTimestamp', () => {
        test('should find exact timestamp match', () => {
            const target = new Date('2024-01-15T10:30:00Z');
            const lines = [
                { line: { index: 0, text: 'line 1', timestamp: new Date('2024-01-15T10:00:00Z') }, status: 'common' },
                { line: { index: 1, text: 'line 2', timestamp: new Date('2024-01-15T10:30:00Z') }, status: 'common' },
                { line: { index: 2, text: 'line 3', timestamp: new Date('2024-01-15T11:00:00Z') }, status: 'common' },
            ];
            const result = (0, diff_engine_1.findClosestByTimestamp)(target, lines);
            assert.strictEqual(result, 1);
        });
        test('should find closest timestamp when no exact match', () => {
            const target = new Date('2024-01-15T10:25:00Z');
            const lines = [
                { line: { index: 0, text: 'line 1', timestamp: new Date('2024-01-15T10:00:00Z') }, status: 'common' },
                { line: { index: 1, text: 'line 2', timestamp: new Date('2024-01-15T10:30:00Z') }, status: 'common' },
                { line: { index: 2, text: 'line 3', timestamp: new Date('2024-01-15T11:00:00Z') }, status: 'common' },
            ];
            const result = (0, diff_engine_1.findClosestByTimestamp)(target, lines);
            assert.strictEqual(result, 1); // 10:30 is closer to 10:25 than 10:00
        });
        test('should return 0 for empty lines', () => {
            const target = new Date('2024-01-15T10:00:00Z');
            const lines = [];
            const result = (0, diff_engine_1.findClosestByTimestamp)(target, lines);
            assert.strictEqual(result, 0);
        });
        test('should handle lines without timestamps', () => {
            const target = new Date('2024-01-15T10:30:00Z');
            const lines = [
                { line: { index: 0, text: 'line 1' }, status: 'common' },
                { line: { index: 1, text: 'line 2', timestamp: new Date('2024-01-15T10:30:00Z') }, status: 'common' },
                { line: { index: 2, text: 'line 3' }, status: 'common' },
            ];
            const result = (0, diff_engine_1.findClosestByTimestamp)(target, lines);
            assert.strictEqual(result, 1);
        });
    });
});
//# sourceMappingURL=diff-engine.test.js.map