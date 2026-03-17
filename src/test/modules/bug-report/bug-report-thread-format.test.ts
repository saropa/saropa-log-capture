import * as assert from 'assert';
import {
    groupFramesByThread,
    formatThreadGroupedLines,
} from '../../../modules/bug-report/bug-report-thread-format';
import type { StackFrame } from '../../../modules/bug-report/bug-report-collector';

function frame(text: string, isApp: boolean, threadName?: string): StackFrame {
    return { text, isApp, threadName };
}

suite('BugReportThreadFormat', () => {

    suite('groupFramesByThread', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual(groupFramesByThread([]), []);
        });

        test('should group all frames into one group when no thread names', () => {
            const frames = [frame('at main()', true), frame('at lib()', false)];
            const groups = groupFramesByThread(frames);
            assert.strictEqual(groups.length, 1);
            assert.strictEqual(groups[0][0], undefined);
            assert.strictEqual(groups[0][1].length, 2);
        });

        test('should group consecutive frames by thread name', () => {
            const frames = [
                frame('at a()', true, 'main'),
                frame('at b()', false, 'main'),
                frame('at c()', true, 'worker'),
                frame('at d()', false, 'worker'),
            ];
            const groups = groupFramesByThread(frames);
            assert.strictEqual(groups.length, 2);
            assert.strictEqual(groups[0][0], 'main');
            assert.strictEqual(groups[0][1].length, 2);
            assert.strictEqual(groups[1][0], 'worker');
            assert.strictEqual(groups[1][1].length, 2);
        });

        test('should create new group when thread name changes', () => {
            const frames = [
                frame('at a()', true, 'main'),
                frame('at b()', true, 'worker'),
                frame('at c()', true, 'main'),
            ];
            const groups = groupFramesByThread(frames);
            assert.strictEqual(groups.length, 3);
        });

        test('should handle single frame', () => {
            const groups = groupFramesByThread([frame('at x()', true, 'main')]);
            assert.strictEqual(groups.length, 1);
            assert.strictEqual(groups[0][1].length, 1);
        });
    });

    suite('formatThreadGroupedLines', () => {
        test('should return empty array for empty input', () => {
            assert.deepStrictEqual(formatThreadGroupedLines([]), []);
        });

        test('should prefix app frames with >>> for single thread', () => {
            const frames = [frame('main()', true), frame('lib()', false)];
            const lines = formatThreadGroupedLines(frames);
            assert.strictEqual(lines[0], '>>> main()');
            assert.strictEqual(lines[1], '    lib()');
        });

        test('should add thread separators for multiple named threads', () => {
            const frames = [
                frame('a()', true, 'main'),
                frame('b()', false, 'worker'),
            ];
            const lines = formatThreadGroupedLines(frames);
            assert.ok(lines.some(l => l.includes('--- main ---')));
            assert.ok(lines.some(l => l.includes('--- worker ---')));
        });

        test('should not add thread separators when only one group', () => {
            const frames = [
                frame('a()', true, 'main'),
                frame('b()', false, 'main'),
            ];
            const lines = formatThreadGroupedLines(frames);
            assert.ok(!lines.some(l => l.startsWith('---')));
        });

        test('should not add separators when all thread names are undefined', () => {
            const frames = [
                frame('a()', true),
                frame('b()', false),
            ];
            const lines = formatThreadGroupedLines(frames);
            assert.ok(!lines.some(l => l.startsWith('---')));
            assert.strictEqual(lines.length, 2);
        });

        test('should use >>> for app frames and 4-space indent for framework', () => {
            const frames = [frame('app()', true), frame('fw()', false)];
            const lines = formatThreadGroupedLines(frames);
            assert.ok(lines[0].startsWith('>>> '));
            assert.ok(lines[1].startsWith('    '));
        });
    });
});
