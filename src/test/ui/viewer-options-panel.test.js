"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const viewer_integrations_panel_html_1 = require("../../ui/viewer-panels/viewer-integrations-panel-html");
const viewer_keyboard_shortcuts_html_1 = require("../../ui/viewer-panels/viewer-keyboard-shortcuts-html");
const viewer_options_panel_1 = require("../../ui/viewer-panels/viewer-options-panel");
const viewer_styles_options_1 = require("../../ui/viewer-styles/viewer-styles-options");
/** First braced block after a selector (no nested `{` in options CSS rules targeted here). */
function cssRuleBody(css, selectorPrefix) {
    const needle = selectorPrefix + ' {';
    const i = css.indexOf(needle);
    assert.ok(i >= 0, `expected ${selectorPrefix} in stylesheet`);
    const start = i + needle.length;
    const end = css.indexOf('}', start);
    assert.ok(end > start, `expected closing brace for ${selectorPrefix}`);
    return css.slice(start, end);
}
suite('ViewerOptionsPanel', () => {
    suite('getOptionsPanelHtml', () => {
        test('should return HTML for options panel', () => {
            const html = (0, viewer_options_panel_1.getOptionsPanelHtml)();
            assert.ok(html.includes('id="options-panel"'));
            assert.ok(html.includes('options-section-title'));
        });
        test('should include Reset and Reset extension settings buttons in Actions', () => {
            const html = (0, viewer_options_panel_1.getOptionsPanelHtml)();
            assert.ok(html.includes('id="reset-options-btn"'));
            assert.ok(html.includes('id="reset-settings-btn"'));
            assert.ok(html.includes('Reset to default'));
            assert.ok(html.includes('Reset extension settings'));
        });
        test('should include Integrations button and dedicated integrations view', () => {
            const html = (0, viewer_options_panel_1.getOptionsPanelHtml)();
            assert.ok(html.includes('id="options-open-integrations"'));
            assert.ok(html.includes('Integrations…'));
            assert.ok(html.includes('id="integrations-view"'));
            assert.ok(html.includes('id="integrations-back"'));
            assert.ok(html.includes('id="integrations-section"'));
        });
        test('should include Keyboard shortcuts button and shortcuts view', () => {
            const html = (0, viewer_options_panel_1.getOptionsPanelHtml)();
            assert.ok(html.includes('id="options-open-shortcuts"'));
            assert.ok(html.includes('Keyboard shortcuts…'));
            assert.ok(html.includes('id="shortcuts-view"'));
            assert.ok(html.includes('id="shortcuts-back"'));
        });
        test('Layout includes scroll map width select (workspace minimapWidth)', () => {
            const html = (0, viewer_options_panel_1.getOptionsPanelHtml)();
            assert.ok(html.includes('id="opt-minimap-width"'));
            assert.ok(html.includes('value="xsmall"') && html.includes('value="xlarge"'));
            assert.ok(html.includes('value="medium"'));
        });
    });
    suite('getOptionsStyles', () => {
        test('options Integrations / Keyboard shortcuts CTA buttons are not full panel width', () => {
            const css = (0, viewer_styles_options_1.getOptionsStyles)();
            const integrationsBtn = cssRuleBody(css, '.options-integrations-btn');
            assert.ok(!integrationsBtn.includes('width: 100%'), 'CTA buttons should size to content, not stretch like action rows');
        });
        test('options action buttons remain full width for reset controls', () => {
            const css = (0, viewer_styles_options_1.getOptionsStyles)();
            const action = cssRuleBody(css, '.options-action-btn');
            assert.ok(action.includes('width: 100%'), 'reset row should stay full width');
        });
    });
    suite('getIntegrationsPanelHtml (Integrations screen)', () => {
        test('should return Integrations view with back button, intro, and section', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('id="integrations-view"'));
            assert.ok(html.includes('id="integrations-back"'));
            assert.ok(html.includes('integrations-title'));
            assert.ok(html.includes('id="integrations-section"'));
            assert.ok(html.includes('integrations-intro'));
            assert.ok(html.includes('Choose session capture adapters'));
        });
        test('should include integrations search input', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('id="integrations-search"'));
            assert.ok(html.includes('placeholder="Search integrations…'));
        });
        test('should include integration rows with data-adapter-id for sync', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('data-adapter-id="explainWithAi"'));
            assert.ok(html.includes('data-adapter-id="packages"'));
            assert.ok(html.includes('data-adapter-id="git"'));
        });
        test('should render preview, hidden expanded block, and full description for toggle', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('class="integrations-desc-preview"'));
            assert.ok(html.includes('integrations-expanded-block options-filtered-hidden'));
            assert.ok(html.includes('class="integrations-desc-full"'));
            assert.ok(!html.includes('data-preview="'));
            assert.ok(!html.includes('data-full="'));
        });
        test('should nest perf and when-to-disable inside hidden expanded block', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('integrations-expanded-block options-filtered-hidden'));
            assert.ok(html.includes('class="integrations-note integrations-perf"'));
            assert.ok(html.includes('class="integrations-note integrations-when"'));
            assert.ok(!html.includes('integrations-expandable'));
        });
        test('should use more label, line-clamp row class, and no legacy Show more/less copy on Integrations HTML', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('integrations-desc-collapsible'));
            assert.match(html, /class="integrations-desc-toggle"[^>]*>\s*more\s*</);
            assert.ok(!html.includes('Show more'), 'Integrations view copy uses "more", not "Show more"');
            assert.ok(!html.includes('Show less'));
        });
        test('should show warning emoji in label for integrations with performance warnings', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            assert.ok(html.includes('integrations-perf-warning'));
            // Warning emoji appears in the label span, not in the perf note
            const labelMatch = html.match(/integrations-label[^<]*<\/span>/);
            assert.ok(labelMatch === null || !labelMatch[0].includes('Performance:'), 'Warning emoji should be on the label, not duplicated in perf note');
        });
        test('should use Title Case for all integration labels', () => {
            const html = (0, viewer_integrations_panel_html_1.getIntegrationsPanelHtml)();
            // Verify key labels are Title Cased
            assert.ok(html.includes('Code Coverage'));
            assert.ok(html.includes('Test Results'));
            assert.ok(html.includes('Terminal Output'));
            assert.ok(html.includes('Application / File Logs'));
            assert.ok(html.includes('Database Query Logs'));
            // Verify old lowercase forms are gone
            assert.ok(!html.includes('>Code coverage<'));
            assert.ok(!html.includes('>Test results<'));
            assert.ok(!html.includes('>Terminal output<'));
        });
    });
    suite('getKeyboardShortcutsViewHtml (Keyboard shortcuts screen)', () => {
        test('should return shortcuts view with back button and power shortcuts table', () => {
            const html = (0, viewer_keyboard_shortcuts_html_1.getKeyboardShortcutsViewHtml)();
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
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(script.includes('function resetOptionsToDefault'));
            assert.ok(script.includes('syncOptionsPanelUi'));
        });
        test('should not wire removed Options export button (export is footer Actions)', () => {
            const html = (0, viewer_options_panel_1.getOptionsPanelHtml)();
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(!html.includes('options-export-btn'), 'Export moved to footer Actions menu');
            assert.ok(!html.includes('Export current view'));
            assert.ok(!script.includes('options-export-btn'));
            assert.ok(!script.includes('openExportModal'));
        });
        test('should reset display, layout, and audio defaults', () => {
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(script.includes('setFontSize(13)'));
            assert.ok(script.includes('setLineHeight(2.0)'));
            assert.ok(script.includes('resetDecoDefaults'));
            assert.ok(script.includes('audioRateLimit = 2000'));
        });
        test('should define Integrations view switch (open/back) and sync', () => {
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(script.includes('openIntegrationsView'));
            assert.ok(script.includes('closeIntegrationsView'));
            assert.ok(script.includes('integrationsViewOpen'));
            assert.ok(script.includes('syncIntegrationsUi'));
        });
        test('should include integrations helper wiring for filter and expand/collapse', () => {
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(script.includes('function filterIntegrations(query)'));
            assert.ok(script.includes('function initIntegrationsOptionsHandlers()'));
            assert.ok(script.includes('initIntegrationsOptionsHandlers()'));
        });
        test('should toggle Integrations description with more/less labels in embedded helper', () => {
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(script.includes("nextExpanded ? 'less' : 'more'"), 'Expand/collapse uses short more/less labels');
            assert.ok(script.includes('.integrations-expanded-block'), 'Toggles expanded block that holds full text and notes');
        });
        test('should define Keyboard shortcuts view switch (open/back)', () => {
            const script = (0, viewer_options_panel_1.getOptionsPanelScript)();
            assert.ok(script.includes('openShortcutsView'));
            assert.ok(script.includes('closeShortcutsView'));
            assert.ok(script.includes('shortcutsViewOpen'));
        });
    });
});
//# sourceMappingURL=viewer-options-panel.test.js.map