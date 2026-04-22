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
const drift_debug_server_log_parse_1 = require("../../../modules/db/drift-debug-server-log-parse");
suite('drift-debug-server-log-parse', () => {
    test('extractDriftViewerHttpUrl finds URL inside ASCII box line', () => {
        const line = '      │              http://127.0.0.1:8642               │';
        assert.strictEqual((0, drift_debug_server_log_parse_1.extractDriftViewerHttpUrl)(line), 'http://127.0.0.1:8642');
    });
    // Drift v3.3.3 wraps the URL in rounded-corner frames; earlier stripping
    // hand-picked a subset and missed ╭╮╰╯, so the URL couldn't be matched.
    test('extractDriftViewerHttpUrl handles rounded-corner frame chars', () => {
        const line = '╰ http://127.0.0.1:8642 ╯';
        assert.strictEqual((0, drift_debug_server_log_parse_1.extractDriftViewerHttpUrl)(line), 'http://127.0.0.1:8642');
    });
    test('extractDriftViewerHttpUrl handles heavy-frame chars', () => {
        const line = '┃ http://127.0.0.1:8642 ┃';
        assert.strictEqual((0, drift_debug_server_log_parse_1.extractDriftViewerHttpUrl)(line), 'http://127.0.0.1:8642');
    });
    test('stripAsciiBoxNoise removes full box-drawing block', () => {
        assert.strictEqual((0, drift_debug_server_log_parse_1.stripAsciiBoxNoise)('╭──╮ hello ╰──╯'), 'hello');
        assert.strictEqual((0, drift_debug_server_log_parse_1.stripAsciiBoxNoise)('┏━━┓ world ┗━━┛'), 'world');
        assert.strictEqual((0, drift_debug_server_log_parse_1.stripAsciiBoxNoise)('├──┤ divider ├──┤'), 'divider');
    });
    test('accumulator emits after banner + URL lines', () => {
        const acc = (0, drift_debug_server_log_parse_1.createDriftDebugServerLogAccumulator)();
        assert.strictEqual(acc.push('╭──╮'), null);
        assert.strictEqual(acc.push('│           DRIFT DEBUG SERVER   v2.10.0           │'), null);
        assert.strictEqual(acc.push('├──────────────────────────────────────────────────┤'), null);
        assert.strictEqual(acc.push('│      Open in browser to view your database:      │'), null);
        const det = acc.push('      │              http://127.0.0.1:8642               │');
        assert.ok(det);
        assert.strictEqual(det.baseUrl, 'http://127.0.0.1:8642');
        assert.strictEqual(det.version, '2.10.0');
    });
    test('URL without banner in ring yields null', () => {
        const acc = (0, drift_debug_server_log_parse_1.createDriftDebugServerLogAccumulator)();
        assert.strictEqual(acc.push('      │              http://127.0.0.1:8642               │'), null);
    });
    test('isDriftDebugServerBannerLine', () => {
        assert.strictEqual((0, drift_debug_server_log_parse_1.isDriftDebugServerBannerLine)('DRIFT DEBUG SERVER v1.0.0'), true);
        assert.strictEqual((0, drift_debug_server_log_parse_1.isDriftDebugServerBannerLine)('SELECT 1'), false);
    });
});
//# sourceMappingURL=drift-debug-server-log-parse.test.js.map