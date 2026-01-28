import * as assert from 'assert';
import { findClosestByTimestamp, DiffLine, LogLine } from '../modules/diff-engine';

suite('DiffEngine', () => {

    suite('findClosestByTimestamp', () => {
        test('should find exact timestamp match', () => {
            const target = new Date('2024-01-15T10:30:00Z');
            const lines: DiffLine[] = [
                { line: { index: 0, text: 'line 1', timestamp: new Date('2024-01-15T10:00:00Z') }, status: 'common' },
                { line: { index: 1, text: 'line 2', timestamp: new Date('2024-01-15T10:30:00Z') }, status: 'common' },
                { line: { index: 2, text: 'line 3', timestamp: new Date('2024-01-15T11:00:00Z') }, status: 'common' },
            ];

            const result = findClosestByTimestamp(target, lines);
            assert.strictEqual(result, 1);
        });

        test('should find closest timestamp when no exact match', () => {
            const target = new Date('2024-01-15T10:25:00Z');
            const lines: DiffLine[] = [
                { line: { index: 0, text: 'line 1', timestamp: new Date('2024-01-15T10:00:00Z') }, status: 'common' },
                { line: { index: 1, text: 'line 2', timestamp: new Date('2024-01-15T10:30:00Z') }, status: 'common' },
                { line: { index: 2, text: 'line 3', timestamp: new Date('2024-01-15T11:00:00Z') }, status: 'common' },
            ];

            const result = findClosestByTimestamp(target, lines);
            assert.strictEqual(result, 1); // 10:30 is closer to 10:25 than 10:00
        });

        test('should return 0 for empty lines', () => {
            const target = new Date('2024-01-15T10:00:00Z');
            const lines: DiffLine[] = [];

            const result = findClosestByTimestamp(target, lines);
            assert.strictEqual(result, 0);
        });

        test('should handle lines without timestamps', () => {
            const target = new Date('2024-01-15T10:30:00Z');
            const lines: DiffLine[] = [
                { line: { index: 0, text: 'line 1' }, status: 'common' },
                { line: { index: 1, text: 'line 2', timestamp: new Date('2024-01-15T10:30:00Z') }, status: 'common' },
                { line: { index: 2, text: 'line 3' }, status: 'common' },
            ];

            const result = findClosestByTimestamp(target, lines);
            assert.strictEqual(result, 1);
        });
    });
});
