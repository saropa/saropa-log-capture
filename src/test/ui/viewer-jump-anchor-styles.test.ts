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

	test('syncJumpButtonInset still anchors controls from log-content rect', () => {
		const script = getViewerScript(5000);
		assert.ok(script.includes('syncJumpButtonInset'));
		assert.ok(script.includes('getBoundingClientRect'));
	});

	test('syncJumpButtonInset does not include removed log-compress-toggle anchoring', () => {
		const script = getViewerScript(5000);
		assert.ok(!script.includes("var logCompressToggle = document.getElementById('log-compress-toggle');"));
		assert.ok(!script.includes("if (logCompressToggle) {"));
		assert.ok(!script.includes("logCompressToggle.style.setProperty('position', 'fixed', 'important');"));
		assert.ok(!script.includes("logCompressToggle.style.setProperty('left'"));
		assert.ok(!script.includes("logCompressToggle.style.setProperty('top'"));
	});

	test('compress toggle click wiring is removed from viewer script', () => {
		const script = getViewerScript(5000);
		assert.ok(
			!script.includes("if (logCompressToggle) logCompressToggle.addEventListener('click', function(e) {"),
			'removed button must not keep listener wiring',
		);
		assert.ok(
			!script.includes("if (typeof toggleCompressLines === 'function') toggleCompressLines();"),
			'viewer script should not contain the removed button click handler branch',
		);
		assert.ok(
			!script.includes("if (jumpBtn) jumpBtn.addEventListener('click', function(e) {"),
			'false-positive guard: jump button wiring remains separate',
		);
	});

	test('layout sync is scheduled after paint via chained requestAnimationFrame', () => {
		const script = getViewerScript(5000);
		assert.ok(script.includes('requestAnimationFrame(function() { requestAnimationFrame(syncJumpButtonInset); })'));
	});
});

suite('ViewerLogContentMinimapLayout', () => {
	test('log-content uses flex 1 1 0% so the scroll area fills width beside the minimap', () => {
		const full = getViewerStyles();
		assert.ok(full.includes('flex: 1 1 0%'), '#log-content should consume remaining row space (not leave a dead gutter)');
		assert.ok(full.includes('align-items: stretch'), '#log-content-wrapper row stretches minimap height');
		assert.ok(full.includes('flex: 0 0 auto') && full.includes('.scrollbar-minimap'), 'minimap stays fixed-width column');
	});
});
