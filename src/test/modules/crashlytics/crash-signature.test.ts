/**
 * Unit tests for crashSignatureToken — the distinctive search term used to correlate a crash against
 * captured logs (plan 054 Stage 5c-4). Pure string logic — runs under `node --test`.
 */

import * as assert from 'assert';
import { crashSignatureToken } from '../../../modules/crashlytics/crash-signature';

suite('crashSignatureToken', () => {
    test('returns the exception class from a dotted/namespaced name', () => {
        assert.strictEqual(crashSignatureToken('java.lang.NullPointerException'), 'NullPointerException');
    });

    test('prefers the exception class over a longer non-exception word', () => {
        assert.strictEqual(crashSignatureToken('IllegalStateException: configuration'), 'IllegalStateException');
    });

    test('falls back to the longest distinctive word when no Exception/Error class is present', () => {
        assert.strictEqual(crashSignatureToken('crash in ContactSync sync'), 'ContactSync');
    });

    test('matches an *Error class name too', () => {
        assert.strictEqual(crashSignatureToken('_TypeError: not a subtype'), '_TypeError');
    });

    test('returns undefined when nothing distinctive remains', () => {
        assert.strictEqual(crashSignatureToken('a b c'), undefined);
        assert.strictEqual(crashSignatureToken(''), undefined);
    });
});
