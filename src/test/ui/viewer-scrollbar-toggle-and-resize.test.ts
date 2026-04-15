/**
 * Tests for:
 * 1. Scrollbar toggle optimistic body class update in the context menu action script
 * 2. Minimap drag-to-resize: HTML element, JS script inclusion, and bounds constants
 *
 * These cover the before → after behavior for the "Show native scrollbar" toggle fix
 * and the new drag-to-resize feature.
 */
import * as assert from 'node:assert';
import { getContextMenuScript } from '../../ui/viewer-context-menu/viewer-context-menu';
import { getScrollbarMinimapScript, getScrollbarMinimapHtml } from '../../ui/viewer/viewer-scrollbar-minimap';
import { getViewerScript } from '../../ui/viewer/viewer-script';

suite('ScrollbarToggleOptimisticUpdate', () => {
    test('toggle-show-scrollbar applies body class before postBool', () => {
        const script = getContextMenuScript();
        /* Before fix: postBool was called without setting the class, so syncContextMenuToggles
           (inside postBool) read stale state and the checkbox never toggled.
           After fix: classList.toggle happens before postBool. */
        const classToggle = script.indexOf("document.body.classList.toggle('scrollbar-visible', nextSb)");
        const postBool = script.indexOf("postBool('setShowScrollbar', nextSb)");
        assert.ok(classToggle >= 0, 'must optimistically toggle scrollbar-visible class');
        assert.ok(postBool >= 0, 'must still post the value to the extension');
        assert.ok(classToggle < postBool, 'class toggle must happen BEFORE postBool so syncContextMenuToggles reads correct state');
    });

    test('toggle-show-scrollbar calls syncJumpButtonInset before postBool', () => {
        const script = getContextMenuScript();
        /* Jump buttons must reposition when the scrollbar appears/disappears. */
        const jumpSync = script.indexOf('syncJumpButtonInset()');
        const postBool = script.indexOf("postBool('setShowScrollbar', nextSb)");
        assert.ok(jumpSync >= 0, 'must call syncJumpButtonInset');
        assert.ok(jumpSync < postBool, 'jump button sync must happen before posting to extension');
    });
});

suite('MinimapResizeHandle', () => {
    test('minimap HTML includes the resize handle element', () => {
        const html = getScrollbarMinimapHtml();
        assert.ok(html.includes('id="minimap-resize-handle"'), 'resize handle element must exist');
        assert.ok(html.includes('class="minimap-resize-handle"'), 'resize handle must have its CSS class');
        assert.ok(html.includes('Drag to resize'), 'handle must have a descriptive title attribute');
    });

    test('resize handle is before the minimap in the DOM (left edge)', () => {
        const html = getScrollbarMinimapHtml();
        const handlePos = html.indexOf('minimap-resize-handle');
        const minimapPos = html.indexOf('scrollbar-minimap"');
        assert.ok(handlePos < minimapPos, 'handle must be a preceding sibling so it sits on the left edge');
    });

    test('minimap script includes resize initialization', () => {
        const script = getScrollbarMinimapScript();
        assert.ok(script.includes('function initMinimapResize'), 'resize init function must be defined');
        assert.ok(script.includes('MM_RESIZE_MIN_PX'), 'min width constant must be defined');
        assert.ok(script.includes('MM_RESIZE_MAX_PX'), 'max width constant must be defined');
    });

    test('resize script uses pointer capture for reliable drag tracking', () => {
        const script = getScrollbarMinimapScript();
        assert.ok(script.includes('setPointerCapture'), 'must capture pointer to avoid losing events');
        assert.ok(script.includes('lostpointercapture'), 'must handle lost capture as a drag-end');
    });

    test('resize script posts final width to extension for persistence', () => {
        const script = getScrollbarMinimapScript();
        assert.ok(
            script.includes("vscodeApi.postMessage({ type: 'setMinimapCustomPx'"),
            'must post setMinimapCustomPx on drag end for workspace-state persistence',
        );
    });

    test('resize script adds and removes body.mm-resizing class', () => {
        const script = getScrollbarMinimapScript();
        assert.ok(script.includes("classList.add('mm-resizing')"), 'must add mm-resizing on drag start');
        assert.ok(script.includes("classList.remove('mm-resizing')"), 'must remove mm-resizing on drag end');
    });

    test('initMinimapResize is called from initMinimap', () => {
        const script = getScrollbarMinimapScript();
        assert.ok(
            script.includes('initMinimapResize'),
            'initMinimap must call initMinimapResize',
        );
    });
});

suite('MinimapWidthPxMessageHandler', () => {
    test('viewer script handles minimapWidthPx message type', () => {
        const script = getViewerScript(5000);
        assert.ok(
            script.includes("case 'minimapWidthPx'"),
            'message handler must include minimapWidthPx case',
        );
    });

    test('handleMinimapWidthPx function is defined in the minimap script', () => {
        const script = getScrollbarMinimapScript();
        assert.ok(
            script.includes('function handleMinimapWidthPx'),
            'state module must define handleMinimapWidthPx',
        );
    });

    test('handleMinimapWidthPx validates bounds before applying', () => {
        const script = getScrollbarMinimapScript();
        /* The handler must reject values outside [20, 160] to prevent
           a malformed message from collapsing or stretching the minimap. */
        assert.ok(script.includes('msg.px < 20'), 'must reject widths below 20');
        assert.ok(script.includes('msg.px > 160'), 'must reject widths above 160');
    });
});
