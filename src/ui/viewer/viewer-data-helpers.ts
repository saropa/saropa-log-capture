/**
 * Helper functions for viewer data processing and rendering.
 *
 * Contains repeat detection, separator detection, context extraction,
 * height calculation, and item rendering logic. Implementations are split
 * across viewer-data-helpers-core, viewer-data-n-plus-one-script, and viewer-data-helpers-render.
 */
import type { ViewerRepeatThresholds } from '../../modules/db/drift-db-repeat-thresholds';
import type { ViewerSlowBurstThresholds } from '../../modules/db/drift-db-slow-burst-thresholds';
import type { ViewerDbDetectorToggles } from '../../modules/config/config-types';
import { getViewerDataHelpersCore } from './viewer-data-helpers-core';
import { getViewerDataHelpersRender } from './viewer-data-helpers-render';
import { getStackHeaderRenderScript } from './viewer-data-helpers-render-stack';
import { getViewerDataMarkerFilterScript } from './viewer-data-marker-filter';
import { getNPlusOneDetectorScript } from './viewer-data-n-plus-one-script';
import { getSqlDrilldownUiScript } from './viewer-data-sql-drilldown-ui';
import { getViewerDbDetectorFrameworkScript } from './viewer-db-detector-framework-script';

export function getViewerDataHelpers(
    repeatThresholds?: Partial<ViewerRepeatThresholds>,
    viewerDbSignalsEnabled = true,
    slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>,
    dbDetectorToggles?: Partial<ViewerDbDetectorToggles>,
): string {
    return (
        getNPlusOneDetectorScript(repeatThresholds) +
        getViewerDbDetectorFrameworkScript(viewerDbSignalsEnabled, slowBurstThresholds, dbDetectorToggles) +
        getSqlDrilldownUiScript() +
        getViewerDataHelpersCore() +
        getViewerDataMarkerFilterScript() +
        getStackHeaderRenderScript() +
        getViewerDataHelpersRender()
    );
}
