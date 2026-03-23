/**
 * Viewer webview script tags (ordered list of all scripts).
 * Extracted to keep viewer-content.ts under the line limit.
 */

import { getErrorHandlerScript } from '../viewer-decorations/viewer-error-handler';
import { getLayoutScript } from './viewer-layout';
import type { ViewerRepeatThresholds } from '../../modules/db/drift-db-repeat-thresholds';
import { getViewerDataScript } from '../viewer/viewer-data';
import { getViewerScript } from '../viewer/viewer-script';
import { getViewerVisibilityScript } from '../viewer/viewer-visibility';
import { getScrollAnchorScript } from '../viewer/viewer-scroll-anchor';
import { getFilterScript } from '../viewer-search-filter/viewer-filter';
import { getWatchScript } from '../viewer/viewer-watch';
import { getPinScript } from '../viewer/viewer-pin';
import { getExclusionScript } from '../viewer-search-filter/viewer-exclusions';
import { getCopyScript } from '../viewer/viewer-copy';
import { getHiddenLinesScript } from '../viewer/viewer-hidden-lines';
import { getAutoHideModalScript } from '../viewer/viewer-auto-hide-modal';
import { getAnnotationScript } from '../viewer/viewer-annotations';
import { getTimingScript } from '../viewer/viewer-timing';
import { getReplayScript } from '../viewer/viewer-replay';
import { getDecorationsScript } from '../viewer-decorations/viewer-decorations';
import { getDecoSettingsScript } from '../viewer-decorations/viewer-deco-settings';
import { getQualityBadgeScript } from '../viewer-decorations/viewer-quality-badge';
import { getStackDedupScript } from '../viewer-stack-tags/viewer-stack-dedup';
import { getStackFilterScript } from '../viewer-stack-tags/viewer-stack-filter';
import { getTagSelectionGuardScript } from '../viewer-stack-tags/viewer-tag-selection-guard';
import { getSplitNavScript } from '../viewer-nav/viewer-split-nav';
import { getSessionNavScript } from '../viewer-nav/viewer-session-nav';
import { getJsonScript } from '../viewer/viewer-json';
import { getSearchScript } from '../viewer-search-filter/viewer-search';
import { getSearchSetupFromFindInFilesScript } from '../viewer-search-filter/viewer-search-setup-from-find';
import { getSearchTogglesScript } from '../viewer-search-filter/viewer-search-toggles';
import { getSearchHistoryScript } from '../viewer-search-filter/viewer-search-history';
import { getLevelFilterScript } from '../viewer-search-filter/viewer-level-filter';
import { getSourceTagsScript } from '../viewer-stack-tags/viewer-source-tags';
import { getClassTagsScript } from '../viewer-stack-tags/viewer-class-tags';
import { getSqlPatternTagsScript } from '../viewer-stack-tags/viewer-sql-pattern-tags';
import { getHighlightScript } from '../viewer-decorations/viewer-highlight';
import { getScopeFilterScript } from '../viewer-search-filter/viewer-scope-filter';
import { getPresetsScript } from '../viewer-search-filter/viewer-presets';
import { getFilterBadgeScript } from '../viewer-search-filter/viewer-filter-badge';
import { getContextModalScript } from '../viewer-context-menu/viewer-context-modal';
import { getContextPopoverScript } from '../viewer-context-menu/viewer-context-popover';
import { getContextMenuScript } from '../viewer-context-menu/viewer-context-menu';
import { getAudioScript } from '../viewer/viewer-audio';
import { getSessionTransformsScript } from '../viewer/viewer-session-transforms';
import { getSessionTagsScript } from '../viewer-panels/viewer-session-tags';
import { getSessionPanelScript } from '../viewer-panels/viewer-session-panel';
import { getSessionContextMenuScript } from '../viewer-context-menu/viewer-session-context-menu';
import { getTrashPanelScript } from '../viewer-panels/viewer-trash-panel';
import { getFindPanelScript } from '../viewer-panels/viewer-find-panel';
import { getBookmarkPanelScript } from '../viewer-panels/viewer-bookmark-panel';
import { getFiltersPanelScript } from '../viewer-search-filter/viewer-filters-panel';
import { getOptionsPanelScript } from '../viewer-panels/viewer-options-panel';
import { getCrashlyticsPanelScript } from '../panels/viewer-crashlytics-panel';
import { getInsightPanelScript } from '../panels/viewer-insight-panel';
import { getPerformancePanelScript } from '../panels/viewer-performance-panel';
import { getAboutPanelScript } from '../viewer-panels/viewer-about-panel';
import { getIconBarScript } from '../viewer-nav/viewer-icon-bar';
import { getErrorBreakpointScript } from '../viewer-decorations/viewer-error-breakpoint';
import { getStatsScript } from '../viewer/viewer-stats';
import { getEditModalScript } from '../viewer-context-menu/viewer-edit-modal';
import { getScrollbarMinimapScript } from '../viewer/viewer-scrollbar-minimap';
import { getSessionHeaderScript } from '../viewer-nav/viewer-session-header';
import { getExportScript } from '../viewer-panels/viewer-export';
import { getErrorClassificationScript } from '../viewer-decorations/viewer-error-classification';
import { getErrorHoverScript } from '../viewer-decorations/viewer-error-hover-script';
import { getGotoLineScript } from '../viewer/viewer-goto-line';
import { getRunNavScript } from '../viewer-nav/viewer-run-nav';

