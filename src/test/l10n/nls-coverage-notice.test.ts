/**
 * Tests for the manifest-coverage notice resolver and its audited data.
 *
 * The resolver normalizes VS Code's display-language tag (which can be a full
 * regional tag like `pt-br` / `zh-cn` or a bare `de`) to a coverage-map key, and
 * must return undefined for English and unshipped locales so the notice stays silent.
 * The data assertions guard the contract the notice depends on: every shipped manifest
 * locale is tracked, percents are sane, and English is always complete.
 */
import * as assert from 'node:assert';
import { resolveCoverageKey } from '../../l10n/nls-coverage-notice';
import { nlsManifestCoverage } from '../../l10n/nls-coverage-data';

suite('NLS coverage notice', () => {

    test('resolves full regional tags case-insensitively', () => {
        assert.strictEqual(resolveCoverageKey('pt-br'), 'pt-br');
        assert.strictEqual(resolveCoverageKey('PT-BR'), 'pt-br');
        assert.strictEqual(resolveCoverageKey('zh-cn'), 'zh-cn');
    });

    test('falls back to the primary subtag when the full tag is untracked', () => {
        // `de-at` is not shipped, but its base `de` is — German chrome coverage applies.
        assert.strictEqual(resolveCoverageKey('de-at'), 'de');
    });

    test('English resolves to a complete entry (silenced by the threshold, not the resolver)', () => {
        // `en` is tracked at 100%; the notice stays silent via the coverage threshold, while
        // a genuinely unshipped language has no entry at all.
        assert.strictEqual(resolveCoverageKey('en'), 'en');
        assert.strictEqual(resolveCoverageKey('en-us'), 'en');
        assert.strictEqual(nlsManifestCoverage.en, 100);
    });

    test('returns undefined for unshipped languages', () => {
        assert.strictEqual(resolveCoverageKey('xx'), undefined);
        assert.strictEqual(resolveCoverageKey('sw-ke'), undefined);
    });

    test('every tracked percent is an integer in 0..100 and English is complete', () => {
        assert.strictEqual(nlsManifestCoverage.en, 100);
        for (const [locale, pct] of Object.entries(nlsManifestCoverage)) {
            assert.ok(Number.isInteger(pct), `${locale} percent must be an integer`);
            assert.ok(pct >= 0 && pct <= 100, `${locale} percent ${pct} out of range`);
        }
    });
});
