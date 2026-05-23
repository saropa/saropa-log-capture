/**
 * Tests for the connection validator and the bug_008 error-classification fix.
 *
 * The core bug_008 regression: with shell:true, a missing gcloud is reported by the shell as
 * "'gcloud' is not recognized" / "command not found" — NOT a Node ENOENT — so the old ENOENT-only
 * check mislabeled it as a generic failure. These tests pin the corrected classification.
 */

import * as assert from 'assert';
import { classifyGcloudError, classifyTokenError } from '../../../modules/crashlytics/crashlytics-diagnostics';
import { formatConnectionReport, type ConnectionReport } from '../../../modules/crashlytics/crashlytics-connection-check';

function errorWith(message: string, extra: Record<string, unknown>): Error {
    return Object.assign(new Error(message), extra);
}

suite('crashlytics bug_008 error classification', () => {
    test('classifyGcloudError treats Windows "is not recognized" as missing CLI', () => {
        const err = errorWith('Command failed: gcloud --version', {
            stderr: "'gcloud' is not recognized as an internal or external command,\noperable program or batch file.",
        });
        const d = classifyGcloudError(err);
        assert.strictEqual(d.errorType, 'missing');
        assert.strictEqual(d.step, 'gcloud');
    });

    test('classifyGcloudError treats POSIX "command not found" as missing CLI', () => {
        const err = errorWith('Command failed', { stderr: 'gcloud: command not found' });
        assert.strictEqual(classifyGcloudError(err).errorType, 'missing');
    });

    test('classifyGcloudError still treats ENOENT as missing CLI', () => {
        const err = errorWith('spawn gcloud ENOENT', { code: 'ENOENT' });
        assert.strictEqual(classifyGcloudError(err).errorType, 'missing');
    });

    test('classifyGcloudError does not mislabel a timeout as missing', () => {
        const err = errorWith('timeout', { code: 'ETIMEDOUT' });
        assert.strictEqual(classifyGcloudError(err).errorType, 'timeout');
    });

    test('classifyTokenError reports gcloud-missing (not auth) when the token fetch hits "is not recognized"', () => {
        // This is exactly Craig's log: token fetch failed with the shell "not recognized" message.
        const err = errorWith('Command failed', {
            stderr: "'gcloud' is not recognized as an internal or external command,",
        });
        const d = classifyTokenError(err);
        assert.strictEqual(d.step, 'gcloud');
        assert.strictEqual(d.errorType, 'missing');
    });

    test('classifyTokenError still detects a not-logged-in account', () => {
        const err = errorWith('Command failed', { stderr: 'ERROR: There are no credentialed accounts.' });
        const d = classifyTokenError(err);
        assert.strictEqual(d.step, 'token');
        assert.strictEqual(d.errorType, 'auth');
    });
});

suite('crashlytics connection report formatting', () => {
    test('formatConnectionReport renders per-step status, fixes, and a not-connected header', () => {
        const report: ConnectionReport = {
            ok: false,
            checkedAt: Date.now(),
            steps: [
                { id: 'gcloud', label: 'Google Cloud CLI', status: 'pass', detail: 'Found gcloud (on PATH).' },
                { id: 'auth', label: 'Authentication', status: 'fail', detail: 'Not signed in.', fix: 'Run: gcloud auth application-default login' },
                { id: 'config', label: 'Firebase project', status: 'pass', detail: 'project=saropa-mobile' },
                { id: 'api', label: 'Crashlytics API', status: 'skipped', detail: 'Skipped — sign-in must pass first.' },
            ],
        };
        const text = formatConnectionReport(report);
        assert.ok(text.includes('NOT CONNECTED'), 'header reflects failure');
        assert.ok(text.includes('[PASS] Google Cloud CLI'), 'pass row');
        assert.ok(text.includes('[FAIL] Authentication'), 'fail row');
        assert.ok(text.includes('[SKIP] Crashlytics API'), 'skip row');
        assert.ok(text.includes('Fix: Run: gcloud auth application-default login'), 'fix line');
    });

    test('formatConnectionReport marks a fully passing report as connected', () => {
        const report: ConnectionReport = {
            ok: true,
            checkedAt: Date.now(),
            steps: [{ id: 'api', label: 'Crashlytics API', status: 'pass', detail: 'Connected — 3 issue(s) returned.' }],
        };
        assert.ok(formatConnectionReport(report).includes('CONNECTED'));
    });
});
