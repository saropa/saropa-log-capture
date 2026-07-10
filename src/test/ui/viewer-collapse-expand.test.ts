import * as assert from 'node:assert';
import { getViewerDataAddStackGroupLearningAndToggleScript }
    from '../../ui/viewer/viewer-data-add-stack-group-learning-and-toggle';
import { getViewerScriptMessageHandler }
    from '../../ui/viewer/viewer-script-messages';

suite('Collapse / expand all sections', () => {

    suite('viewer-data-add-stack-group-learning-and-toggle', () => {
        const script = getViewerDataAddStackGroupLearningAndToggleScript();

        test('should define collapseAllSections function', () => {
            assert.ok(
                script.includes('function collapseAllSections()'),
                'script must contain collapseAllSections function',
            );
        });

        test('should define expandAllSections function', () => {
            assert.ok(
                script.includes('function expandAllSections()'),
                'script must contain expandAllSections function',
            );
        });

        test('expandAllSections should set collapsed to false on groupHeaderMap entries', () => {
            const expandBlock = script.slice(
                script.indexOf('function expandAllSections()'),
                script.indexOf('function expandAllSections()') + 500,
            );
            assert.ok(
                expandBlock.includes('.collapsed = false'),
                'expandAllSections should set collapsed = false',
            );
        });

        test('expandAllSections should set contCollapsed to false on contHeaderMap entries', () => {
            const expandBlock = script.slice(
                script.indexOf('function expandAllSections()'),
                script.indexOf('function expandAllSections()') + 500,
            );
            assert.ok(
                expandBlock.includes('.contCollapsed = false'),
                'expandAllSections should set contCollapsed = false',
            );
        });

        test('expandAllSections should NOT reopen SQL drilldowns', () => {
            /* SQL drilldowns are user-initiated; expand-all should not force them open. */
            const expandBlock = script.slice(
                script.indexOf('function expandAllSections()'),
                script.indexOf('function expandAllSections()') + 500,
            );
            assert.ok(
                !expandBlock.includes('sqlRepeatDrilldownOpen'),
                'expandAllSections must not touch sqlRepeatDrilldownOpen',
            );
        });

        test('expandAllSections should call recalcAndRender or recalcHeights+renderViewport', () => {
            /* Slice to the next function rather than a fixed offset: expandAllSections
               grew (it now expands Flutter banner groups too), so a fixed +500 window
               clipped the re-render call at the end of the body. */
            const expandBlock = script.slice(
                script.indexOf('function expandAllSections()'),
                script.indexOf('function toggleStackGroup'),
            );
            assert.ok(
                expandBlock.includes('recalcAndRender') || expandBlock.includes('recalcHeights'),
                'expandAllSections should trigger a re-render',
            );
        });

        test('toggleStackGroup should be two-state (no preview cycle)', () => {
            /* A single click should fully open or fully close — the old
             * 3-state cycle (collapsed → preview → expanded) caused dead
             * clicks where nothing visually changed. */
            const toggleBlock = script.slice(
                script.indexOf('function toggleStackGroup'),
                script.indexOf('function toggleStackGroup') + 600,
            );
            assert.ok(
                !toggleBlock.includes("header.collapsed = 'preview'"),
                'toggleStackGroup must not cycle through preview state',
            );
            assert.ok(
                toggleBlock.includes('header.collapsed = true') && toggleBlock.includes('header.collapsed = false'),
                'toggleStackGroup must toggle between true and false only',
            );
        });
    });

    suite('viewer-script-messages dispatch', () => {
        const handler = getViewerScriptMessageHandler();

        test('should dispatch triggerCollapseAllSections to collapseAllSections', () => {
            assert.ok(
                handler.includes("case 'triggerCollapseAllSections'"),
                'message handler must handle triggerCollapseAllSections',
            );
            assert.ok(
                handler.includes('collapseAllSections()'),
                'triggerCollapseAllSections must call collapseAllSections()',
            );
        });

        test('should dispatch triggerExpandAllSections to expandAllSections', () => {
            assert.ok(
                handler.includes("case 'triggerExpandAllSections'"),
                'message handler must handle triggerExpandAllSections',
            );
            assert.ok(
                handler.includes('expandAllSections()'),
                'triggerExpandAllSections must call expandAllSections()',
            );
        });

        test('palette collapse/expand must sync the toolbar button icon', () => {
            /* The collapse/expand controls moved into the viewer toolbar. When the
               palette commands fire instead of the button, they MUST update the
               toolbar button state so its icon does not go stale — via
               window.__setAllSectionsCollapsed(true/false). */
            assert.ok(
                handler.includes('__setAllSectionsCollapsed(true)'),
                'triggerCollapseAllSections must sync the toolbar button to collapsed',
            );
            assert.ok(
                handler.includes('__setAllSectionsCollapsed(false)'),
                'triggerExpandAllSections must sync the toolbar button to expanded',
            );
        });
    });
});
