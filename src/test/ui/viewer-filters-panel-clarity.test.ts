import * as assert from 'assert';
import { getFiltersPanelHtml } from '../../ui/viewer-search-filter/viewer-filters-panel-html';
import { getFiltersPanelScript } from '../../ui/viewer-search-filter/viewer-filters-panel-script';
import { getScopeFilterScript } from '../../ui/viewer-search-filter/viewer-scope-filter';

suite('Filters panel clarity (streams vs code location)', () => {
    test('HTML uses Log Streams, Code Location Scope, and scope narrowing wrapper ids', () => {
        const html = getFiltersPanelHtml();
        assert.ok(html.includes('Log Streams'));
        assert.ok(html.includes('Code Location Scope'));
        assert.ok(html.includes('id="scope-narrowing-block"'));
        assert.ok(html.includes('id="scope-no-context-hint"'));
        assert.ok(html.includes('Hide lines without file path'));
        assert.ok(html.includes('id="source-streams-intro"'));
        assert.ok(html.includes('id="scope-filter-hint"'));
    });

    test('filters panel script groups external streams with a titled subsection', () => {
        const script = getFiltersPanelScript();
        assert.ok(script.includes('External sidecars ('));
        assert.ok(script.includes('source-external-group-title'));
        assert.ok(script.includes('commitSourceFilterFromCheckboxes'));
        assert.ok(script.includes('getSourceFilterCheckboxes'));
    });

    test('filters panel script maps external: stream ids to readable labels', () => {
        const script = getFiltersPanelScript();
        assert.ok(script.includes('External · '));
        assert.ok(script.includes('External (sidecar log)'));
        assert.ok(script.includes("id.indexOf('external:') === 0"));
    });

    test('scope script toggles narrowing visibility when no active editor', () => {
        const script = getScopeFilterScript();
        assert.ok(script.includes('function updateScopeNarrowingVisibility'));
        assert.ok(script.includes('scope-narrowing-block'));
        assert.ok(script.includes('scope-no-context-hint'));
        assert.ok(script.includes('!scopeContext.activeFilePath && scopeLevel'));
    });

    test('scope script updates contextual hint and hooks recalcHeights', () => {
        const script = getScopeFilterScript();
        assert.ok(script.includes('function updateScopeFilterHint'));
        assert.ok(script.includes('scope-filter-hint'));
        assert.ok(script.includes('_origRecalcForScopeHint'));
    });
});
