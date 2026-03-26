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
const level_classifier_1 = require("../../../modules/analysis/level-classifier");
suite('LevelClassifier', () => {
    suite('classifyLevel — stderr', () => {
        test('should classify stderr category as error', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('anything', 'stderr', true), 'error');
        });
        test('should classify stderr even for benign text', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('all good', 'stderr', true), 'error');
        });
    });
    suite('classifyLevel — logcat prefixes', () => {
        test('should classify E/ as error', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('E/MediaCodec: error', 'stdout', true), 'error');
        });
        test('should classify F/ as error', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('F/System: fatal crash', 'stdout', true), 'error');
        });
        test('should classify A/ as error', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('A/libc: assertion failed', 'stdout', true), 'error');
        });
        test('should classify W/ as warning', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('W/InputManager: slow event', 'stdout', true), 'warning');
        });
        test('should classify V/ as debug', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('V/Verbose: trace info', 'stdout', true), 'debug');
        });
        test('should classify D/ as debug', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('D/Debug: step through', 'stdout', true), 'debug');
        });
        test('should classify I/ with performance keyword as performance', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/Choreographer: Skipped 30 frames', 'stdout', true), 'performance');
        });
        test('should classify I/ with TODO as todo', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/App: TODO fix this', 'stdout', true), 'todo');
        });
        test('should classify I/ plain text as info', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/App: started', 'stdout', true), 'info');
        });
        test('should classify I/flutter Drift SQL statements as info even with "ApplicationLogError" in args', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter (5475): Drift: Sent DELETE FROM "activities" WHERE "activity_type_name" IN (?, ?, ?, ?, ?) with args [ApplicationLogTodo, ApplicationLogBreadcrumb, ApplicationLogInfo, ApplicationLogWarning, ApplicationLogError]', 'stdout', true), 'info');
        });
    });
    suite('classifyLevel — strict mode', () => {
        test('should detect error with colon suffix', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Error: something broke', 'stdout', true), 'error');
        });
        test('should detect exception with colon suffix', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('NullPointerException: null', 'stdout', true), 'error');
        });
        test('should detect [error] bracket pattern', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('[error] bad input', 'stdout', true), 'error');
        });
        test('should detect [fatal] bracket pattern', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('[fatal] shutdown', 'stdout', true), 'error');
        });
        test('should detect failed keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Build failed', 'stdout', true), 'error');
        });
        test('should detect failure keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Connection failure', 'stdout', true), 'error');
        });
        test('should detect panic keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('panic: runtime error', 'stdout', true), 'error');
        });
        test('should not classify bare "error" as error in strict mode', () => {
            // In strict mode, bare "error" without structural context should not match
            assert.notStrictEqual((0, level_classifier_1.classifyLevel)('log error handling', 'stdout', true), 'error');
        });
    });
    suite('classifyLevel — loose mode', () => {
        test('should detect bare "error" keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('an error happened', 'stdout', false), 'error');
        });
        test('should detect bare "exception" keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('unhandled exception', 'stdout', false), 'error');
        });
        test('should not match "error" followed by handler-like words', () => {
            // loose mode excludes "error handler", "error handling", etc.
            assert.notStrictEqual((0, level_classifier_1.classifyLevel)('error handler active', 'stdout', false), 'error');
        });
    });
    suite('classifyLevel — non-error levels', () => {
        test('should classify warning keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('warning: deprecated API', 'stdout', true), 'warning');
        });
        test('should classify warn keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('WARN: slow query', 'stdout', true), 'warning');
        });
        test('should classify caution keyword', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('caution: memory low', 'stdout', true), 'warning');
        });
        test('should classify performance keywords', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('fps dropped to 15', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('jank detected', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('GC pause 200ms', 'stdout', true), 'performance');
        });
        test('should classify Flutter/Dart memory lines as performance only with Flutter/Dart context', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('memory pressure warning', 'stdout', true), 'info');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter (123): memory pressure warning', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter: Memory: 120 MB', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('D/dart: old gen 80%', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter: retained 1024 bytes', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('potential leak in Widget', 'stdout', true), 'info');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter: potential leak in Widget', 'stdout', true), 'performance');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('at package:flutter/src/widgets.dart:123: memory usage high', 'stdout', true), 'performance');
        });
        test('should classify TODO/FIXME/HACK', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('TODO: fix this', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('FIXME: broken', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('HACK: workaround', 'stdout', true), 'todo');
        });
        test('should classify debug/trace', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('debug: variable value', 'stdout', true), 'debug');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('trace: entering function', 'stdout', true), 'debug');
        });
        test('should classify notice/important', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('notice: update available', 'stdout', true), 'notice');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('important: read this', 'stdout', true), 'notice');
        });
        test('should default to info for unclassified text', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('hello world', 'stdout', true), 'info');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('starting server on port 3000', 'stdout', true), 'info');
        });
    });
    suite('classifyLevel — edge cases', () => {
        test('should handle empty string', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('', 'stdout', true), 'info');
        });
        test('should handle empty category', () => {
            const result = (0, level_classifier_1.classifyLevel)('error: test', '', true);
            // Empty category is not stderr, so should classify by text
            assert.strictEqual(result, 'error');
        });
        test('should be case-insensitive for keywords', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('WARNING: test', 'stdout', true), 'warning');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Warning: test', 'stdout', true), 'warning');
        });
    });
    suite('classifyLevel — Dart/Flutter errors', () => {
        test('should detect _TypeError (Dart internal error)', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('[log] _TypeError (Null check operator used on a null value)', 'stdout', true), 'error');
        });
        test('should detect _RangeError (Dart internal error)', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('_RangeError (Invalid value)', 'stdout', true), 'error');
        });
        test('should detect _FormatException (Dart internal error)', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('_FormatException (Unexpected character)', 'stdout', true), 'error');
        });
        test('should detect "Null check operator" message', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('[log] Null check operator used on a null value', 'stdout', true), 'error');
        });
        test('should detect I/flutter with _TypeError as error', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter (10946): _TypeError (Null check operator used on a null value)', 'stdout', true), 'error');
        });
        test('should detect I/flutter with Null check operator as error', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter (10946): Potential Null Check Operator Error Detected: Null check operator used on a null value', 'stdout', true), 'error');
        });
    });
    suite('isActionableLevel', () => {
        test('should return true for error', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('error'), true);
        });
        test('should return true for warning', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('warning'), true);
        });
        test('should return true for performance', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('performance'), true);
        });
        test('should return true for todo', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('todo'), true);
        });
        test('should return false for info', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('info'), false);
        });
        test('should return false for debug', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('debug'), false);
        });
        test('should return false for notice', () => {
            assert.strictEqual((0, level_classifier_1.isActionableLevel)('notice'), false);
        });
    });
});
//# sourceMappingURL=level-classifier.test.js.map