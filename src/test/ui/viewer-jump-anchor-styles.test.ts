import * as assert from 'node:assert';
import { getViewerStyles } from '../../ui/viewer-styles/viewer-styles';
import { getJumpScrollButtonAnchorStyles } from '../../ui/viewer-styles/viewer-styles-content';

suite('ViewerJumpAnchorStyles', () => {
	test('getJumpScrollButtonAnchorStyles pins jump buttons to wrapper right with mm and scrollbar vars', () => {
		const css = getJumpScrollButtonAnchorStyles();
		assert.ok(css.includes('#log-content-wrapper > #jump-btn'));
		assert.ok(css.includes('right: calc(var(--mm-w, 0px) + var(--scrollbar-w, 0px) + 8px)'));
		assert.ok(css.includes('!important'));
	});

	test('getViewerStyles includes jump anchor block last so placement cannot be overridden', () => {
		const full = getViewerStyles();
		const anchor = getJumpScrollButtonAnchorStyles().trim();
		assert.ok(full.includes(anchor), 'full viewer CSS should append jump anchor styles');
		assert.ok(
			full.lastIndexOf('#log-content-wrapper > #jump-btn') > full.indexOf('#jump-btn, #jump-top-btn'),
			'child-selector anchor should appear after base jump rules',
		);
	});
});
