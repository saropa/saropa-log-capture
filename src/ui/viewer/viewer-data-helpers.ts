/**
 * Helper functions for viewer data processing and rendering.
 *
 * Contains repeat detection, separator detection, context extraction,
 * height calculation, and item rendering logic. Implementations are split
 * across viewer-data-helpers-core, viewer-data-n-plus-one-script, and viewer-data-helpers-render.
 */
import type { ViewerRepeatThresholds } from '../../modules/db/drift-db-repeat-thresholds';
import type { ViewerSlowBurstThresholds } from '../../modules/db/drift-db-slow-burst-thresholds';
import { getViewerDataHelpersCore } from './viewer-data-helpers-core';
import { getViewerDataHelpersRender } from './viewer-data-helpers-render';
import { getNPlusOneDetectorScript } from './viewer-data-n-plus-one-script';
import { getViewerDbDetectorFrameworkScript } from './viewer-db-detector-framework-script';

export function getViewerDataHelpers(
    repeatThresholds?: Partial<ViewerRepeatThresholds>,
    viewerDbInsightsEnabled = true,
    slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>,
): string {
    return (
        getNPlusOneDetectorScript(repeatThresholds) +
        getViewerDbDetectorFrameworkScript(viewerDbInsightsEnabled, slowBurstThresholds) +
        getViewerDataHelpersCore() +
        getViewerDataHelpersRender()
    );
}
