/** bug_048: patterns that every export path relies on via redactSensitiveContent. */
import * as assert from 'assert';
import { redactSensitiveContent } from '../../../modules/security/redact';

suite('ExportRedaction', () => {
    test('redacts bearer/authorization tokens', () => {
        assert.ok(!redactSensitiveContent('Authorization: Bearer abc123xyz').includes('abc123xyz'));
    });
    test('redacts query-string secrets but keeps key name', () => {
        const out = redactSensitiveContent('GET /x?api_key=abc123&a=1');
        assert.ok(!out.includes('abc123'));
        assert.ok(out.includes('api_key='));
    });
    test('redacts user home paths', () => {
        assert.ok(!redactSensitiveContent('at /Users/craig/app/x.ts:1').includes('craig'));
    });
});
