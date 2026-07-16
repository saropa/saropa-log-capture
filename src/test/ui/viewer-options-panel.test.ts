import * as assert from 'node:assert';
import { getIntegrationsPanelHtml } from '../../ui/viewer-panels/viewer-integrations-panel-html';
import { getSuiteSuggestionsScript } from '../../ui/viewer/viewer-suite-suggestions-script';
import { getKeyboardShortcutsViewHtml } from '../../ui/viewer-panels/viewer-keyboard-shortcuts-html';
import { getOptionsPanelHtml, getOptionsPanelScript } from '../../ui/viewer-panels/viewer-options-panel';
import { getOptionsStyles } from '../../ui/viewer-styles/viewer-styles-options';

/** First braced block after a selector (no nested `{` in options CSS rules targeted here). */
function cssRuleBody(css: string, selectorPrefix: string): string {
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

        test('Layout includes scroll map width select (workspace minimapWidth)', () => {
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="opt-minimap-width"'));
            assert.ok(html.includes('value="xsmall"') && html.includes('value="xlarge"'));
            assert.ok(html.includes('value="medium"'));
        });

        test('Layout has Line numbers checkbox (renamed from "Counter") under the Layout section', () => {
            // Why: the user-facing label was renamed Counter → Line numbers and the row moved
            // from Display to Layout. The id `opt-deco-counter` is preserved so existing event
            // wiring (viewer-options-events.ts, resetOptionsToDefault, syncOptionsPanelUi) keeps
            // working. This test pins both the new label and the new placement so a regression
            // (re-adding "Counter" or moving it back into Display) fails fast.
            const html = getOptionsPanelHtml();
            assert.ok(html.includes('id="opt-deco-counter"'), 'id must be preserved for event wiring');
            assert.ok(html.includes('<span>Line numbers</span>'), 'label must read "Line numbers", not "Counter"');
            assert.ok(!html.includes('<span>Counter</span>'), 'old "Counter" label must be gone');
            // Confirm the row sits in Layout, not Display: slice from the Layout section title to
            // the next section title and assert the id appears in that window.
            const layoutStart = html.indexOf('Layout</h3>');
            assert.ok(layoutStart > 0, 'Layout section must exist');
            const nextSection = html.indexOf('options-section-title', layoutStart + 1);
            const layoutSlice = html.slice(layoutStart, nextSection > 0 ? nextSection : undefined);
            assert.ok(layoutSlice.includes('id="opt-deco-counter"'),
                '"Line numbers" row must live in the Layout section, not Display');
        });
    });

    suite('getOptionsStyles', () => {
        test('options Integrations / Keyboard shortcuts CTA buttons are not full panel width', () => {
            const css = getOptionsStyles();
            const integrationsBtn = cssRuleBody(css, '.options-integrations-btn');
            assert.ok(
                !integrationsBtn.includes('width: 100%'),
                'CTA buttons should size to content, not stretch like action rows',
            );
        });

        test('options action buttons size to content (shared across panels)', () => {
            const css = getOptionsStyles();
            const action = cssRuleBody(css, '.options-action-btn');
            assert.ok(!action.includes('width: 100%'), 'action buttons should size to content, not stretch');
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
            assert.ok(html.includes('Choose session capture adapters'));
        });

        test('should include integrations search input', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('id="integrations-search"'));
            assert.ok(html.includes('placeholder="Search integrations…'));
        });

        test('should include integration rows with data-adapter-id for sync', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('data-adapter-id="explainWithAi"'));
            assert.ok(html.includes('data-adapter-id="packages"'));
            assert.ok(html.includes('data-adapter-id="git"'));
        });

        test('should render preview, hidden expanded block, and full description for toggle', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('class="integrations-desc-preview"'));
            assert.ok(html.includes('integrations-expanded-block options-filtered-hidden'));
            assert.ok(html.includes('class="integrations-desc-full"'));
            assert.ok(!html.includes('data-preview="'));
            assert.ok(!html.includes('data-full="'));
        });

        test('should nest perf and when-to-disable inside hidden expanded block', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('integrations-expanded-block options-filtered-hidden'));
            assert.ok(html.includes('class="integrations-note integrations-perf"'));
            assert.ok(html.includes('class="integrations-note integrations-when"'));
            assert.ok(!html.includes('integrations-expandable'));
        });

        test('should use div (not p) for desc blocks to avoid browser auto-close nesting bugs', () => {
            const html = getIntegrationsPanelHtml();
            // <p> inside <p> (even via <span>) causes browsers to auto-close the outer <p>,
            // ejecting child elements and breaking expand/collapse. Verify divs are used.
            assert.ok(!/<p\s[^>]*class="[^"]*integrations-desc/.test(html),
                'Description wrapper must be <div>, not <p> — nested <p> breaks the DOM');
            assert.ok(!/<p\s[^>]*class="[^"]*integrations-note/.test(html),
                'Perf/when notes must be <div>, not <p> — would break out of parent <span>');
            assert.ok(html.includes('<div class="integrations-expanded-block'),
                'Expanded block must be <div> to contain block-level children');
        });

        test('should use more label, line-clamp row class, and no legacy Show more/less copy on Integrations HTML', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('integrations-desc-collapsible'));
            assert.match(html, /class="integrations-desc-toggle"[^>]*>\s*more\s*</);
            assert.ok(!html.includes('Show more'), 'Integrations view copy uses "more", not "Show more"');
            assert.ok(!html.includes('Show less'));
        });

        test('should render Saropa companion extensions as list rows (no separate prose block)', () => {
            const html = getIntegrationsPanelHtml();
            // Companion extensions now live inside the integration list as rows with a
            // Marketplace link, interleaved alphabetically — not a heading/prose block on top.
            assert.ok(html.includes('integrations-companion-item'),
                'companion extensions must render as integration list rows');
            assert.ok(html.includes('Saropa Lints'));
            assert.ok(html.includes('Saropa Drift Advisor'));
            assert.ok(html.includes('View in Marketplace'),
                'an absent companion shows a Marketplace link (test env has none installed)');
            assert.ok(!html.includes('integrations-companion-section'),
                'the old companion prose block must be gone');
            assert.ok(!html.includes('Companion extensions'),
                'the companion heading/intro copy must not push down the real toggles');
        });

        test('should give companion rows a disabled status checkbox + live-toggle data attributes', () => {
            const html = getIntegrationsPanelHtml();
            // Companion rows are <label> + checkbox like adapters (no checkbox-less variant to
            // special-case); the checkbox is a disabled status indicator with NO data-adapter-id,
            // so it never enters the adapter payload. The host setCompanionInstalled message finds
            // rows by data-companion-id and flips is-installed + checkbox from the data-* labels.
            assert.match(html, /<label class="integrations-row integrations-companion-item[^"]*"/,
                'companion rows must be <label> like adapter rows');
            assert.match(html, /id="int-companion-[^"]+"[^>]*disabled/, 'companion checkbox must be disabled');
            assert.ok(!/int-companion-[^"]*"[^>]*data-adapter-id/.test(html),
                'companion checkbox must not carry data-adapter-id');
            assert.ok(html.includes('data-companion-id="') && html.includes('data-installed-title="'), 'rows expose data-companion-id + data-* labels for live toggling');
        });

        test('should place companion rows alphabetically after their adapter neighbors', () => {
            const html = getIntegrationsPanelHtml();
            // Both companion rows are checkbox-less; the suite install link is a footer below the list.
            assert.ok(html.indexOf('integrations-companion-item') > html.indexOf('id="integrations-section"'),
                'companion rows sit inside the list section');
            assert.ok(html.includes('integrations-suite-footer'),
                'install-all link is a footer below the list');
            assert.ok(html.indexOf('integrations-suite-footer') > html.indexOf('integrations-companion-item'),
                'suite footer follows the list rows');
        });

        test('should show warning emoji in label for integrations with performance warnings', () => {
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('integrations-perf-warning'));
            // Warning emoji appears in the label span, not in the perf note
            const labelMatch = html.match(/integrations-label[^<]*<\/span>/);
            assert.ok(labelMatch === null || !labelMatch[0].includes('Performance:'),
                'Warning emoji should be on the label, not duplicated in perf note');
        });

        test('should keep the suggestions container but no companion-issues container', () => {
            // Owner ruling 2026-07-09: the Options screen is a configuration surface (toggles only).
            // The "Issues found by your companion tools" diagnostics list was removed and must not
            // return to any Options view; suggestions (which resolve to a toggle) stay.
            const html = getIntegrationsPanelHtml();
            assert.ok(html.includes('id="integrations-suite-suggestions"'),
                'suggested-integrations container must remain');
            assert.ok(!html.includes('integrations-suite-issues'),
                'companion-tool diagnostics container must not be re-added to the Options view');
        });

        test('should use Title Case for all integration labels', () => {
            const html = getIntegrationsPanelHtml();
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

    suite('getSuiteSuggestionsScript (Integrations badge + suggestions block)', () => {
        test('should use the suiteSuggestions message pair and carry no issues payload', () => {
            // Pins the rename from the removed issues feature: the request/reply pair is
            // requestSuiteSuggestions -> suiteSuggestions and the payload has no issuesHtml,
            // so a stale host or webview half of the old protocol fails fast here.
            const script = getSuiteSuggestionsScript();
            assert.ok(script.includes("postMessage({ type: 'requestSuiteSuggestions' })"),
                'webview must request with type requestSuiteSuggestions');
            assert.ok(script.includes("msg.type !== 'suiteSuggestions'"),
                'reply handler must gate on type suiteSuggestions');
            assert.ok(script.includes('msg.suggestionsHtml'),
                'handler must read the suggestions block payload');
            assert.ok(!script.includes('issuesHtml'),
                'the removed companion-issues payload must not be referenced');
            assert.ok(!script.includes('requestSuiteIssues'),
                'the old message name must be fully gone from the webview script');
        });
    });

    suite('getKeyboardShortcutsViewHtml (Keyboard shortcuts screen)', () => {
        test('should return shortcuts view with back button and grouped shortcuts tables', () => {
            const html = getKeyboardShortcutsViewHtml();
            assert.ok(html.includes('id="shortcuts-view"'));
            assert.ok(html.includes('id="shortcuts-back"'));
            assert.ok(html.includes('Keyboard shortcuts'));
            /* Grouped sections replaced the single "Power shortcuts" table */
            assert.ok(html.includes('General'));
            assert.ok(html.includes('Navigation'));
            assert.ok(html.includes('Panels'));
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
            // Reset uses the settings-driven defaults (logFontSizeDefault / logLineHeightDefault)
            // seeded by setLogFontSize / setLogLineHeight host messages, with literal fallbacks
            // (13 / 1.1) for the case where the settings message was never received.
            assert.ok(script.includes('logFontSizeDefault'));
            assert.ok(script.includes('logLineHeightDefault'));
            assert.ok(script.includes('setFontSize('));
            assert.ok(script.includes('setLineHeight('));
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

        test('should define applyCompanionInstalled for live install-state toggling', () => {
            const script = getOptionsPanelScript();
            // The host setCompanionInstalled message drives this: it flips is-installed + checkbox
            // per data-companion-id so installing/removing a companion updates the row without reload.
            assert.ok(script.includes('function applyCompanionInstalled(states)'));
            assert.ok(script.includes('data-companion-id'));
            assert.ok(script.includes("classList.toggle('is-installed'"));
        });

        test('should toggle Integrations description with more/less labels in embedded helper', () => {
            const script = getOptionsPanelScript();
            assert.ok(
                script.includes("nextExpanded ? 'less' : 'more'"),
                'Expand/collapse uses short more/less labels',
            );
            assert.ok(
                script.includes('.integrations-expanded-block'),
                'Toggles expanded block that holds full text and notes',
            );
        });

        test('outside-click closer excludes BOTH opener icons (gear and Integrations plug)', () => {
            // Regression: the Integrations icon (ib-integrations) also opens the options panel
            // (switched to the Integrations view). If the click-away dismiss only excludes the
            // gear (ib-options), the same click that opens via the plug bubbles to document and
            // immediately closes the panel — it opens blank. Both icons must be treated as openers.
            const script = getOptionsPanelScript();
            assert.ok(script.includes("getElementById('ib-options')"), 'gear must be an excluded opener');
            assert.ok(
                script.includes("getElementById('ib-integrations')"),
                'Integrations plug must be an excluded opener so its open-click is not treated as outside',
            );
        });

        test('should define Keyboard shortcuts view switch (open/back)', () => {
            const script = getOptionsPanelScript();
            assert.ok(script.includes('openShortcutsView'));
            assert.ok(script.includes('closeShortcutsView'));
            assert.ok(script.includes('shortcutsViewOpen'));
        });

        test('renderSeverityKeywordsDisplay uses truthiness guard, not typeof, for null safety', () => {
            const script = getOptionsPanelScript();
            // The variable is initialized to null — a typeof !== 'undefined' guard
            // would pass for null (typeof null === 'object') and crash on property access.
            assert.ok(
                script.includes('currentSeverityKeywords = null'),
                'currentSeverityKeywords must be initialized to null',
            );
            assert.ok(
                script.includes('(currentSeverityKeywords && currentSeverityKeywords[lv.key])'),
                'Must use truthiness check, not typeof, to guard null property access',
            );
            assert.ok(
                !script.includes("typeof currentSeverityKeywords !== 'undefined' && currentSeverityKeywords["),
                'Must NOT use typeof guard before bracket access on a null-initialized variable',
            );
        });
    });
});
