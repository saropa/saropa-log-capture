/**
 * Drift Advisor includeInLogCaptureSession normalization (built-in + bridge alignment).
 */

import * as assert from 'node:assert';
import {
    driftBuiltinContributesMetaSidecar,
    normalizeDriftIncludeInLogCaptureSession,
} from '../../../modules/integrations/drift-advisor-include-level';

suite('DriftAdvisorIncludeSetting', () => {
    test('normalizeDriftIncludeInLogCaptureSession accepts known values', () => {
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession('none'), 'none');
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession('header'), 'header');
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession('full'), 'full');
    });

    test('normalizeDriftIncludeInLogCaptureSession defaults to full for unknown', () => {
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession(undefined), 'full');
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession(''), 'full');
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession('partial'), 'full');
        assert.strictEqual(normalizeDriftIncludeInLogCaptureSession(1), 'full');
    });

    test('driftBuiltinContributesMetaSidecar only for full', () => {
        assert.strictEqual(driftBuiltinContributesMetaSidecar('none'), false);
        assert.strictEqual(driftBuiltinContributesMetaSidecar('header'), false);
        assert.strictEqual(driftBuiltinContributesMetaSidecar('full'), true);
    });
});
