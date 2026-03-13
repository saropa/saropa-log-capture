import * as assert from 'assert';
import { getIntegrationsPanelHtml } from '../../ui/viewer-panels/viewer-integrations-panel-html';
import { getOptionsPanelHtml, getOptionsPanelScript } from '../../ui/viewer-panels/viewer-options-panel';

suite('ViewerOptionsPanel', () => {

    suite('getOptionsPanelHtml', () => {
        test('should return HTML for options panel', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="options-panel"'));
            assert.ok(html.includes('options-section-title'));
        });

        test('should include Reset and Reset extension settings buttons in Actions', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="reset-options-btn"'));
            assert.ok(html.includes('id="reset-settings-btn"'));
            assert.ok(html.includes('Reset to default'));
            assert.ok(html.includes('Reset extension settings'));
        });

        test('should include Integrations button and dedicated integrations view', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="options-open-integrations"'));
            assert.ok(html.includes('Integrations…'));
            assert.ok(html.includes('id="integrations-view"'));
            assert.ok(html.includes('id="integrations-back"'));
            assert.ok(html.includes('id="integrations-section"'));
        });
    });

    suite('getIntegrationsPanelHtml (Integrations screen)', () => {
        test('should return Integrations view with back button, intro, and section', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('id="integrations-view"'));
            assert.ok(html.includes('id="integrations-back"'));
            assert.ok(html.includes('integrations-title'));
            assert.ok(html.includes('id="integrations-section"'));
            assert.ok(html.includes('integrations-intro'));
            assert.ok(html.includes('Choose what to attach to each debug session'));
        });

        test('should include integration rows with data-adapter-id for sync', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('data-adapter-id="packages"'));
            assert.ok(html.includes('data-adapter-id="git"'));
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

        test('should define Integrations view switch (open/back) and sync', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('openIntegrationsView'));
            assert.ok(script.includes('closeIntegrationsView'));
            assert.ok(script.includes('integrationsViewOpen'));
            assert.ok(script.includes('syncIntegrationsUi'));
        });
    });
});
