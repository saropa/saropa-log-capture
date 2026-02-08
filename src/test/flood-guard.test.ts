import * as assert from 'assert';
import { FloodGuard } from '../modules/flood-guard';

suite('FloodGuard', () => {

    suite('check', () => {

        test('should allow first message', () => {
            const guard = new FloodGuard();
            const result = guard.check('hello');
            assert.strictEqual(result.allow, true);
            assert.strictEqual(result.suppressedCount, undefined);
        });

        test('should allow different messages', () => {
            const guard = new FloodGuard();
            assert.strictEqual(guard.check('hello').allow, true);
            assert.strictEqual(guard.check('world').allow, true);
            assert.strictEqual(guard.check('foo').allow, true);
        });

        test('should allow repeated messages below threshold', () => {
            const guard = new FloodGuard();
            for (let i = 0; i < 50; i++) {
                const result = guard.check('hello');
                assert.strictEqual(result.allow, true);
            }
        });

        test('should start suppressing after threshold exceeded', () => {
            const guard = new FloodGuard();
            // Send 101 identical messages (threshold is 100)
            for (let i = 0; i < 101; i++) {
                guard.check('flood');
            }
            // The next one should be suppressed
            const result = guard.check('flood');
            assert.strictEqual(result.allow, false);
        });

        test('should reset when different message arrives', () => {
            const guard = new FloodGuard();
            // Build up repeat count
            for (let i = 0; i < 50; i++) {
                guard.check('flood');
            }
            // Different message should be allowed
            const result = guard.check('different');
            assert.strictEqual(result.allow, true);
        });

        test('should report suppressed count on different message after suppression', () => {
            const guard = new FloodGuard();
            // Trigger suppression (threshold is 100, so 105 activates it)
            for (let i = 0; i < 105; i++) {
                guard.check('flood');
            }
            // Different message exits suppression and reports dropped count
            const result = guard.check('other');
            assert.strictEqual(result.allow, true);
            assert.strictEqual(typeof result.suppressedCount, 'number');
            assert.ok(result.suppressedCount! > 0);
        });

        test('should handle empty string messages', () => {
            const guard = new FloodGuard();
            const result = guard.check('');
            assert.strictEqual(result.allow, true);
        });
    });

    suite('reset', () => {

        test('should clear all state', () => {
            const guard = new FloodGuard();
            // Build up state
            for (let i = 0; i < 50; i++) {
                guard.check('message');
            }
            guard.reset();
            // After reset, first message should be allowed fresh
            const result = guard.check('message');
            assert.strictEqual(result.allow, true);
            assert.strictEqual(result.suppressedCount, undefined);
        });

        test('should stop suppression mode', () => {
            const guard = new FloodGuard();
            // Trigger suppression
            for (let i = 0; i < 105; i++) {
                guard.check('flood');
            }
            guard.reset();
            // After reset, messages should be allowed
            const result = guard.check('flood');
            assert.strictEqual(result.allow, true);
        });
    });

});
