import * as assert from 'node:assert';
import { getViewerBodyHtml } from '../../ui/provider/viewer-content-body';
import { getTroubleDetailScript } from '../../ui/viewer-search-filter/viewer-trouble-detail';
import { getTroubleDetailStyles } from '../../ui/viewer-styles/viewer-styles-trouble-detail';
import { getScrollbarMinimapHtml } from '../../ui/viewer/viewer-scrollbar-minimap';
import { getViewerScript } from '../../ui/viewer/viewer-script';

/**
 * Drag-to-resize handle for the Trouble Mode error-report rail (precedent:
 * viewer-scrollbar-minimap-resize.ts / MinimapResizeHandle suite in
 * viewer-scrollbar-toggle-and-resize.test.ts). Before this, the rail's width was a fixed
 * clamp(320px, 40%, 560px) with nothing to drag; the only visible drag handle in that part
 * of the screen was the minimap's, which resizes the minimap, not the rail.
 */
suite('Trouble Mode rail resize handle', () => {
  test('handle element sits between the minimap and the rail, before #trouble-detail', () => {
    const html = getViewerBodyHtml({ version: '1.0.0' });
    const minimapPos = html.indexOf('scrollbar-minimap-column');
    const handlePos = html.indexOf('id="trouble-rail-resize"');
    const railPos = html.indexOf('id="trouble-detail"');
    assert.ok(minimapPos >= 0, 'minimap column must exist');
    assert.ok(handlePos > minimapPos, 'handle must come after the minimap in DOM/flex order');
    assert.ok(handlePos < railPos, 'handle must precede the rail so it is a flex sibling, not a child');
  });

  test('minimap HTML is unchanged by the new handle (no accidental nesting)', () => {
    // The rail handle lives in viewer-content-body.ts, not inside getScrollbarMinimapHtml() —
    // guards against a future edit nesting it into the wrong component.
    const minimapHtml = getScrollbarMinimapHtml();
    assert.ok(!minimapHtml.includes('trouble-rail-resize'), 'minimap markup must not own the rail handle');
  });

  test('handle is hidden by default and shown only while the rail is open and wide', () => {
    const css = getTroubleDetailStyles();
    assert.ok(css.includes('.trouble-rail-resize'), 'handle class must be styled');
    assert.match(
      css,
      /\.trouble-rail-resize\s*\{[^}]*display:\s*none/,
      'handle must be hidden by default (narrow/overlay mode has nothing adjacent to drag)',
    );
    assert.ok(
      css.includes('body.slc-trouble-rail-open.slc-trouble-rail-wide .trouble-rail-resize'),
      'handle must only reveal itself when the SAME two classes gate the static-column rail layout',
    );
  });

  test('drag script defines initTroubleRailResize with the shared 320/560 bounds', () => {
    const script = getTroubleDetailScript();
    assert.ok(script.includes('function initTroubleRailResize'), 'resize init function must be defined');
    assert.ok(script.includes('TROUBLE_RAIL_MIN_PX'), 'min width constant must be defined');
    assert.ok(script.includes('TROUBLE_RAIL_MAX_PX'), 'max width constant must be defined');
    assert.ok(script.includes('320'), 'min bound must match the rail\'s existing clamp() floor');
    assert.ok(script.includes('560'), 'max bound must match the rail\'s existing clamp() ceiling');
  });

  test('drag script uses pointer capture, same as the minimap precedent', () => {
    const script = getTroubleDetailScript();
    assert.ok(script.includes('setPointerCapture'), 'must capture pointer to avoid losing events mid-drag');
    assert.ok(script.includes('lostpointercapture'), 'must treat lost capture as a drag-end');
  });

  test('drag script posts setTroubleRailCustomPx on drag end for persistence', () => {
    const script = getTroubleDetailScript();
    assert.ok(
      script.includes("vscodeApi.postMessage({ type: 'setTroubleRailCustomPx'"),
      'must post the final width so the host can persist it to workspace state',
    );
  });

  test('initTroubleRailResize is invoked from the file load IIFE', () => {
    const script = getTroubleDetailScript();
    const idx = script.indexOf('initTroubleRailResize();');
    assert.ok(idx >= 0, 'binder must actually be called, not just defined');
  });

  test('handleTroubleRailWidthPx validates bounds before applying a restored width', () => {
    const script = getTroubleDetailScript();
    assert.ok(script.includes('function handleTroubleRailWidthPx'), 'restore handler must be defined');
    assert.ok(script.includes('msg.px < TROUBLE_RAIL_MIN_PX'), 'must reject a restored width below the floor');
    assert.ok(script.includes('msg.px > TROUBLE_RAIL_MAX_PX'), 'must reject a restored width above the ceiling');
  });

  test('viewer script dispatches troubleRailWidthPx to handleTroubleRailWidthPx', () => {
    const script = getViewerScript(5000);
    assert.ok(script.includes("case 'troubleRailWidthPx'"), 'message handler must include the dispatch case');
    assert.ok(script.includes('handleTroubleRailWidthPx(msg)'), 'dispatch must call the trouble-detail handler');
  });
});
