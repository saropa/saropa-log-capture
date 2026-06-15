import * as assert from 'node:assert';
import { getStandaloneFallbackPalette } from '../../../modules/export/html-export-fallback-palette';
import { getInteractiveStyles, getSimpleHtmlExportStyles } from '../../../modules/export/html-export-styles';

/**
 * Pins the §3.6 standalone fallback palette that the HTML log exports bake in so a
 * host-less report (opened in a browser) resolves the same canonical token names as
 * the in-IDE viewer surfaces. Guards the contract that is easy to silently regress:
 * the palette must NOT bind to --vscode-* (there is no host theme in a saved file),
 * dark must be the default with .light-theme overriding it, and the interactive
 * stylesheet must alias its local vars onto the canonical tokens rather than carry
 * the old ad-hoc hex palette.
 */
suite('HtmlExportFallbackPalette', () => {
	test('palette bakes the canonical token names with concrete values', () => {
		const css = getStandaloneFallbackPalette();
		assert.ok(css.includes(':root'));
		assert.ok(css.includes('--brand: #f97316'));
		assert.ok(css.includes('--surface-1: #0f172a')); // dark default
		assert.ok(css.includes('--text: #f1f5f9'));
		assert.ok(css.includes('--status-bad: #dc2626'));
		assert.ok(css.includes('--accent-warning: #d97706'));
	});

	test('dark is the default and .light-theme overrides the surfaces/text', () => {
		const css = getStandaloneFallbackPalette();
		assert.ok(css.includes('.light-theme'));
		assert.ok(css.includes('--surface-1: #ffffff')); // light override
		assert.ok(css.includes('--text: #0f172a'));
		// Dark surface must appear BEFORE the light override (dark is :root default).
		assert.ok(css.indexOf('#0f172a') < css.indexOf('.light-theme'));
	});

	test('palette is host-less — never binds to --vscode-* tokens', () => {
		const css = getStandaloneFallbackPalette();
		// A saved/shared report has no VS Code host theme; --vscode-* would not resolve.
		assert.ok(!css.includes('--vscode-'));
		assert.ok(css.includes('color-scheme: light dark'));
	});

	test('interactive stylesheet ships the palette and aliases onto canonical tokens', () => {
		const css = getInteractiveStyles();
		assert.ok(css.includes('--brand: #f97316')); // palette is prepended
		assert.ok(css.includes('--bg: var(--surface-1)'));
		assert.ok(css.includes('--error: var(--accent-critical)'));
		// The old ad-hoc hex palette must be gone.
		assert.ok(!css.includes('--bg: #1e1e1e'));
		assert.ok(!css.includes('--error: #f44'));
	});

	test('simple export annotation uses the muted token, not a literal green', () => {
		const css = getSimpleHtmlExportStyles();
		assert.ok(css.includes('color: var(--muted)'));
		assert.ok(!css.includes('#6a9955'));
	});
});
