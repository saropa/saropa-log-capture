import * as assert from 'assert';
import { groupCrashThreads } from '../../../modules/crashlytics/crashlytics-thread-grouping';
import type { CrashlyticsThread } from '../../../modules/crashlytics/crashlytics-types';

/** Build a thread from frame texts, for terse fixtures. */
function thread(name: string, frames: string[]): CrashlyticsThread {
    return { name, frames: frames.map(text => ({ text })) };
}

suite('Crashlytics thread grouping (plan 054 5b)', () => {

    test('should collapse threads with identical stacks into one group with a count', () => {
        const threads = [
            thread('pool-1-thread-1', ['at A.wait', 'at B.park']),
            thread('pool-1-thread-2', ['at A.wait', 'at B.park']),
            thread('pool-1-thread-3', ['at A.wait', 'at B.park']),
        ];
        const groups = groupCrashThreads(threads);
        assert.strictEqual(groups.length, 1, 'three identical stacks collapse to one group');
        assert.strictEqual(groups[0].count, 3);
        assert.deepStrictEqual(groups[0].names, ['pool-1-thread-1', 'pool-1-thread-2', 'pool-1-thread-3']);
    });

    test('should keep threads with distinct stacks in separate groups', () => {
        const groups = groupCrashThreads([
            thread('main', ['at Main.run']),
            thread('worker', ['at Worker.loop']),
        ]);
        assert.strictEqual(groups.length, 2);
        assert.strictEqual(groups[0].count, 1);
        assert.strictEqual(groups[1].count, 1);
    });

    test('should group by stack only, ignoring thread name', () => {
        const groups = groupCrashThreads([
            thread('Binder:1', ['at Native.poll']),
            thread('Binder:2', ['at Native.poll']),
        ]);
        assert.strictEqual(groups.length, 1, 'different names, same stack → one group');
        assert.strictEqual(groups[0].rep.name, 'Binder:1', 'representative is the first-seen thread');
    });

    test('should preserve first-seen order of groups', () => {
        const groups = groupCrashThreads([
            thread('first', ['at X']),
            thread('second', ['at Y']),
            thread('first-dup', ['at X']),
            thread('third', ['at Z']),
        ]);
        assert.deepStrictEqual(groups.map(g => g.rep.name), ['first', 'second', 'third']);
        assert.strictEqual(groups[0].count, 2, 'the X-stack group accumulated its duplicate');
    });

    test('should treat empty-frame threads as their own group', () => {
        const groups = groupCrashThreads([
            thread('idle-1', []),
            thread('idle-2', []),
            thread('busy', ['at Work.do']),
        ]);
        assert.strictEqual(groups.length, 2);
        assert.strictEqual(groups[0].count, 2, 'both empty-stack threads collapse together');
    });

    test('should return an empty array for no threads', () => {
        assert.deepStrictEqual(groupCrashThreads([]), []);
    });
});
