import * as assert from 'assert';
import { describe, it } from 'mocha';
import { withStartLock, _resetStartLocksForTests } from '../../../modules/session/session-manager-internals';

/**
 * Regression test for the duplicate "Log Captured" notification bug.
 *
 * Root cause: when Flutter's parent session and its Dart VM child fired
 * `onDidStartDebugSession` within the same second, both handlers reached the
 * fall-through in `startSessionImpl` before either's `applyStartResult` had
 * published state. Both then created a `LogSession` with the same
 * timestamp-derived filename, both became owners, and both finalized — giving
 * the user two identical "Log Captured: 20260419_205945_..." prompts.
 *
 * `withStartLock` serializes concurrent starts per workspace so the second
 * caller sees state from the first and takes the alias branch instead.
 */
describe('withStartLock', () => {

    it('should serialize concurrent starts for the same key', async () => {
        _resetStartLocksForTests();
        const order: string[] = [];
        let inFlight = 0;
        let maxInFlight = 0;

        // Each "run" takes a short tick, records enter/exit, and tracks max
        // concurrency. If the lock works, maxInFlight must stay at 1.
        const make = (label: string) => async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            order.push(`${label}:start`);
            await new Promise<void>((r) => setTimeout(r, 10));
            order.push(`${label}:end`);
            inFlight -= 1;
            return label;
        };

        const [a, b, c] = await Promise.all([
            withStartLock('workspace-1', make('A')),
            withStartLock('workspace-1', make('B')),
            withStartLock('workspace-1', make('C')),
        ]);

        assert.strictEqual(a, 'A');
        assert.strictEqual(b, 'B');
        assert.strictEqual(c, 'C');
        assert.strictEqual(maxInFlight, 1, `Expected serial execution, got maxInFlight=${maxInFlight}`);
        // Must be pairwise ordered: each run's end precedes the next run's start.
        assert.deepStrictEqual(order, [
            'A:start', 'A:end',
            'B:start', 'B:end',
            'C:start', 'C:end',
        ]);
    });

    it('should allow concurrent starts on different keys', async () => {
        _resetStartLocksForTests();
        let inFlight = 0;
        let maxInFlight = 0;

        const make = () => async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise<void>((r) => setTimeout(r, 10));
            inFlight -= 1;
            return 'ok';
        };

        await Promise.all([
            withStartLock('workspace-a', make()),
            withStartLock('workspace-b', make()),
            withStartLock('workspace-c', make()),
        ]);

        // Different workspaces must not block each other — concurrency expected.
        assert.ok(maxInFlight >= 2, `Expected concurrent execution across keys, got maxInFlight=${maxInFlight}`);
    });

    it('should not let a prior failure block the next start', async () => {
        _resetStartLocksForTests();

        // First run throws; second run on same key should still execute.
        const first = withStartLock('workspace-err', async () => {
            throw new Error('boom');
        });

        const second = withStartLock('workspace-err', async () => 'recovered');

        await assert.rejects(first, /boom/);
        assert.strictEqual(await second, 'recovered');
    });

    it('should clear the slot after completion so later calls are not blocked', async () => {
        _resetStartLocksForTests();

        const first = await withStartLock('workspace-x', async () => 'first');
        assert.strictEqual(first, 'first');

        // If the slot leaked, this would hang on the prior promise that already resolved.
        // With proper cleanup, it runs immediately.
        const second = await withStartLock('workspace-x', async () => 'second');
        assert.strictEqual(second, 'second');
    });
});
