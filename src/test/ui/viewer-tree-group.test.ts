/**
 * Tests for Flutter render-tree descendant folding (plan 052).
 *
 * Behavioral half: the detection predicates (isTreeHeaderText / isTreeChildText)
 * are self-contained regex tests with no external globals, so we eval the script
 * and exercise them against the real log shapes — including the I/flutter-prefixed
 * copy and prose guards. Wiring half: static-inspection that addToData consumes
 * the line, the renderer re-words the tooltip for treeGroup, and the detector is
 * reset at every state-clear boundary.
 */
import * as assert from 'node:assert';
import { getTreeIngestScript } from '../../ui/viewer/viewer-data-add-tree-ingest';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getStackHeaderRenderScript } from '../../ui/viewer/viewer-data-helpers-render-stack';
import { stringsWebview } from '../../l10n/strings-webview';

suite('Flutter render-tree descendant folding (plan 052)', () => {

    function loadPredicates(): {
        isHeader: (s: string) => boolean;
        isChild: (s: string) => boolean;
    } {
        // begin/append/tryIngest reference webview globals (allLines, …) but are
        // only DECLARED here, never called — declaring a fn that closes over an
        // undefined name is legal until invoked. We call only the predicates.
        const factory = new Function(
            getTreeIngestScript() +
            '\nreturn { isHeader: isTreeHeaderText, isChild: isTreeChildText };',
        );
        return factory();
    }

    suite('detection — behavioral', () => {
        test('recognizes the descendant-dump header', () => {
            const api = loadPredicates();
            assert.ok(
                api.isHeader('This RenderObject had the following descendants (showing up to depth 5):'),
                'depth-bounded descendants header must match',
            );
            assert.ok(
                api.isHeader('I/flutter ( 4323): This RenderObject had the following descendants (showing up to depth 5):'),
                'logcat-prefixed header must match (phrase searched anywhere)',
            );
        });

        test('recognizes indented child rows incl. the logcat-prefixed copy', () => {
            const api = loadPredicates();
            assert.ok(api.isChild('    child: RenderShrinkWrappingViewport#d51de'), 'plain child');
            assert.ok(api.isChild('      child 1: RenderMultiSliver#d4f50'), 'numbered child');
            assert.ok(api.isChild('        child with index 0: RenderIndexedSemantics#66f53'), 'indexed child');
            assert.ok(
                api.isChild('I/flutter ( 4323):       child with index 0: RenderIndexedSemantics#9f27d'),
                'I/flutter-prefixed child must match — detector runs before prefix strip',
            );
        });

        test('does not treat prose or the closing rule as a child', () => {
            const api = loadPredicates();
            assert.ok(!api.isChild('the child of the node is null'), 'prose with "child" not at row start');
            assert.ok(!api.isChild('child: missing indent'), 'unindented "child:" is not a tree row');
            assert.ok(!api.isChild('      ═══════════════════════'), 'closing rule ends the group, not a child');
        });
    });

    suite('wiring', () => {
        test('script exposes the ingest entry point and reset', () => {
            const s = getTreeIngestScript();
            assert.ok(s.includes('function tryIngestTreeLine('), 'ingest entry point must exist');
            assert.ok(s.includes('function resetTreeDetector('), 'reset must exist for clear/trim/marker');
            assert.ok(s.includes('treeGroup: true'), 'header must carry the treeGroup flag');
        });

        test('addToData consumes tree lines before the banner classifier', () => {
            const s = getViewerDataAddScript();
            // Compare CALL sites, not function definitions: the banner script is
            // concatenated before the tree script, so the defs are in the opposite
            // order. The distinctive first arg pins each call.
            const treeCall = s.indexOf('tryIngestTreeLine(html');
            const bannerCall = s.indexOf('classifyFlutterBannerLine(slp');
            assert.ok(treeCall >= 0, 'addToData must call tryIngestTreeLine');
            assert.ok(bannerCall >= 0, 'addToData must call classifyFlutterBannerLine');
            assert.ok(treeCall < bannerCall, 'tree ingest must run before banner classification');
            assert.ok(s.includes('resetTreeDetector()'), 'marker boundary must reset the tree detector');
        });

        test('reuses the stack-header item type so collapse machinery applies', () => {
            const s = getTreeIngestScript();
            assert.ok(/type: 'stack-header'/.test(s), 'header reuses stack-header for chevron/toggle');
            assert.ok(/type: 'stack-frame'/.test(s), 'children reuse stack-frame for height/visibility calc');
        });

        test('tree items carry category so a category toggle does not hide the tree', () => {
            // applyFilter() recomputes filteredOut from item.category on every
            // category toggle; undefined category → hidden. Pin category presence.
            const s = getTreeIngestScript();
            const matches = s.match(/category: category/g) || [];
            assert.ok(matches.length >= 2, 'both the tree header and child item must carry category');
        });

        test('renderStackHeader re-words the tooltip for a tree group via vt() keys', () => {
            const r = getStackHeaderRenderScript();
            assert.ok(r.includes('item.treeGroup'), 'render must branch on treeGroup');
            // The literal moved into the localizable registry; render now resolves
            // the treeHeader.* key family through vt().
            assert.ok(r.includes("viewer.treeHeader."), 'tree tooltip must use the localized treeHeader key family');
            assert.ok(/vt\(/.test(r), 'tooltips must resolve through the vt() webview-l10n helper');
        });

        test('the "Render tree" English source lives in the webview string registry', () => {
            assert.ok(
                stringsWebview['viewer.treeHeader.single'] === 'Render tree',
                'English source for the tree tooltip must be in strings-webview.ts, not hardcoded in render',
            );
            assert.ok(
                /\{0\}/.test(stringsWebview['viewer.treeHeader.collapsed']),
                'collapsed template must keep a {0} placeholder for the node count',
            );
        });
    });

});
