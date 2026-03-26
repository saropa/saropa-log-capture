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
const session_manager_events_1 = require("../../../modules/session/session-manager-events");
const flood_guard_1 = require("../../../modules/capture/flood-guard");
const exclusion_matcher_1 = require("../../../modules/features/exclusion-matcher");
/** Minimal mock LogSession for testing appendLine and lineCount. */
function mockSession() {
    const lines = [];
    return {
        lines,
        lineCount: 0,
        state: 'recording',
        appendLine(text) { lines.push(text); this.lineCount++; },
    };
}
/** Build deps with sensible defaults. */
function makeDeps(overrides) {
    return {
        config: { enabled: true },
        exclusionRules: [],
        floodGuard: new flood_guard_1.FloodGuard(),
        ...overrides,
    };
}
/** Build target that collects broadcast calls. */
function makeTarget() {
    const broadcasts = [];
    return {
        broadcasts,
        counters: { categoryCounts: {}, floodSuppressedTotal: 0 },
        broadcastLine: (data) => { broadcasts.push(data); },
    };
}
/** Build a WriteLineInput from simple args. */
function input(session, text, category = 'console', timestamp = new Date()) {
    return { session: session, text, category, timestamp };
}
suite('processApiWriteLine', () => {
    test('should write a single line and broadcast it', () => {
        const session = mockSession();
        const target = makeTarget();
        const now = new Date();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'hello world', 'console', now));
        assert.strictEqual(session.lines.length, 1);
        assert.strictEqual(session.lines[0], 'hello world');
        assert.strictEqual(target.broadcasts.length, 1);
        assert.strictEqual(target.broadcasts[0].text, 'hello world');
        assert.strictEqual(target.broadcasts[0].category, 'console');
        assert.strictEqual(target.broadcasts[0].isMarker, false);
    });
    test('should split multi-line text into separate lines', () => {
        const session = mockSession();
        const target = makeTarget();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'line1\nline2\nline3'));
        assert.strictEqual(session.lines.length, 3);
        assert.strictEqual(target.broadcasts.length, 3);
        assert.strictEqual(target.broadcasts[0].text, 'line1');
        assert.strictEqual(target.broadcasts[1].text, 'line2');
        assert.strictEqual(target.broadcasts[2].text, 'line3');
    });
    test('should strip trailing newline before splitting', () => {
        const session = mockSession();
        const target = makeTarget();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'hello\n'));
        assert.strictEqual(session.lines.length, 1);
        assert.strictEqual(session.lines[0], 'hello');
    });
    test('should handle Windows \\r\\n line endings without leaking \\r', () => {
        const session = mockSession();
        const target = makeTarget();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'line1\r\nline2\r\nline3\r\n'));
        assert.strictEqual(session.lines.length, 3);
        assert.strictEqual(session.lines[0], 'line1');
        assert.strictEqual(session.lines[1], 'line2');
        assert.strictEqual(session.lines[2], 'line3');
    });
    test('should allow empty strings (blank lines)', () => {
        const session = mockSession();
        const target = makeTarget();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, ''));
        assert.strictEqual(session.lines.length, 1);
        assert.strictEqual(session.lines[0], '');
        assert.strictEqual(target.broadcasts.length, 1);
    });
    test('should apply exclusion rules', () => {
        const session = mockSession();
        const target = makeTarget();
        const rule = (0, exclusion_matcher_1.parseExclusionPattern)('secret');
        assert.ok(rule, 'parseExclusionPattern should return a rule');
        const deps = makeDeps({ exclusionRules: [rule] });
        (0, session_manager_events_1.processApiWriteLine)(deps, target, input(session, 'secret data'));
        assert.strictEqual(session.lines.length, 0);
        assert.strictEqual(target.broadcasts.length, 0);
    });
    test('should no-op when capture is disabled', () => {
        const session = mockSession();
        const target = makeTarget();
        const deps = makeDeps({ config: { enabled: false } });
        (0, session_manager_events_1.processApiWriteLine)(deps, target, input(session, 'hello'));
        assert.strictEqual(session.lines.length, 0);
        assert.strictEqual(target.broadcasts.length, 0);
    });
    test('should use custom category in broadcast', () => {
        const session = mockSession();
        const target = makeTarget();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'query result', 'drift-perf'));
        assert.strictEqual(target.broadcasts[0].category, 'drift-perf');
        assert.strictEqual(target.counters.categoryCounts['drift-perf'], 1);
    });
    test('should use provided timestamp in broadcast', () => {
        const session = mockSession();
        const target = makeTarget();
        const past = new Date('2025-01-01T00:00:00Z');
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'old event', 'console', past));
        assert.strictEqual(target.broadcasts[0].timestamp, past);
    });
    test('should not filter by category whitelist', () => {
        const session = mockSession();
        const target = makeTarget();
        (0, session_manager_events_1.processApiWriteLine)(makeDeps(), target, input(session, 'test', 'custom-cat'));
        assert.strictEqual(session.lines.length, 1);
    });
});
//# sourceMappingURL=api-write-line.test.js.map