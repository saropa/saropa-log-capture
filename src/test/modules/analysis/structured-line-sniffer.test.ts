import * as assert from 'assert';
import { sniffFormat } from '../../../modules/analysis/structured-line-sniffer';

suite('StructuredLineSniffer', () => {

    suite('sniffFormat', () => {

        test('should detect logcat threadtime format', () => {
            const lines = Array.from({ length: 20 }, (_, i) =>
                `04-12 20:47:0${i % 10}.621   485   485 D Zygote  : line ${i}`,
            );
            assert.strictEqual(sniffFormat(lines), 'logcat-threadtime');
        });

        test('should detect python logging format', () => {
            const lines = Array.from({ length: 20 }, (_, i) =>
                `2026-03-12 14:32:0${i % 10},123 - mymod - INFO - msg ${i}`,
            );
            assert.strictEqual(sniffFormat(lines), 'python');
        });

        test('should detect log4j format', () => {
            const lines = Array.from({ length: 20 }, (_, i) =>
                `2026-03-12 14:32:0${i % 10}.123 [main] INFO com.App - msg ${i}`,
            );
            assert.strictEqual(sniffFormat(lines), 'log4j');
        });

        test('should return undefined for unstructured text', () => {
            const lines = [
                'just some plain text',
                'another line of output',
                'no structure here',
            ];
            assert.strictEqual(sniffFormat(lines), undefined);
        });

        test('should return undefined for empty input', () => {
            assert.strictEqual(sniffFormat([]), undefined);
        });

        test('should return undefined for mixed formats below threshold', () => {
            const lines = [
                '04-12 20:47:05.621   485   485 D Zygote  : logcat',
                '2026-03-12 14:32:05,123 - mod - INFO - python',
                'plain text line',
                'another plain line',
                'more plain text',
            ];
            assert.strictEqual(sniffFormat(lines), undefined);
        });

        test('should pick majority format when mixed', () => {
            const lines = [
                'D/flutter: line 1',
                'D/flutter: line 2',
                'D/flutter: line 3',
                'D/flutter: line 4',
                'plain text',
            ];
            assert.strictEqual(sniffFormat(lines), 'logcat-short');
        });
    });
});
