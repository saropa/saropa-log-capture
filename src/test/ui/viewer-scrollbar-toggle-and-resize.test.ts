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
    test('applyScrollbarVisible cycles display:none to tear down the scroll container', () => {
        const script = getViewerScript(5000);
        /* Chromium caches the composited ::-webkit-scrollbar layer per scroll container.
           Cycling overflow-y works for 0 -> 10px (layer created fresh) but NOT for 10px -> 0
           (cached layer stays on screen). applyScrollbarVisible must set display:none briefly
           so the render tree is torn down and ::-webkit-scrollbar is re-read on rebuild. */
        assert.ok(script.includes('function applyScrollbarVisible'), 'function must exist');
        assert.ok(script.includes("display = 'none'"), 'must set display:none to tear down scroll container');
        assert.ok(script.includes('offsetHeight'), 'must read offsetHeight to force synchronous reflow');
        assert.ok(script.includes('logEl.scrollTop = sT'), 'must restore scrollTop — display:none resets it to 0');
    });

    test('applyScrollbarVisible guards the scrollTop restore so the context menu stays open', () => {
        const script = getViewerScript(5000);
        /* The "Scroll map & scrollbar" submenu is designed to stay open across toggles
           (the user may flip multiple settings in one session). Restoring scrollTop after
           display:none fires a scroll event on #log-content — without these flags the
           context-menu scroll listener would close the menu and the virtual-scroll render
           handler would run an unnecessary pass. */
        const apply = script.indexOf('function applyScrollbarVisible');
        const end = script.indexOf('syncJumpButtonInset();', apply);
        assert.ok(apply >= 0 && end > apply, 'applyScrollbarVisible body must be locatable');
        const body = script.slice(apply, end);
        assert.ok(body.includes('window.setProgrammaticScroll()'), 'must flag programmatic scroll so context menu stays open');
        assert.ok(body.includes('suppressScroll = true'), 'must suppress virtual-scroll handler during the restore');
        assert.ok(body.includes('suppressScroll = false'), 'must clear suppressScroll after the restore');
    });

    test('scrollbarVisible message handler uses applyScrollbarVisible', () => {
        const script = getViewerScript(5000);
        assert.ok(script.includes('applyScrollbarVisible(msg.show'), 'round-trip handler must use applyScrollbarVisible');
    });

    test('toggle-show-scrollbar calls applyScrollbarVisible before postBool', () => {
        const script = getContextMenuScript();
        /* Before fix: postBool was called without setting the class, so syncContextMenuToggles
           (inside postBool) read stale state and the checkbox never toggled.
           After fix: applyScrollbarVisible toggles the class AND forces a Chromium scrollbar
           re-render before postBool so the checkbox and the scrollbar both update immediately. */
        const apply = script.indexOf('applyScrollbarVisible(nextSb)');
        const postBool = script.indexOf("postBool('setShowScrollbar', nextSb)");
        assert.ok(apply >= 0, 'must call applyScrollbarVisible for optimistic update + reflow');
        assert.ok(postBool >= 0, 'must still post the value to the extension');
        assert.ok(apply < postBool, 'applyScrollbarVisible must happen BEFORE postBool');
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
