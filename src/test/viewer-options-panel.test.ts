import * as assert from 'assert';
import { getOptionsPanelHtml, getOptionsPanelScript } from '../ui/viewer-options-panel';

suite('ViewerOptionsPanel', () => {

    suite('getOptionsPanelHtml', () => {
        test('should return HTML for options panel', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="options-panel"'));
            assert.ok(html.includes('options-section-title'));
        });

        test('should include Reset to default button in Actions', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="reset-options-btn"'));
            assert.ok(html.includes('Reset to default'));
            assert.ok(html.includes('Reset all options to default'));
        });
    });

    suite('getOptionsPanelScript', () => {
        test('should define resetOptionsToDefault and sync helpers', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('function resetOptionsToDefault'));
            assert.ok(script.includes('syncOptionsPanelUi'));
        });

        test('should reset display, layout, and audio defaults', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('setFontSize(13)'));
            assert.ok(script.includes('setLineHeight(2.0)'));
            assert.ok(script.includes('resetDecoDefaults'));
            assert.ok(script.includes('audioRateLimit = 2000'));
        });
    });
});
