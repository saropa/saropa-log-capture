import * as assert from 'node:assert';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';
import { getViewerScript } from '../../ui/viewer/viewer-script';

suite('ViewerJumpScrollPlacement', () => {
	test('getViewerStyles jump rules use fixed + opacity-only animation before JS sync', () => {
		const full = getViewerStyles();
		assert.ok(full.includes('#jump-btn, #jump-top-btn'));
		assert.ok(full.includes('position: fixed'));
		assert.ok(full.includes('jump-btn-fade-in'));
	});

	test('viewer script uses fixed positioning from #log-content getBoundingClientRect', () => {
		const script = getViewerScript(5000);
		assert.ok(script.includes('function syncJumpButtonInset'));
		assert.ok(script.includes("setProperty('position', 'fixed'"));
		assert.ok(script.includes('getBoundingClientRect'));
		assert.ok(script.includes('important'));
	});

	test('embedded viewer script contains no backticks (regression: TS template literal must not break)', () => {
		const script = getViewerScript(5000);
		assert.strictEqual(
			script.includes('`'),
			false,
			'a backtick inside the emitted string would terminate the TypeScript template literal',
		);
	});

	test('syncJumpButtonInset accounts for replay bar visibility nudge', () => {
		const script = getViewerScript(5000);
		assert.ok(script.includes('replay-bar-visible'));
		assert.ok(script.includes('replayNudge'));
	});

	test('layout sync is scheduled after paint via chained requestAnimationFrame', () => {
		const script = getViewerScript(5000);
		assert.ok(script.includes('requestAnimationFrame(function() { requestAnimationFrame(syncJumpButtonInset); })'));
	});
});
