/**
 * Helper functions for viewer data processing and rendering.
 *
 * Contains repeat detection, separator detection, context extraction,
 * height calculation, and item rendering logic. Implementations are split
 * across viewer-data-helpers-core, viewer-data-n-plus-one-script, and viewer-data-helpers-render.
 */
import { getViewerDataHelpersCore } from './viewer-data-helpers-core';
import { getViewerDataHelpersRender } from './viewer-data-helpers-render';
import { getNPlusOneDetectorScript } from './viewer-data-n-plus-one-script';

export function getViewerDataHelpers(): string {
    return getNPlusOneDetectorScript() + getViewerDataHelpersCore() + getViewerDataHelpersRender();
}
