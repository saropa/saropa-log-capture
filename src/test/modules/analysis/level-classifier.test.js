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
const config_normalizers_1 = require("../../../modules/config/config-normalizers");
suite('LevelClassifier', () => {
    suite('classifyLevel — stderr', () => {
        test('should classify stderr as error when stderrTreatAsError is true', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('anything', 'stderr', true, true), 'error');
        });
        test('should classify benign stderr by text when stderrTreatAsError is false', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('all good', 'stderr', true, false), 'info');
        });
        test('should honor Drift SQL on stderr when stderrTreatAsError is false', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('I/flutter (1): Drift: Sent SELECT 1', 'stderr', true, false), 'database');
        });
    });
    // Logcat prefix tests extracted to level-classifier-logcat.test.ts
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
        test('should detect failed keyword as warning', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Build failed', 'stdout', true), 'warning');
        });
        test('should detect failure keyword as warning', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Connection failure', 'stdout', true), 'warning');
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
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Slow operation: took 5000ms', 'stdout', true), 'performance');
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
        test('should classify TODO/FIXME/HACK/XXX', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('TODO: fix this', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('FIXME: broken', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('HACK: workaround', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('XXX: danger zone', 'stdout', true), 'todo');
        });
        test('should classify BUG/KLUDGE/WORKAROUND as todo', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('BUG: null ref in widget', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('KLUDGE: temporary fix', 'stdout', true), 'todo');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('WORKAROUND: upstream issue', 'stdout', true), 'todo');
        });
        test('should not match BUG inside DEBUG', () => {
            assert.strictEqual((0, level_classifier_1.classifyLevel)('DEBUG: variable value', 'stdout', true), 'debug');
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
    suite('classifyLevel — custom severity keywords', () => {
        teardown(() => {
            // Restore defaults after each test to avoid leaking state.
            (0, level_classifier_1.setSeverityKeywords)(config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS);
        });
        test('should classify custom error keyword', () => {
            (0, level_classifier_1.setSeverityKeywords)({
                ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS,
                error: [...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS.error, 'kaboom'],
            });
            assert.strictEqual((0, level_classifier_1.classifyLevel)('kaboom happened', 'stdout', true), 'error');
        });
        test('should move keyword between levels', () => {
            // Move "fatal" from error to warning
            (0, level_classifier_1.setSeverityKeywords)({
                ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS,
                error: ['panic', 'critical'],
                warning: [...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS.warning, 'fatal'],
            });
            assert.strictEqual((0, level_classifier_1.classifyLevel)('fatal crash', 'stdout', true), 'warning');
        });
        test('should handle empty keyword list', () => {
            (0, level_classifier_1.setSeverityKeywords)({ ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS, warning: [] });
            // "failed" was in warning keywords — with empty list, falls through to info
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Build failed', 'stdout', true), 'info');
        });
        test('should still match structural patterns regardless of keywords', () => {
            // Clear all error keywords — structural Error: should still match
            (0, level_classifier_1.setSeverityKeywords)({ ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS, error: [] });
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Error: something broke', 'stdout', true), 'error');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('[fatal] shutdown', 'stdout', true), 'error');
            assert.strictEqual((0, level_classifier_1.classifyLevel)('_TypeError (null)', 'stdout', true), 'error');
        });
        test('should match multi-word keyword phrases', () => {
            (0, level_classifier_1.setSeverityKeywords)({
                ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS,
                error: ['bad thing happened'],
            });
            assert.strictEqual((0, level_classifier_1.classifyLevel)('a bad thing happened here', 'stdout', true), 'error');
        });
        test('should allow user to restore failed/failure to error level', () => {
            // Before: "failed" was hardcoded error. After: default is warning.
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Build failed', 'stdout', true), 'warning');
            // User moves it back to error via config
            (0, level_classifier_1.setSeverityKeywords)({
                ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS,
                error: [...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS.error, 'failed', 'failure'],
                warning: ['warn', 'warning', 'caution'],
            });
            assert.strictEqual((0, level_classifier_1.classifyLevel)('Build failed', 'stdout', true), 'error');
        });
    });
    // Flutter emits rendering / widgets / scheduler / gesture / services exceptions
    // wrapped in a box-drawing banner: '════ Exception caught by <library> ════'.
    // The phrase has no colon or bracket, so without a dedicated pattern it falls
    // through to 'info' and the entire error block disappears under the
    // Errors/Warnings filter.
    suite('classifyLevel — Flutter exception banner', () => {
        test('should classify `Exception caught by rendering library` banner as error', () => {
            const banner = '════════ Exception caught by rendering library ═════════════════════════════════';
            assert.strictEqual((0, level_classifier_1.classifyLevel)(banner, 'stderr', true, false), 'error');
        });
        test('should classify banner as error in loose mode too', () => {
            const banner = '════════ Exception caught by widgets library ═════════════════════════════════';
            assert.strictEqual((0, level_classifier_1.classifyLevel)(banner, 'stderr', false, false), 'error');
        });
        test('should match all common Flutter banner variants', () => {
            const variants = [
                '════════ Exception caught by rendering library ═════════',
                '════════ Exception caught by widgets library ═════════',
                '════════ Exception caught by scheduler library ═════════',
                '════════ Exception caught by gesture system ═════════',
                '════════ Exception caught by services library ═════════',
                '════════ Exception caught by image resource service ═════════',
            ];
            for (const v of variants) {
                assert.strictEqual((0, level_classifier_1.classifyLevel)(v, 'stdout', true, false), 'error', `Failed for: ${v}`);
            }
        });
        test('should still classify banner as error when user cleared error keywords', () => {
            // Pattern is structural — not dependent on the user-configurable keyword list.
            (0, level_classifier_1.setSeverityKeywords)({ ...config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS, error: [] });
            const banner = '════════ Exception caught by rendering library ═════════';
            assert.strictEqual((0, level_classifier_1.classifyLevel)(banner, 'stdout', true, false), 'error');
        });
        test('should not false-trigger on "exception caught by" inside handler text', () => {
            // Reset to defaults first so the kwError test env is clean
            (0, level_classifier_1.setSeverityKeywords)(config_normalizers_1.DEFAULT_SEVERITY_KEYWORDS);
            // The pattern matches the phrase unconditionally — this IS an error by design.
            // Guard: make sure we didn't accidentally match unrelated phrases.
            assert.notStrictEqual((0, level_classifier_1.classifyLevel)('Exception handler registered successfully', 'stdout', true, false), 'error');
        });
    });
});
//# sourceMappingURL=level-classifier.test.js.map