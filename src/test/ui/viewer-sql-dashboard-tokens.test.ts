import * as assert from 'node:assert';
import { getSqlQueryHistoryDashboardStyles } from '../../ui/viewer-styles/viewer-styles-sql-query-history-dashboard';

/**
 * Pins the SQL Query History dashboard's adoption of the shared design tokens and the Saropa
 * Dashboard Style Guide treatment. Guards against a silent regression back to raw --vscode-*
 * literals and magic pixels: the surface must keep the brand strip, the carded KPI stats on a
 * token surface, the brand-anchored chart bars, and the severity-token findings border.
 */
suite('ViewerSqlDashboardTokens', () => {
	const css = getSqlQueryHistoryDashboardStyles();

	test('dashboard header paints the 3px brand strip', () => {
		assert.ok(css.includes('.sql-qh-dashboard::before'));
		assert.ok(css.includes('linear-gradient(90deg, var(--brand)'));
	});

	test('KPI stat cards use the token surface, radius, and shadow', () => {
		assert.ok(css.includes('background: var(--surface-2)'));
		assert.ok(css.includes('border-radius: var(--radius-lg)'));
		assert.ok(css.includes('box-shadow: var(--shadow)'));
	});

	test('chart bars anchor on the brand accent over a token track', () => {
		assert.ok(css.includes('.sql-qh-chart-bar'));
		assert.ok(/\.sql-qh-chart-bar\s*\{[^}]*var\(--brand/s.test(css));
		assert.ok(/\.sql-qh-chart-track\s*\{[^}]*var\(--surface-3\)/s.test(css));
	});

	test('findings severity borders bind to the diagnostic tokens', () => {
		assert.ok(css.includes('border-left: 2px solid var(--accent-info)'));
		assert.ok(css.includes('border-left-color: var(--accent-warning)'));
		assert.ok(css.includes('var(--accent-critical)'));
	});

	test('no raw editor-background or panel-border literals remain', () => {
		// The whole point of the migration: this surface no longer hardcodes host tokens
		// at call sites — it goes through the design-token names instead.
		assert.ok(!css.includes('--vscode-panel-border'));
		assert.ok(!css.includes('--vscode-editorWidget-background'));
	});
});