function scriptTag(nonce: string, ...parts: string[]): string {
    return `<script nonce="${nonce}">${parts.join('\n')}</script>`;
}

export interface ViewerScriptsOptions {
    readonly nonce: string;
    readonly extensionUri?: string;
    /** Max lines for getViewerScript (caller should pass from getEffectiveViewerLines or MAX_VIEWER_LINES). */
    readonly viewerMaxLines: number;
    readonly viewerRepeatThresholds?: Partial<ViewerRepeatThresholds>;
    /** When false, DB detector pipeline and per-line dbInsight rollup are off (plan DB_15). */
    readonly viewerDbInsightsEnabled?: boolean;
    /** Fingerprint chip thresholds (plan DB_05). */
    readonly viewerSqlPatternChipMinCount?: number;
    readonly viewerSqlPatternMaxChips?: number;
}

/** Build all script tags in the order required by the viewer. */
export function getViewerScriptTags(opts: ViewerScriptsOptions): string {
    const {
        nonce,
        extensionUri,
        viewerMaxLines: maxLines,
        viewerRepeatThresholds,
        viewerDbInsightsEnabled,
        viewerSqlPatternChipMinCount,
        viewerSqlPatternMaxChips,
    } = opts;
    return (
        scriptTag(nonce, getErrorHandlerScript()) +
        scriptTag(
            nonce,
            getLayoutScript(),
            getViewerDataScript(viewerRepeatThresholds, viewerDbInsightsEnabled !== false),
            getViewerScript(maxLines),
            getViewerVisibilityScript(),
        ) +
        scriptTag(nonce, getScrollAnchorScript()) +
        scriptTag(nonce, getFilterScript()) +
        scriptTag(nonce, getWatchScript()) +
        scriptTag(nonce, getPinScript()) +
        scriptTag(nonce, getExclusionScript()) +
        scriptTag(nonce, getCopyScript()) +
        scriptTag(nonce, getHiddenLinesScript()) +
        scriptTag(nonce, getAutoHideModalScript()) +
        scriptTag(nonce, getAnnotationScript()) +
        scriptTag(nonce, getTimingScript()) +
        scriptTag(nonce, getReplayScript()) +
        scriptTag(nonce, getDecorationsScript()) +
        scriptTag(nonce, getDecoSettingsScript()) +
        scriptTag(nonce, getQualityBadgeScript()) +
        scriptTag(nonce, getStackDedupScript()) +
        scriptTag(nonce, getStackFilterScript()) +
        scriptTag(nonce, getSplitNavScript()) +
        scriptTag(nonce, getSessionNavScript()) +
        scriptTag(nonce, getJsonScript()) +
        scriptTag(nonce, getSearchScript()) +
        scriptTag(nonce, getSearchTogglesScript()) +
        scriptTag(nonce, getSearchHistoryScript()) +
        scriptTag(nonce, getSearchSetupFromFindInFilesScript()) +
        scriptTag(nonce, getLevelFilterScript()) +
        scriptTag(nonce, getTagSelectionGuardScript()) +
        scriptTag(nonce, getSourceTagsScript()) +
        scriptTag(nonce, getClassTagsScript()) +
        scriptTag(
            nonce,
            getSqlPatternTagsScript(
                viewerSqlPatternChipMinCount ?? 2,
                viewerSqlPatternMaxChips ?? 20,
            ),
        ) +
        scriptTag(nonce, getHighlightScript()) +
        scriptTag(nonce, getScopeFilterScript()) +
        scriptTag(nonce, getPresetsScript()) +
        scriptTag(nonce, getFilterBadgeScript()) +
        scriptTag(nonce, getContextModalScript()) +
        scriptTag(nonce, getContextPopoverScript()) +
        scriptTag(nonce, getContextMenuScript()) +
        scriptTag(nonce, getAudioScript(extensionUri || '')) +
        scriptTag(nonce, getSessionTransformsScript()) +
        scriptTag(nonce, getSessionTagsScript()) +
        scriptTag(nonce, getSessionPanelScript()) +
        scriptTag(nonce, getSessionContextMenuScript()) +
        scriptTag(nonce, getTrashPanelScript()) +
        scriptTag(nonce, getFindPanelScript()) +
        scriptTag(nonce, getBookmarkPanelScript()) +
        scriptTag(nonce, getFiltersPanelScript()) +
        scriptTag(nonce, getOptionsPanelScript()) +
        scriptTag(nonce, getCrashlyticsPanelScript()) +
        scriptTag(nonce, getInsightPanelScript()) +
        // Performance UI lives only inside Insight (insight-pp-*); standalone performance-panel was removed.
        scriptTag(nonce, getPerformancePanelScript('insight-')) +
        scriptTag(nonce, getAboutPanelScript()) +
        scriptTag(nonce, getIconBarScript()) +
        scriptTag(nonce, getErrorBreakpointScript()) +
        scriptTag(nonce, getStatsScript()) +
        scriptTag(nonce, getEditModalScript()) +
        scriptTag(nonce, getScrollbarMinimapScript()) +
        scriptTag(nonce, getSessionHeaderScript()) +
        scriptTag(nonce, getExportScript()) +
        scriptTag(nonce, getErrorClassificationScript()) +
        scriptTag(nonce, getErrorHoverScript()) +
        scriptTag(nonce, getGotoLineScript()) +
        scriptTag(nonce, getRunNavScript())
    );
}
