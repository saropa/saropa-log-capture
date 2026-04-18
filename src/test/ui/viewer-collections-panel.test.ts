import * as assert from 'assert';
import { getCollectionsPanelHtml } from '../../ui/viewer-panels/viewer-collections-panel';
import { getCollectionsPanelScript } from '../../ui/viewer-panels/viewer-collections-panel-script';
import { getCollectionsPanelStyles } from '../../ui/viewer-styles/viewer-styles-collections';

suite('CollectionsPanel', () => {

    suite('HTML', () => {
        test('should contain the explainer banner', () => {
            const html = getCollectionsPanelHtml();
            assert.ok(html.includes('id="collections-explainer"'), 'explainer element must exist');
        });

        test('should have a dismiss button on the explainer', () => {
            const html = getCollectionsPanelHtml();
            assert.ok(html.includes('id="collections-explainer-close"'), 'explainer close button must exist');
        });

        test('should not contain a standalone create form', () => {
            /* Collections are created from the session list, not the panel */
            const html = getCollectionsPanelHtml();
            assert.ok(!html.includes('id="collections-create-btn"'), 'create button must not exist');
            assert.ok(!html.includes('id="collections-name-input"'), 'name input must not exist');
            assert.ok(!html.includes('id="collections-create-form"'), 'create form must not exist');
        });

        test('should contain merge controls', () => {
            const html = getCollectionsPanelHtml();
            assert.ok(html.includes('id="collections-merge-section"'), 'merge section must exist');
            assert.ok(html.includes('id="collections-merge-btn"'), 'merge button must exist');
        });

        test('should contain the collections list container', () => {
            const html = getCollectionsPanelHtml();
            assert.ok(html.includes('id="collections-list"'), 'list container must exist');
        });
    });

    suite('script', () => {
        test('should return non-empty JS string', () => {
            const js = getCollectionsPanelScript();
            assert.ok(js.length > 0, 'script must not be empty');
        });

        test('should track explainer dismissed state', () => {
            const js = getCollectionsPanelScript();
            assert.ok(js.includes('explainerDismissed'), 'should have dismissed flag');
        });

        test('should wire explainer close button', () => {
            const js = getCollectionsPanelScript();
            assert.ok(js.includes('collections-explainer-close'), 'should bind close button');
        });

        test('should not reference create form logic', () => {
            /* createCollectionWithName is still used by the session panel,
             * but the collections panel script should not send it */
            const js = getCollectionsPanelScript();
            assert.ok(!js.includes('createCollectionWithName'), 'should not send create message');
            assert.ok(!js.includes('createInProgress'), 'should not track create state');
            assert.ok(!js.includes('showCreateForm'), 'should not have create form toggle');
        });

        test('should handle rename and merge messages', () => {
            const js = getCollectionsPanelScript();
            assert.ok(js.includes('renameCollection'), 'should send rename message');
            assert.ok(js.includes('mergeCollections'), 'should send merge message');
        });
    });

    suite('styles', () => {
        test('should return non-empty CSS string', () => {
            const css = getCollectionsPanelStyles();
            assert.ok(css.length > 0, 'CSS must not be empty');
        });

        test('should style the explainer close button', () => {
            const css = getCollectionsPanelStyles();
            assert.ok(css.includes('.collections-explainer-close'), 'should have close button style');
            assert.ok(css.includes('.collections-explainer-row'), 'should have row layout style');
        });

        test('should not have orphaned create-section style', () => {
            const css = getCollectionsPanelStyles();
            assert.ok(!css.includes('.collections-create-section'), 'create section style must be removed');
            assert.ok(!css.includes('.collections-create-btn'), 'create button style must be removed');
        });

        test('should still style merge controls', () => {
            const css = getCollectionsPanelStyles();
            assert.ok(css.includes('.collections-merge-btn'), 'merge button style must exist');
            assert.ok(css.includes('.collections-merge-form'), 'merge form style must exist');
        });
    });
});
