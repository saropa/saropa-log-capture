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
const bug_report_thread_format_1 = require("../../../modules/bug-report/bug-report-thread-format");
function frame(text, isApp, threadName) {
    return { text, isApp, threadName };
}
suite('BugReportThreadFormat', () => {
    suite('groupFramesByThread', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual((0, bug_report_thread_format_1.groupFramesByThread)([]), []);
        });
        test('should group all frames into one group when no thread names', () => {
            const frames = [frame('at main()', true), frame('at lib()', false)];
            const groups = (0, bug_report_thread_format_1.groupFramesByThread)(frames);
            assert.strictEqual(groups.length, 1);
            assert.strictEqual(groups[0][0], undefined);
            assert.strictEqual(groups[0][1].length, 2);
        });
        test('should group consecutive frames by thread name', () => {
            const frames = [
                frame('at a()', true, 'main'),
                frame('at b()', false, 'main'),
                frame('at c()', true, 'worker'),
                frame('at d()', false, 'worker'),
            ];
            const groups = (0, bug_report_thread_format_1.groupFramesByThread)(frames);
            assert.strictEqual(groups.length, 2);
            assert.strictEqual(groups[0][0], 'main');
            assert.strictEqual(groups[0][1].length, 2);
            assert.strictEqual(groups[1][0], 'worker');
            assert.strictEqual(groups[1][1].length, 2);
        });
        test('should create new group when thread name changes', () => {
            const frames = [
                frame('at a()', true, 'main'),
                frame('at b()', true, 'worker'),
                frame('at c()', true, 'main'),
            ];
            const groups = (0, bug_report_thread_format_1.groupFramesByThread)(frames);
            assert.strictEqual(groups.length, 3);
        });
        test('should handle single frame', () => {
            const groups = (0, bug_report_thread_format_1.groupFramesByThread)([frame('at x()', true, 'main')]);
            assert.strictEqual(groups.length, 1);
            assert.strictEqual(groups[0][1].length, 1);
        });
    });
    suite('formatThreadGroupedLines', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual((0, bug_report_thread_format_1.formatThreadGroupedLines)([]), []);
        });
        test('should prefix app frames with >>> for single thread', () => {
            const frames = [frame('main()', true), frame('lib()', false)];
            const lines = (0, bug_report_thread_format_1.formatThreadGroupedLines)(frames);
            assert.strictEqual(lines[0], '>>> main()');
            assert.strictEqual(lines[1], '    lib()');
        });
        test('should add thread separators for multiple named threads', () => {
            const frames = [
                frame('a()', true, 'main'),
                frame('b()', false, 'worker'),
            ];
            const lines = (0, bug_report_thread_format_1.formatThreadGroupedLines)(frames);
            assert.ok(lines.some(l => l.includes('--- main ---')));
            assert.ok(lines.some(l => l.includes('--- worker ---')));
        });
        test('should not add thread separators when only one group', () => {
            const frames = [
                frame('a()', true, 'main'),
                frame('b()', false, 'main'),
            ];
            const lines = (0, bug_report_thread_format_1.formatThreadGroupedLines)(frames);
            assert.ok(!lines.some(l => l.startsWith('---')));
        });
        test('should not add separators when all thread names are undefined', () => {
            const frames = [
                frame('a()', true),
                frame('b()', false),
            ];
            const lines = (0, bug_report_thread_format_1.formatThreadGroupedLines)(frames);
            assert.ok(!lines.some(l => l.startsWith('---')));
            assert.strictEqual(lines.length, 2);
        });
        test('should use >>> for app frames and 4-space indent for framework', () => {
            const frames = [frame('app()', true), frame('fw()', false)];
            const lines = (0, bug_report_thread_format_1.formatThreadGroupedLines)(frames);
            assert.ok(lines[0].startsWith('>>> '));
            assert.ok(lines[1].startsWith('    '));
        });
    });
});
//# sourceMappingURL=bug-report-thread-format.test.js.map