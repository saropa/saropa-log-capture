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
const assert = __importStar(require("node:assert"));
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const vscode = __importStar(require("vscode"));
const log_session_1 = require("../../../modules/capture/log-session");
const file_splitter_1 = require("../../../modules/misc/file-splitter");
function makeSessionConfig(logDir, maxLines = 1000) {
    return {
        includeTimestamp: true,
        includeSourceLocation: false,
        includeElapsedTime: false,
        logDirectory: logDir,
        redactEnvVars: [],
        splitRules: (0, file_splitter_1.defaultSplitRules)(),
        maxLines,
    };
}
function makeSessionContext(workspaceRoot) {
    return {
        date: new Date('2026-03-23T10:00:00.000Z'),
        projectName: 'queue-test',
        debugAdapterType: 'dart',
        configurationName: 'debug',
        configuration: {},
        vscodeVersion: '1.105.0',
        extensionVersion: '3.12.1',
        os: process.platform,
        workspaceFolder: { uri: vscode.Uri.file(workspaceRoot), name: 'ws', index: 0 },
    };
}
suite('LogSession queue safety', () => {
    test('stop drains queued lines before closing stream', async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-session-'));
        const session = new log_session_1.LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => { });
        await session.start();
        for (let i = 0; i < 40; i++) {
            session.appendLine(`queued-line-${i}`, 'console', new Date(`2026-03-23T10:00:${String(i % 60).padStart(2, '0')}.000Z`));
        }
        await session.stop();
        const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
        for (let i = 0; i < 40; i++) {
            assert.ok(body.includes(`queued-line-${i}`), `expected queued-line-${i} to be written before stop`);
        }
    });
    test('identical consecutive lines are all written (capture-side dedup bypass)', async () => {
        /* Unified line-collapsing rethink (bugs/unified-line-collapsing.md):
           LogSession no longer routes incoming lines through Deduplicator.process(),
           so identical-within-500ms runs that the old path would have folded to
           `line (x5)` are now each written as their own row. This preserves per-line
           timestamps and 1:1 file-line-number-to-app-output mapping — the viewer
           handles the display-time fold. Regression test pins that every repeat
           reaches disk and no `(xN)` suffix is appended by the capture side. */
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-nodedup-'));
        const session = new log_session_1.LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => { });
        await session.start();
        const identical = 'Error: Connection refused';
        for (let i = 0; i < 5; i++) {
            session.appendLine(identical, 'console', new Date(`2026-03-23T10:02:00.${String(i * 50).padStart(3, '0')}Z`));
        }
        await session.stop();
        const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
        const occurrences = body.split(identical).length - 1;
        assert.strictEqual(occurrences, 5, 'all five identical lines must reach the file');
        assert.ok(!/\(x\d+\)/.test(body), 'capture side must not stamp an (xN) suffix');
    });
    test('maxLines rotates parts and preserves newest lines', async () => {
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-split-'));
        const session = new log_session_1.LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 3), () => { });
        await session.start();
        for (let i = 0; i < 7; i++) {
            session.appendLine(`roll-line-${i}`, 'console', new Date(`2026-03-23T10:01:${String(i % 60).padStart(2, '0')}.000Z`));
        }
        await session.stop();
        const dir = path.dirname(session.fileUri.fsPath);
        const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.log')).sort();
        assert.ok(names.length >= 3, 'expected split parts to be created');
        let merged = '';
        for (const name of names) {
            merged += await fs.readFile(path.join(dir, name), 'utf-8');
        }
        for (let i = 0; i < 7; i++) {
            assert.ok(merged.includes(`roll-line-${i}`), `expected roll-line-${i} across split parts`);
        }
    });
});
//# sourceMappingURL=log-session.test.js.map