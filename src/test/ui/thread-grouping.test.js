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
const viewer_thread_grouping_1 = require("../../ui/viewer/viewer-thread-grouping");
function makeLine(text, isMarker = false) {
    return { text, isMarker, lineCount: 1, category: 'stdout', timestamp: 0 };
}
suite('Thread Dump Grouping', () => {
    test('should pass non-thread lines through unchanged', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('hello world'), 'hello world', pending);
        assert.strictEqual(pending.length, 1);
        assert.strictEqual(pending[0].text, 'hello world');
    });
    test('should group multi-thread dump with summary', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t2'), '"Signal Catcher" tid=3 Waiting', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('f2'), '    at java.lang.Object.wait(Native Method)', pending);
        // Non-thread line triggers flush
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('normal line'), 'normal line', pending);
        // Summary marker + 2 headers + 2 frames + the normal line = 6
        assert.strictEqual(pending.length, 6);
        assert.ok(pending[0].isMarker, 'first line should be summary marker');
        assert.ok(pending[0].text.includes('2 threads'), 'summary should mention thread count');
        assert.strictEqual(pending[5].text, 'normal line');
    });
    test('should emit single thread without summary', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('end'), 'end of thread', pending);
        // 1 header + 1 frame + 1 normal line = 3 (no summary for single thread)
        assert.strictEqual(pending.length, 3);
        assert.ok(!pending[0].isMarker, 'single thread should not have summary marker');
    });
    test('flushThreadDump should emit buffered lines', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t2'), '--- worker ---', pending);
        assert.strictEqual(pending.length, 0, 'should be buffered');
        (0, viewer_thread_grouping_1.flushThreadDump)(state, pending);
        assert.strictEqual(pending.length, 3, 'summary + 2 headers');
        assert.ok(pending[0].isMarker);
    });
    test('markers should flush buffered dump', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t2'), '"worker" tid=2 Waiting', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('marker', true), '--- MARKER ---', pending);
        // Flushed: summary + 2 headers + marker = 4
        assert.strictEqual(pending.length, 4);
        assert.ok(pending[0].isMarker, 'first should be summary');
        assert.ok(pending[3].isMarker, 'last should be the original marker');
    });
    test('should detect ANR pattern: main Runnable + worker Waiting', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t2'), '"AsyncTask #1" tid=12 Waiting', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('f2'), '    at java.lang.Object.wait(Native Method)', pending);
        (0, viewer_thread_grouping_1.flushThreadDump)(state, pending);
        assert.ok(pending[0].text.includes('ANR pattern detected'), 'summary should flag ANR');
        assert.ok(pending[3].text.includes('\u26a0'), 'blocking thread should have warning badge');
    });
    test('should not flag ANR when all threads are Waiting', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Waiting', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t2'), '"worker" tid=2 Waiting', pending);
        (0, viewer_thread_grouping_1.flushThreadDump)(state, pending);
        assert.ok(!pending[0].text.includes('ANR'), 'no ANR when main is not Runnable');
    });
    test('should not flag ANR for single thread dump', () => {
        const state = (0, viewer_thread_grouping_1.createThreadDumpState)();
        const pending = [];
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('t1'), '"main" tid=1 Runnable', pending);
        (0, viewer_thread_grouping_1.processLineForThreadDump)(state, makeLine('f1'), '    at com.example.Main.run(Main.java:10)', pending);
        (0, viewer_thread_grouping_1.flushThreadDump)(state, pending);
        // Single thread — no summary, no ANR analysis
        assert.strictEqual(pending.length, 2);
        assert.ok(!pending[0].isMarker);
    });
});
//# sourceMappingURL=thread-grouping.test.js.map