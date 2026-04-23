import * as assert from 'node:assert';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';
import { getViewerScript } from '../../ui/viewer/viewer-script';

/**
 * Regression: resizing the VS Code window cropped the right side of
 * the log viewer because (a) scrollbar-width:none hid the horizontal
 * scrollbar in Chromium 130+ and (b) no window.resize fallback existed.
 */
suite('ViewerResizeLayout', () => {
	test('#log-content must NOT use scrollbar-width:none (Chromium 130+ hides h-scrollbar)', () => {
		const css = getViewerStyles();
		// Extract the #log-content block (up to the first closing brace)
		const logContentMatch = css.match(/#log-content\s*\{[^}]+\}/);
		assert.ok(logContentMatch, '#log-content rule must exist');
		// Strip CSS comments so the "Do NOT add scrollbar-width" warning doesn't false-positive
		const block = logContentMatch[0].replace(/\/\*[\s\S]*?\*\//g, '');
		assert.ok(
			!block.includes('scrollbar-width'),
			'#log-content must not set scrollbar-width — in Chromium 130+ it overrides ' +
			'::-webkit-scrollbar and hides the horizontal bar',
		);
	});

	test('vertical scrollbar is hidden via layout clip, not ::-webkit-scrollbar width', () => {
		const css = getViewerStyles();
		/* .log-content-clip wraps #log-content; overflow: hidden by default clips the
		   extra 10px on the right (where the scrollbar paints). body.scrollbar-visible
		   flips overflow to visible so the scrollbar re-enters view. The pseudo-element
		   width stays at 10px always — we don't rely on Chromium to repaint it. */
		assert.ok(
			css.includes('.log-content-clip {'),
			'.log-content-clip wrapper must be defined',
		);
		assert.ok(
			/\.log-content-clip\s*\{[^}]*overflow:\s*hidden/.test(css),
			'.log-content-clip must clip by default (hides vertical scrollbar)',
		);
		assert.ok(
			css.includes('body.scrollbar-visible .log-content-clip { overflow: visible; }'),
			'body.scrollbar-visible must lift the clip',
		);
		assert.ok(
			css.includes('#log-content::-webkit-scrollbar { width: 10px; height: 10px; }'),
			'pseudo-element width stays at 10px always — not toggled',
		);
		assert.ok(
			/#log-content\s*\{[^}]*width:\s*calc\(100% \+ 10px\)/.test(css),
			'#log-content must be 10px wider than its clip parent',
		);
	});

	test('viewer script adds window.resize listener as ResizeObserver fallback', () => {
		const script = getViewerScript(5000);
		assert.ok(
			script.includes("window.addEventListener('resize', onLogOrWrapResize)"),
			'window.resize must call the same handler as ResizeObserver',
		);
	});

	test('onLogOrWrapResize uses RAF deduplication to prevent layout thrashing', () => {
		const script = getViewerScript(5000);
		assert.ok(script.includes('var _resizeRaf = false'));
		assert.ok(script.includes('if (_resizeRaf) return'));
		assert.ok(script.includes('requestAnimationFrame'));
	});
});
