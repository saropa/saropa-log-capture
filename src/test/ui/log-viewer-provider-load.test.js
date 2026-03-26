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
const log_viewer_provider_load_1 = require("../../ui/provider/log-viewer-provider-load");
function makeHeader(dateIso) {
    return [
        '=== SAROPA LOG CAPTURE — SESSION START ===',
        `Date:           ${dateIso}`,
        'Project:        demo',
        '==========================================',
        '',
    ].join('\n');
}
suite('log viewer provider load', () => {
    test('loads split parts so level filters see full session', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-viewer-load-'));
        const logDir = path.join(tmpDir, 'reports', '20260323');
        await fs.mkdir(logDir, { recursive: true });
        const base = '20260323_120000_demo';
        const part1 = path.join(logDir, `${base}.log`);
        const part2 = path.join(logDir, `${base}_002.log`);
        await fs.writeFile(part1, makeHeader('2026-03-23T12:00:00.000Z') + '[12:00:01.000] [console] first-part\n', 'utf-8');
        await fs.writeFile(part2, makeHeader('2026-03-23T12:10:00.000Z') + '[12:10:01.000] [console] second-part-error\n', 'utf-8');
        const messages = [];
        const target = {
            postMessage: (msg) => { messages.push(msg); },
            setFilename: (_name) => { },
            setSessionInfo: (_info) => { },
            getSeenCategories: () => new Set(),
            setHasPerformanceData: (_has) => { },
            setCodeQualityPayload: (_payload) => { },
        };
        const result = await (0, log_viewer_provider_load_1.executeLoadContent)(target, vscode.Uri.file(part1), () => true);
        assert.ok(result.contentLength >= 2, 'expected content from both split parts');
        const setMax = messages.find((m) => typeof m === 'object' && m !== null && m.type === 'setMaxLines');
        assert.ok(setMax, 'expected setMaxLines message when loading full-session content');
        assert.ok(typeof setMax.maxLines === 'number' && setMax.maxLines >= 2, 'expected raised maxLines for full-session data');
        const addLines = messages
            .filter((m) => typeof m === 'object' && m !== null && m.type === 'addLines')
            .flatMap((m) => m.lines ?? []);
        const texts = addLines
            .map((l) => l.text)
            .filter((v) => typeof v === 'string');
        assert.ok(texts.some((t) => t.includes('first-part')), 'expected first split part line');
        assert.ok(texts.some((t) => t.includes('second-part-error')), 'expected second split part line');
    });
});
//# sourceMappingURL=log-viewer-provider-load.test.js.map