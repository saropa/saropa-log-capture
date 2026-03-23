import * as assert from 'node:assert';
import { getIntegrationsPanelHtml } from '../../ui/viewer-panels/viewer-integrations-panel-html';
import { getKeyboardShortcutsViewHtml } from '../../ui/viewer-panels/viewer-keyboard-shortcuts-html';
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

        test('should include Keyboard shortcuts button and shortcuts view', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="options-open-shortcuts"'));
            assert.ok(html.includes('Keyboard shortcuts…'));
            assert.ok(html.includes('id="shortcuts-view"'));
            assert.ok(html.includes('id="shortcuts-back"'));
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

        test('should include integrations search input', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('id="integrations-search"'));
            assert.ok(html.includes('placeholder="Search integrations…'));
        });

        test('should include integration rows with data-adapter-id for sync', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('data-adapter-id="packages"'));
            assert.ok(html.includes('data-adapter-id="git"'));
        });

        test('should render split preview/full description spans for safe toggle text updates', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('class="integrations-desc-preview"'));
            assert.ok(html.includes('class="integrations-desc-full options-filtered-hidden"'));
            assert.ok(!html.includes('data-preview="'));
            assert.ok(!html.includes('data-full="'));
        });
    });

    suite('getKeyboardShortcutsViewHtml (Keyboard shortcuts screen)', () => {
        test('should return shortcuts view with back button and power shortcuts table', () => {
            const html = getKeyboardShortcutsViewHtml();
            assert.ok(html.includes('id="shortcuts-view"'));
            assert.ok(html.includes('id="shortcuts-back"'));
            assert.ok(html.includes('Keyboard shortcuts'));
            assert.ok(html.includes('Power shortcuts (panel viewer)'));
            assert.ok(html.includes('Ctrl+F'));
            assert.ok(html.includes('Key commands (Command Palette)'));
        });
    });

    suite('getOptionsPanelScript', () => {
        test('should define resetOptionsToDefault and sync helpers', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('function resetOptionsToDefault'));
            assert.ok(script.includes('syncOptionsPanelUi'));
        });

        test('should not wire removed Options export button (export is footer Actions)', () => {
            const html = getOptionsPanelHtml();
            const script = getOptionsPanelScript();
            assert.ok(!html.includes('options-export-btn'), 'Export moved to footer Actions menu');
            assert.ok(!html.includes('Export current view'));
            assert.ok(!script.includes('options-export-btn'));
            assert.ok(!script.includes('openExportModal'));
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

        test('should include integrations helper wiring for filter and expand/collapse', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('function filterIntegrations(query)'));
            assert.ok(script.includes('function initIntegrationsOptionsHandlers()'));
            assert.ok(script.includes('initIntegrationsOptionsHandlers()'));
        });

        test('should define Keyboard shortcuts view switch (open/back)', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('openShortcutsView'));
            assert.ok(script.includes('closeShortcutsView'));
            assert.ok(script.includes('shortcutsViewOpen'));
        });
    });
});
