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

	test('::-webkit-scrollbar hides vertical (width:0) but shows horizontal (height:10px)', () => {
		const css = getViewerStyles();
		assert.ok(
			css.includes('#log-content::-webkit-scrollbar { width: 0; height: 10px; }'),
			'default: vertical hidden, horizontal 10px',
		);
		assert.ok(
			css.includes('body.scrollbar-visible #log-content::-webkit-scrollbar { width: 10px; height: 10px; }'),
			'opt-in: both scrollbars 10px',
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
