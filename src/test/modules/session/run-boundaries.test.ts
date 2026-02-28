import * as assert from 'assert';
import { detectRunBoundaries, getRunStartIndices, type RunBoundary } from '../../../modules/session/run-boundaries';

suite('run-boundaries', () => {
    test('detects Launching line', () => {
        const lines = ['[12:00:00] [stdout] Launching lib\\main.dart on sdk gphone64 x86 64 in debug mode...'];
        const b = detectRunBoundaries(lines);
        assert.strictEqual(b.length, 1);
        assert.strictEqual(b[0].lineIndex, 0);
        assert.strictEqual(b[0].kind, 'launch');
        assert.strictEqual(b[0].label, 'Launch');
    });

    test('detects VM Service and Exited', () => {
        const lines = [
            'Connecting to VM Service at ws://127.0.0.1:64773/ws',
            'Connected to the VM Service.',
            'Application finished.',
            'Exited (-1).',
        ];
        const b = detectRunBoundaries(lines);
        assert.strictEqual(b.length, 4);
        assert.strictEqual(b[0].kind, 'launch');
        assert.strictEqual(b[1].kind, 'launch');
        assert.strictEqual(b[2].kind, 'exited');
        assert.strictEqual(b[3].kind, 'exited');
    });

    test('detects hot restart and hot reload', () => {
        const lines = [
            'Performing hot restart...',
            'Hot reload done.',
        ];
        const b = detectRunBoundaries(lines);
        assert.strictEqual(b.length, 2);
        assert.strictEqual(b[0].kind, 'hot_restart');
        assert.strictEqual(b[1].kind, 'hot_reload');
    });

    test('getRunStartIndices excludes exited', () => {
        const boundaries: RunBoundary[] = [
            { lineIndex: 0, label: 'Launch', kind: 'launch' },
            { lineIndex: 5, label: 'Exited', kind: 'exited' },
            { lineIndex: 10, label: 'Launch', kind: 'launch' },
        ];
        const indices = getRunStartIndices(boundaries);
        assert.deepStrictEqual(indices, [0, 10]);
    });

    test('line matching both start and end is classified as start only', () => {
        const lines = ['Launching app in debug mode'];
        const b = detectRunBoundaries(lines);
        assert.strictEqual(b.length, 1);
        assert.strictEqual(b[0].kind, 'launch');
    });

    test('returns empty for no matches', () => {
        const lines = ['Some random log line', 'Another line'];
        const b = detectRunBoundaries(lines);
        assert.strictEqual(b.length, 0);
    });
});
