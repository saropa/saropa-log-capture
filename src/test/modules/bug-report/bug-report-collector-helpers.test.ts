import * as assert from 'assert';
import { extractEnvironment } from '../../../modules/bug-report/bug-report-collector-helpers';

// Bug reports ship to GitHub/Slack, so captured environment-header values must be redacted: secret-
// looking keys are dropped and home-directory usernames are masked.
suite('extractEnvironment redaction', () => {

    test('redacts values of secret-looking header keys', () => {
        const lines = ['API Token: abc123secret', 'Auth: Bearer xyz', 'Project: demo'];
        const env = extractEnvironment(lines, lines.length);
        assert.strictEqual(env['API Token'], '<redacted>');
        assert.strictEqual(env['Auth'], '<redacted>');
        assert.strictEqual(env['Project'], 'demo', 'non-secret values are kept');
    });

    test('masks the username segment of a home-directory path', () => {
        const lines = ['Working Dir: C:\\Users\\craig\\project'];
        const env = extractEnvironment(lines, lines.length);
        assert.ok(!env['Working Dir'].includes('craig'), `username leaked: ${env['Working Dir']}`);
        assert.ok(env['Working Dir'].includes('<user>'), env['Working Dir']);
    });
});
