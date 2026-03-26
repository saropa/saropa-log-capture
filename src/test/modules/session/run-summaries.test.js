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
const run_summaries_1 = require("../../../modules/session/run-summaries");
suite('run-summaries', () => {
    test('returns empty for no run starts', () => {
        const lines = ['[12:00:00] [stdout] hello'];
        const getTs = () => 0;
        const count = () => ({ errors: 0, warnings: 0, perfs: 0, infos: 0 });
        const r = (0, run_summaries_1.getRunSummaries)(lines, [], getTs, count);
        assert.strictEqual(r.length, 0);
    });
    test('builds one summary per run with timestamps and counts', () => {
        const lines = [
            '[12:00:00.000] [stdout] Launch',
            '[12:00:01.500] [stdout] error line',
            '[12:00:02.000] [stdout] info',
            '[12:00:03.000] [stdout] Hot restart',
            '[12:00:04.000] [stdout] warn',
        ];
        const midnight = new Date('2026-02-28T00:00:00').getTime();
        const getTs = (raw) => {
            const m = raw.match(/^\[([\d:.]+)\]/);
            if (!m) {
                return 0;
            }
            const [h, min, s, ms] = m[1].split(/[:.]/).map((x) => parseInt(x, 10) || 0);
            return midnight + h * 3600000 + min * 60000 + s * 1000 + (ms || 0);
        };
        const count = (slice) => {
            let errors = 0;
            let warnings = 0;
            const perfs = 0;
            let infos = 0;
            for (const line of slice) {
                if (/error/.test(line)) {
                    errors++;
                }
                else if (/warn/.test(line)) {
                    warnings++;
                }
                else {
                    infos++;
                }
            }
            return { errors, warnings, perfs, infos };
        };
        const runStartIndices = [0, 3];
        const r = (0, run_summaries_1.getRunSummaries)(lines, runStartIndices, getTs, count);
        assert.strictEqual(r.length, 2);
        assert.strictEqual(r[0].startLineIndex, 0);
        assert.strictEqual(r[0].endLineIndex, 2);
        // Run 0: lines 0–2, timestamps 12:00:00.000 → 12:00:02.000 → duration 2000ms; 1 error, 2 infos (Launch + "info").
        assert.strictEqual(r[0].durationMs, 2000);
        assert.strictEqual(r[0].errors, 1);
        assert.strictEqual(r[0].infos, 2);
        assert.strictEqual(r[1].startLineIndex, 3);
        assert.strictEqual(r[1].endLineIndex, 4);
        assert.strictEqual(r[1].warnings, 1);
    });
});
//# sourceMappingURL=run-summaries.test.js.map