import * as assert from 'node:assert';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';
import { getTokenStyles } from '../../ui/viewer-styles/viewer-styles-tokens';

/**
 * Pins the shared design-token :root layer (Saropa Dashboard Style Guide §3)
 * and its reconciliation with the canonical VS Code reference implementation
 * (saropa_lints dashboardChromeStyles.ts chromeTokens()). These assertions guard
 * the three reconciliations that are easy to silently regress: the 13px host-density
 * type base (NOT the 14px standalone base), the omission of --surface-0 in a webview,
 * and the --brand-glow 0.20 value. They also confirm the block is actually wired into
 * the full viewer stylesheet rather than defined in isolation.
 */
suite('ViewerTokenLayer', () => {
	test('token block defines the brand accent and 4px spacing scale', () => {
		const css = getTokenStyles();
		assert.ok(css.includes(':root'));
		assert.ok(css.includes('--brand: #f97316'));
		assert.ok(css.includes('--space-4: 16px'));
		assert.ok(css.includes('--radius-lg: 12px'));
	});

	test('type scale is anchored to the 13px VS Code host density, not the 14px standalone base', () => {
		const css = getTokenStyles();
		assert.ok(css.includes('--text-body: 13px'));
		assert.ok(css.includes('--text-h1: 22px'));
		assert.ok(css.includes('--text-kpi: 28px'));
		// The 14px standalone body size must not leak into the webview resolution.
		assert.ok(!css.includes('--text-body: 14px'));
	});

	test('--surface-0 is standalone-only and is not defined for the webview', () => {
		const css = getTokenStyles();
		// The page background and cards both use --surface-1 in VS Code; only the
		// raised steps differ. A defined --surface-0: would contradict the guide.
		assert.ok(!css.includes('--surface-0:'));
		assert.ok(css.includes('--surface-1: var(--vscode-editor-background)'));
	});

	test('brand-glow matches the canonical 0.20 chrome value', () => {
		const css = getTokenStyles();
		assert.ok(css.includes('--brand-glow: rgba(249, 115, 22, 0.20)'));
	});

	test('token :root is prepended into the full viewer stylesheet', () => {
		const full = getViewerStyles();
		// Wiring guard: the tokens must reach the webview, and lead the sheet so
		// every downstream rule can reference them.
		assert.ok(full.includes('--brand: #f97316'));
		assert.ok(full.trimStart().startsWith(':root') || full.indexOf(':root') < full.indexOf('.u-hidden'));
	});

	test('severity pill palette is defined once and consumed by BOTH pill surfaces', () => {
		// The fixed count-pill fills live in exactly one place (the --sev-* tokens). Both the
		// toolbar level pills (.dot-count-*) and the sidebar Logs pills (.sev-count-*) reference
		// those tokens, so the two surfaces cannot drift apart (they had, on 4 levels, before
		// this unification). Pin the values AND the cross-surface consumption.
		const tokens = getTokenStyles();
		const pairs: readonly [string, string][] = [
			['error', '#f44336'], ['warning', '#ff9800'], ['info', '#2196f3'],
			['performance', '#9c27b0'], ['todo', '#bdbdbd'], ['notice', '#00bcd4'],
			['debug', '#795548'], ['database', '#4caf50'],
		];
		const full = getViewerStyles();
		for (const [lvl, hex] of pairs) {
			assert.ok(
				new RegExp(`--sev-${lvl}:\\s*${hex};`).test(tokens),
				`--sev-${lvl} token should be defined as ${hex}`,
			);
			assert.ok(
				new RegExp(`\\.dot-count-${lvl}\\s*\\{\\s*background:\\s*var\\(--sev-${lvl}\\)`).test(full),
				`toolbar pill ${lvl} should consume var(--sev-${lvl})`,
			);
			// Sidebar names performance 'perf'; every other class matches the level name.
			const listClass = lvl === 'performance' ? 'perf' : lvl;
			assert.ok(
				new RegExp(`\\.sev-count-${listClass}\\s*\\{\\s*background:\\s*var\\(--sev-${lvl}\\)`).test(full),
				`sidebar pill ${lvl} should consume var(--sev-${lvl})`,
			);
		}
	});
});
