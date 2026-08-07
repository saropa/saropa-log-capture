/**
 * Zoom behavior for the screenshot lightbox — the wheel handler, the slider, and the two display
 * modes. Split from `flow-map-panel-lightbox-script.ts` to keep that file inside the line budget;
 * the text below is interpolated INSIDE that script's IIFE, so it shares its scope and adds no
 * globals of its own.
 *
 * Two modes, because "fit the capture in the card" and "inspect it at 3x" want opposite CSS:
 *
 * - **Fit** (the default): the browser sizes the image down to the card — `max-height: 70vh`,
 *   `object-fit: contain`. The whole capture is visible and nothing scrolls.
 * - **Zoomed**: the image is pinned to an explicit pixel width and the stage scrolls. Entered by any
 *   deliberate zoom (wheel or slider), and it OVERRIDES fit — a phone capture at 100% is taller than
 *   any card, which is the point of asking for 100%.
 *
 * Returning to 100% does not return to fit: the reader asked for a scale, so 100% means actual
 * pixels. The Reset control is what goes back to fit.
 */

/** JS statements (no wrapper) implementing lightbox zoom, injected into the lightbox IIFE. */
export function flowMapLightboxZoomJs(): string {
    return /* javascript */ `
  var ZOOM_MIN = 25, ZOOM_MAX = 800, ZOOM_STEP = 1.15;
  var zoomScale = 0, zoomImg = null, zoomStage = null, zoomSlider = null, zoomPct = null;

  /* zoomScale 0 is the FIT sentinel — a real scale is always >= ZOOM_MIN/100, so one variable
     carries both the mode and the value without a second flag to keep in sync. */
  function zoomIsFit(){ return zoomScale === 0; }

  function zoomApply(){
    if (!zoomImg) { return; }
    if (zoomIsFit()) {
      zoomImg.style.width = '';
      zoomImg.style.maxWidth = '100%';
      zoomImg.style.maxHeight = '70vh';
      if (zoomPct) { zoomPct.textContent = '—'; }
      if (zoomSlider) { zoomSlider.value = '100'; }
      return;
    }
    // naturalWidth is 0 until the image decodes; fall back to the laid-out width so an early wheel
    // event still zooms something instead of collapsing the image to 0px.
    var base = zoomImg.naturalWidth || zoomImg.clientWidth || 1;
    zoomImg.style.maxWidth = 'none';
    zoomImg.style.maxHeight = 'none';
    zoomImg.style.width = Math.round(base * zoomScale) + 'px';
    if (zoomPct) { zoomPct.textContent = Math.round(zoomScale * 100) + '%'; }
    if (zoomSlider) { zoomSlider.value = String(Math.round(zoomScale * 100)); }
  }

  function zoomSet(scale){
    zoomScale = Math.min(ZOOM_MAX / 100, Math.max(ZOOM_MIN / 100, scale));
    zoomApply();
  }

  /* Wheel zoom keeps the pointer over the same part of the capture: without the scroll correction,
     zooming in on a detail walks it off-screen and the reader has to chase it. */
  function zoomWheel(e){
    if (!zoomStage || !zoomImg) { return; }
    e.preventDefault();
    var rect = zoomImg.getBoundingClientRect();
    var fx = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
    var fy = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
    var from = zoomIsFit() ? (zoomImg.naturalWidth ? rect.width / zoomImg.naturalWidth : 1) : zoomScale;
    zoomSet(from * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
    var now = zoomImg.getBoundingClientRect();
    zoomStage.scrollLeft += (fx * now.width) - (e.clientX - now.left);
    zoomStage.scrollTop += (fy * now.height) - (e.clientY - now.top);
  }

  /* Wire one lightbox's zoom surface. Called once per open; state resets to fit each time so a
     capture never inherits the previous one's scale. */
  function zoomAttach(stage, img, slider, pct){
    zoomStage = stage; zoomImg = img; zoomSlider = slider; zoomPct = pct;
    zoomScale = 0;
    // passive:false — the handler calls preventDefault to stop the page scrolling under the card.
    stage.addEventListener('wheel', zoomWheel, { passive: false });
    slider.addEventListener('input', function(){ zoomSet(Number(slider.value) / 100); });
    img.addEventListener('load', zoomApply);
    zoomApply();
  }

  function zoomReset(){ zoomScale = 0; zoomApply(); }
`;
}
