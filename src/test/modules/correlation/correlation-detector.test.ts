/**
 * Unit tests for correlation detection: confidence ordering and deduplication.
 */

import * as assert from 'assert';
import {
    meetsMinConfidence,
    deduplicateCorrelations,
    detectCorrelations,
} from '../../../modules/correlation/correlation-detector';
import type { Correlation, CorrelatedEvent } from '../../../modules/correlation/correlation-types';

suite('CorrelationDetector', () => {

    suite('meetsMinConfidence', () => {
        test('high meets high', () => { assert.strictEqual(meetsMinConfidence('high', 'high'), true); });
        test('high meets medium', () => { assert.strictEqual(meetsMinConfidence('high', 'medium'), true); });
        test('high meets low', () => { assert.strictEqual(meetsMinConfidence('high', 'low'), true); });
        test('medium does not meet high', () => { assert.strictEqual(meetsMinConfidence('medium', 'high'), false); });
        test('medium meets medium', () => { assert.strictEqual(meetsMinConfidence('medium', 'medium'), true); });
        test('low does not meet high', () => { assert.strictEqual(meetsMinConfidence('low', 'high'), false); });
        test('low meets low', () => { assert.strictEqual(meetsMinConfidence('low', 'low'), true); });
    });

    suite('deduplicateCorrelations', () => {
        function ev(file: string, ts: number): CorrelatedEvent {
            return { source: 'debug', timestamp: ts, summary: '', location: { file } };
        }
        function corr(id: string, confidence: 'high' | 'medium' | 'low', events: CorrelatedEvent[], timestamp: number): Correlation {
            return { id, type: 'error-http', confidence, events, description: id, timestamp };
        }

        test('empty returns empty', () => {
            assert.deepStrictEqual(deduplicateCorrelations([]), []);
        });

        test('single correlation is kept', () => {
            const c = corr('a', 'high', [ev('f', 1), ev('f', 2)], 1.5);
            assert.strictEqual(deduplicateCorrelations([c]).length, 1);
        });

        test('non-overlapping are both kept', () => {
            const c1 = corr('a', 'high', [ev('f1', 1), ev('f1', 2)], 1.5);
            const c2 = corr('b', 'high', [ev('f2', 100), ev('f2', 101)], 100.5);
            const out = deduplicateCorrelations([c1, c2]);
            assert.strictEqual(out.length, 2);
        });

        test('overlapping same anchor keeps higher confidence', () => {
            const c1 = corr('a', 'low', [ev('f', 1), ev('f', 2)], 1.5);
            const c2 = corr('b', 'high', [ev('f', 1), ev('f', 3)], 2);
            const out = deduplicateCorrelations([c1, c2]);
            assert.strictEqual(out.length, 1);
            assert.strictEqual(out[0].confidence, 'high');
        });
    });

    suite('detectCorrelations', () => {
        test('empty events returns empty', async () => {
            const out = await detectCorrelations([], {
                windowMs: 2000,
                minConfidence: 'medium',
                enabledTypes: ['error-http'],
            });
            assert.deepStrictEqual(out, []);
        });

        test('single event returns empty', async () => {
            const out = await detectCorrelations([
                { timestamp: 1, source: 'debug', level: 'error', summary: 'err', location: { file: 'f', line: 1 } },
            ], {
                windowMs: 2000,
                minConfidence: 'low',
                enabledTypes: ['error-http'],
            });
            assert.strictEqual(out.length, 0);
        });
    });
});
