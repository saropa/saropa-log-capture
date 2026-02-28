import * as assert from 'assert';
import { getRunSummaries } from '../modules/run-summaries';

suite('run-summaries', () => {
    test('returns empty for no run starts', () => {
        const lines = ['[12:00:00] [stdout] hello'];
        const getTs = (): number => 0;
        const count = (): { errors: number; warnings: number; perfs: number; infos: number } =>
            ({ errors: 0, warnings: 0, perfs: 0, infos: 0 });
        const r = getRunSummaries(lines, [], getTs, count);
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
        const getTs = (raw: string): number => {
            const m = raw.match(/^\[([\d:.]+)\]/);
            if (!m) {
                return 0;
            }
            const [h, min, s, ms] = m[1].split(/[:.]/).map((x) => parseInt(x, 10) || 0);
            return midnight + h * 3600000 + min * 60000 + s * 1000 + (ms || 0);
        };
        const count = (slice: string[]): { errors: number; warnings: number; perfs: number; infos: number } => {
            let errors = 0;
            let warnings = 0;
            const perfs = 0;
            let infos = 0;
            for (const line of slice) {
                if (/error/.test(line)) {
                    errors++;
                } else if (/warn/.test(line)) {
                    warnings++;
                } else {
                    infos++;
                }
            }
            return { errors, warnings, perfs, infos };
        };
        const runStartIndices = [0, 3];
        const r = getRunSummaries(lines, runStartIndices, getTs, count);
        assert.strictEqual(r.length, 2);
        assert.strictEqual(r[0].startLineIndex, 0);
        assert.strictEqual(r[0].endLineIndex, 2);
        assert.strictEqual(r[0].durationMs, 3000);
        assert.strictEqual(r[0].errors, 1);
        assert.strictEqual(r[0].infos, 1);
        assert.strictEqual(r[1].startLineIndex, 3);
        assert.strictEqual(r[1].endLineIndex, 4);
        assert.strictEqual(r[1].warnings, 1);
    });
});
