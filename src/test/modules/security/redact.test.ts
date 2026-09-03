import * as assert from 'assert';
import { redactSensitiveContent } from '../../../modules/security/redact';

// bug_003: redact.ts is the single shared pass that strips secrets before text leaves the
// extension (bug report bodies, AI context). It had zero test coverage, so a regression here
// (e.g. a regex that stops matching a path form, as happened with the forward-slash
// vscode://file/ leak) could ship silently. These assert a synthetic secret/path never survives.
suite('redactSensitiveContent', () => {

    test('returns falsy input unchanged (empty string, undefined-like)', () => {
        assert.strictEqual(redactSensitiveContent(''), '');
    });

    test('redacts a Bearer token', () => {
        const out = redactSensitiveContent('Authorization header: Bearer abc123.def456');
        assert.ok(!out.includes('abc123.def456'), out);
        assert.ok(out.includes('[REDACTED]'), out);
    });

    test('redacts an Authorization: <token> line', () => {
        const out = redactSensitiveContent('Authorization: xyz-secret-token');
        assert.ok(!out.includes('xyz-secret-token'), out);
    });

    test('redacts a Windows user path using backslashes', () => {
        const out = redactSensitiveContent('at C:\\Users\\craig\\project\\file.ts:12');
        assert.ok(!out.includes('craig'), out);
        assert.ok(out.includes('[PATH_REDACTED]'), out);
    });

    // The exact leak vector bug_003 reported: buildVscodeFileUri() normalizes "\\" to "/" before
    // building a vscode://file/ URI, so the path arrives here already forward-slashed. A regex
    // scoped only to the backslash form (the original bug) let this straight through.
    test('redacts a Windows user path using forward slashes (vscode://file/ URI form)', () => {
        const out = redactSensitiveContent('[file.ts:12](vscode://file/C:/Users/craig/project/file.ts:12)');
        assert.ok(!out.includes('craig'), out);
        assert.ok(out.includes('[PATH_REDACTED]'), out);
    });

    test('redacts a Unix home directory path', () => {
        const out = redactSensitiveContent('at /home/craig/project/file.ts:12');
        assert.ok(!out.includes('craig'), out);
        assert.ok(out.includes('[PATH_REDACTED]'), out);
    });

    test('redacts a macOS /Users/ path', () => {
        const out = redactSensitiveContent('at /Users/craig/project/file.ts:12');
        assert.ok(!out.includes('craig'), out);
    });

    test('redacts a query-string secret while keeping the key name', () => {
        const out = redactSensitiveContent('GET https://api.example.com/x?token=supersecret&other=1');
        assert.ok(!out.includes('supersecret'), out);
        assert.ok(out.includes('token=[REDACTED]'), out);
        assert.ok(out.includes('other=1'), 'non-secret query params are kept');
    });

    test('leaves ordinary text untouched', () => {
        const text = 'Widget rebuilt in 12ms, no errors.';
        assert.strictEqual(redactSensitiveContent(text), text);
    });

    test('redacts multiple secrets in the same string', () => {
        const out = redactSensitiveContent(
            'Bearer abc123 at C:\\Users\\craig\\app.ts and ?api_key=zzz',
        );
        assert.ok(!out.includes('abc123'), out);
        assert.ok(!out.includes('craig'), out);
        assert.ok(!out.includes('zzz'), out);
    });
});
