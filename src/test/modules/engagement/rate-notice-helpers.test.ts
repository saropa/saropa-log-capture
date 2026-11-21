/**
 * Tests for the pure rating-notice helpers (no Extension Host needed).
 */

import * as assert from 'assert';
import {
    RATE_ACTIVATION_THRESHOLD,
    describeRateDecision,
    shouldPromptForRating,
} from '../../../modules/engagement/rate-notice-helpers';

suite('shouldPromptForRating', () => {
    test('should return false when activation count is below threshold', () => {
        assert.strictEqual(shouldPromptForRating(0, undefined), false);
        assert.strictEqual(shouldPromptForRating(1, undefined), false);
        assert.strictEqual(shouldPromptForRating(RATE_ACTIVATION_THRESHOLD - 1, undefined), false);
    });

    test('should return true when activation count reaches the threshold', () => {
        assert.strictEqual(shouldPromptForRating(RATE_ACTIVATION_THRESHOLD, undefined), true);
    });

    test('should return true when activation count exceeds the threshold', () => {
        assert.strictEqual(shouldPromptForRating(RATE_ACTIVATION_THRESHOLD + 10, undefined), true);
    });

    test('should return false when outcome is rated regardless of count', () => {
        assert.strictEqual(shouldPromptForRating(RATE_ACTIVATION_THRESHOLD, 'rated'), false);
        assert.strictEqual(shouldPromptForRating(999, 'rated'), false);
    });

    test('should return false when outcome is dismissed regardless of count', () => {
        assert.strictEqual(shouldPromptForRating(RATE_ACTIVATION_THRESHOLD, 'dismissed'), false);
        assert.strictEqual(shouldPromptForRating(999, 'dismissed'), false);
    });
});

suite('describeRateDecision', () => {
    test('should explain rated outcome', () => {
        const reason = describeRateDecision(50, 'rated', false);
        assert.strictEqual(reason, 'user already rated');
    });

    test('should explain dismissed outcome', () => {
        const reason = describeRateDecision(50, 'dismissed', false);
        assert.strictEqual(reason, 'user chose not to be asked again');
    });

    test('should explain threshold reached when shown', () => {
        const reason = describeRateDecision(RATE_ACTIVATION_THRESHOLD, undefined, true);
        assert.ok(reason.includes('reached threshold'));
        assert.ok(reason.includes(String(RATE_ACTIVATION_THRESHOLD)));
    });

    test('should explain below threshold when not shown', () => {
        const reason = describeRateDecision(5, undefined, false);
        assert.ok(reason.includes('below threshold'));
        assert.ok(reason.includes('5'));
    });
});
