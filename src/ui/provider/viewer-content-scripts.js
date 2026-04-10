"use strict";
/**
 * Viewer webview script tags (ordered list of all scripts).
 * Extracted to keep viewer-content.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerScriptTags = getViewerScriptTags;
const viewer_error_handler_1 = require("../viewer-decorations/viewer-error-handler");
const viewer_layout_1 = require("./viewer-layout");
const viewer_data_1 = require("../viewer/viewer-data");
const viewer_root_cause_hints_script_1 = require("../viewer/viewer-root-cause-hints-script");
const viewer_script_1 = require("../viewer/viewer-script");
const viewer_visibility_1 = require("../viewer/viewer-visibility");
const viewer_scroll_anchor_1 = require("../viewer/viewer-scroll-anchor");
const viewer_filter_1 = require("../viewer-search-filter/viewer-filter");
const viewer_watch_1 = require("../viewer/viewer-watch");
const viewer_pin_1 = require("../viewer/viewer-pin");
const viewer_exclusions_1 = require("../viewer-search-filter/viewer-exclusions");
const viewer_copy_1 = require("../viewer/viewer-copy");
const viewer_hidden_lines_1 = require("../viewer/viewer-hidden-lines");
const viewer_auto_hide_modal_1 = require("../viewer/viewer-auto-hide-modal");
const viewer_annotations_1 = require("../viewer/viewer-annotations");
const viewer_timing_1 = require("../viewer/viewer-timing");
const viewer_replay_1 = require("../viewer/viewer-replay");
const viewer_decorations_1 = require("../viewer-decorations/viewer-decorations");
const viewer_deco_settings_1 = require("../viewer-decorations/viewer-deco-settings");
const viewer_quality_badge_1 = require("../viewer-decorations/viewer-quality-badge");
const viewer_lint_badge_1 = require("../viewer-decorations/viewer-lint-badge");
const viewer_stack_dedup_1 = require("../viewer-stack-tags/viewer-stack-dedup");
const viewer_stack_filter_1 = require("../viewer-stack-tags/viewer-stack-filter");
const viewer_tag_selection_guard_1 = require("../viewer-stack-tags/viewer-tag-selection-guard");
const viewer_split_nav_1 = require("../viewer-nav/viewer-split-nav");
const viewer_session_nav_1 = require("../viewer-nav/viewer-session-nav");
const viewer_json_1 = require("../viewer/viewer-json");
const viewer_search_1 = require("../viewer-search-filter/viewer-search");
const viewer_search_setup_from_find_1 = require("../viewer-search-filter/viewer-search-setup-from-find");
const viewer_search_toggles_1 = require("../viewer-search-filter/viewer-search-toggles");
const viewer_search_history_1 = require("../viewer-search-filter/viewer-search-history");
const viewer_level_filter_1 = require("../viewer-search-filter/viewer-level-filter");
const viewer_source_tags_1 = require("../viewer-stack-tags/viewer-source-tags");
const viewer_class_tags_1 = require("../viewer-stack-tags/viewer-class-tags");
const viewer_sql_pattern_tags_1 = require("../viewer-stack-tags/viewer-sql-pattern-tags");
const viewer_sql_query_history_core_1 = require("../viewer-stack-tags/viewer-sql-query-history-core");
const viewer_sql_query_history_panel_1 = require("../viewer-panels/viewer-sql-query-history-panel");
const viewer_highlight_1 = require("../viewer-decorations/viewer-highlight");
const viewer_scope_filter_1 = require("../viewer-search-filter/viewer-scope-filter");
const viewer_scope_filter_hint_1 = require("../viewer-search-filter/viewer-scope-filter-hint");
const session_time_buckets_1 = require("../../modules/viewer/session-time-buckets");
const viewer_time_range_filter_1 = require("../viewer/viewer-time-range-filter");
const viewer_presets_1 = require("../viewer-search-filter/viewer-presets");
const viewer_filter_badge_1 = require("../viewer-search-filter/viewer-filter-badge");
const viewer_context_modal_1 = require("../viewer-context-menu/viewer-context-modal");
const viewer_context_popover_1 = require("../viewer-context-menu/viewer-context-popover");
const viewer_context_menu_1 = require("../viewer-context-menu/viewer-context-menu");
const viewer_audio_1 = require("../viewer/viewer-audio");
const viewer_session_transforms_1 = require("../viewer/viewer-session-transforms");
const viewer_session_tags_1 = require("../viewer-panels/viewer-session-tags");
const viewer_session_panel_1 = require("../viewer-panels/viewer-session-panel");
const viewer_session_context_menu_1 = require("../viewer-context-menu/viewer-session-context-menu");
const viewer_trash_panel_1 = require("../viewer-panels/viewer-trash-panel");
const viewer_find_panel_1 = require("../viewer-panels/viewer-find-panel");
const viewer_bookmark_panel_1 = require("../viewer-panels/viewer-bookmark-panel");
const viewer_filters_panel_1 = require("../viewer-search-filter/viewer-filters-panel");
const viewer_toolbar_script_1 = require("../viewer-toolbar/viewer-toolbar-script");
const viewer_options_panel_1 = require("../viewer-panels/viewer-options-panel");
const viewer_crashlytics_panel_1 = require("../panels/viewer-crashlytics-panel");
const viewer_insight_panel_1 = require("../panels/viewer-insight-panel");
const viewer_performance_panel_1 = require("../panels/viewer-performance-panel");
const viewer_about_panel_1 = require("../viewer-panels/viewer-about-panel");
const viewer_icon_bar_1 = require("../viewer-nav/viewer-icon-bar");
const viewer_error_breakpoint_1 = require("../viewer-decorations/viewer-error-breakpoint");
const viewer_stats_1 = require("../viewer/viewer-stats");
const viewer_edit_modal_1 = require("../viewer-context-menu/viewer-edit-modal");
const viewer_scrollbar_minimap_1 = require("../viewer/viewer-scrollbar-minimap");
const viewer_session_header_1 = require("../viewer-nav/viewer-session-header");
const viewer_export_1 = require("../viewer-panels/viewer-export");
const viewer_error_classification_1 = require("../viewer-decorations/viewer-error-classification");
const viewer_error_hover_script_1 = require("../viewer-decorations/viewer-error-hover-script");
const viewer_goto_line_1 = require("../viewer/viewer-goto-line");
const viewer_run_nav_1 = require("../viewer-nav/viewer-run-nav");
function scriptTag(nonce, ...parts) {
    return `<script nonce="${nonce}">${parts.join('\n')}</script>`;
}
/** Build all script tags in the order required by the viewer. */
function getViewerScriptTags(opts) {
    const { nonce, extensionUri, viewerMaxLines: maxLines, viewerPreserveAsciiBoxArt, viewerGroupAsciiArt, viewerDetectAsciiArt, viewerRepeatThresholds, viewerDbInsightsEnabled, staticSqlFromFingerprintEnabled, viewerSlowBurstThresholds, viewerDbDetectorToggles, } = opts;
    return (scriptTag(nonce, (0, viewer_error_handler_1.getErrorHandlerScript)()) +
        scriptTag(nonce, (0, viewer_layout_1.getLayoutScript)(), (0, viewer_data_1.getViewerDataScript)({
            repeatThresholds: viewerRepeatThresholds,
            viewerDbInsightsEnabled: viewerDbInsightsEnabled !== false,
            staticSqlFromFingerprintEnabled: staticSqlFromFingerprintEnabled !== false,
            slowBurstThresholds: viewerSlowBurstThresholds,
            dbDetectorToggles: viewerDbDetectorToggles,
        }), (0, viewer_script_1.getViewerScript)(maxLines, viewerPreserveAsciiBoxArt !== false, viewerGroupAsciiArt !== false, viewerDetectAsciiArt === true), (0, viewer_root_cause_hints_script_1.getViewerRootCauseHintsScript)(), (0, viewer_visibility_1.getViewerVisibilityScript)()) +
        scriptTag(nonce, (0, viewer_scroll_anchor_1.getScrollAnchorScript)()) +
        scriptTag(nonce, (0, viewer_filter_1.getFilterScript)()) +
        scriptTag(nonce, (0, viewer_watch_1.getWatchScript)()) +
        scriptTag(nonce, (0, viewer_pin_1.getPinScript)()) +
        scriptTag(nonce, (0, viewer_exclusions_1.getExclusionScript)()) +
        scriptTag(nonce, (0, viewer_copy_1.getCopyScript)()) +
        scriptTag(nonce, (0, viewer_hidden_lines_1.getHiddenLinesScript)()) +
        scriptTag(nonce, (0, viewer_auto_hide_modal_1.getAutoHideModalScript)()) +
        scriptTag(nonce, (0, viewer_annotations_1.getAnnotationScript)()) +
        scriptTag(nonce, (0, viewer_timing_1.getTimingScript)()) +
        scriptTag(nonce, (0, viewer_replay_1.getReplayScript)()) +
        scriptTag(nonce, (0, viewer_decorations_1.getDecorationsScript)()) +
        scriptTag(nonce, (0, viewer_deco_settings_1.getDecoSettingsScript)()) +
        scriptTag(nonce, (0, viewer_quality_badge_1.getQualityBadgeScript)()) +
        scriptTag(nonce, (0, viewer_lint_badge_1.getLintBadgeScript)()) +
        scriptTag(nonce, (0, viewer_stack_dedup_1.getStackDedupScript)()) +
        scriptTag(nonce, (0, viewer_stack_filter_1.getStackFilterScript)()) +
        scriptTag(nonce, (0, viewer_split_nav_1.getSplitNavScript)()) +
        scriptTag(nonce, (0, viewer_session_nav_1.getSessionNavScript)()) +
        scriptTag(nonce, (0, viewer_json_1.getJsonScript)()) +
        scriptTag(nonce, (0, viewer_search_1.getSearchScript)()) +
        scriptTag(nonce, (0, viewer_search_toggles_1.getSearchTogglesScript)()) +
        scriptTag(nonce, (0, viewer_search_history_1.getSearchHistoryScript)()) +
        scriptTag(nonce, (0, viewer_search_setup_from_find_1.getSearchSetupFromFindInFilesScript)()) +
        scriptTag(nonce, (0, viewer_level_filter_1.getLevelFilterScript)()) +
        scriptTag(nonce, (0, viewer_tag_selection_guard_1.getTagSelectionGuardScript)()) +
        scriptTag(nonce, (0, viewer_source_tags_1.getSourceTagsScript)()) +
        scriptTag(nonce, (0, viewer_class_tags_1.getClassTagsScript)()) +
        scriptTag(nonce, (0, viewer_sql_pattern_tags_1.getSqlPatternTagsScript)(), (0, viewer_sql_query_history_core_1.getSqlQueryHistoryCoreScript)(), (0, viewer_sql_query_history_panel_1.getSqlQueryHistoryPanelScript)()) +
        scriptTag(nonce, (0, viewer_highlight_1.getHighlightScript)()) +
        scriptTag(nonce, (0, viewer_scope_filter_1.getScopeFilterScript)()) +
        scriptTag(nonce, (0, viewer_scope_filter_hint_1.getScopeFilterHintScript)()) +
        scriptTag(nonce, (0, session_time_buckets_1.getSessionTimeBucketsScript)()) +
        scriptTag(nonce, (0, viewer_time_range_filter_1.getViewerTimeRangeFilterScript)()) +
        scriptTag(nonce, (0, viewer_presets_1.getPresetsScript)()) +
        scriptTag(nonce, (0, viewer_filter_badge_1.getFilterBadgeScript)()) +
        scriptTag(nonce, (0, viewer_context_modal_1.getContextModalScript)()) +
        scriptTag(nonce, (0, viewer_context_popover_1.getContextPopoverScript)()) +
        scriptTag(nonce, (0, viewer_context_menu_1.getContextMenuScript)()) +
        scriptTag(nonce, (0, viewer_audio_1.getAudioScript)(extensionUri || '')) +
        scriptTag(nonce, (0, viewer_session_transforms_1.getSessionTransformsScript)()) +
        scriptTag(nonce, (0, viewer_session_tags_1.getSessionTagsScript)()) +
        scriptTag(nonce, (0, viewer_session_panel_1.getSessionPanelScript)()) +
        scriptTag(nonce, (0, viewer_session_context_menu_1.getSessionContextMenuScript)()) +
        scriptTag(nonce, (0, viewer_trash_panel_1.getTrashPanelScript)()) +
        scriptTag(nonce, (0, viewer_find_panel_1.getFindPanelScript)()) +
        scriptTag(nonce, (0, viewer_bookmark_panel_1.getBookmarkPanelScript)()) +
        scriptTag(nonce, (0, viewer_filters_panel_1.getFiltersPanelScript)()) +
        scriptTag(nonce, (0, viewer_options_panel_1.getOptionsPanelScript)()) +
        scriptTag(nonce, (0, viewer_crashlytics_panel_1.getCrashlyticsPanelScript)()) +
        scriptTag(nonce, (0, viewer_insight_panel_1.getInsightPanelScript)()) +
        // Performance UI lives only inside Insight (insight-pp-*); standalone performance-panel was removed.
        scriptTag(nonce, (0, viewer_performance_panel_1.getPerformancePanelScript)('insight-')) +
        scriptTag(nonce, (0, viewer_about_panel_1.getAboutPanelScript)()) +
        scriptTag(nonce, (0, viewer_icon_bar_1.getIconBarScript)()) +
        scriptTag(nonce, (0, viewer_toolbar_script_1.getToolbarScript)()) +
        scriptTag(nonce, (0, viewer_error_breakpoint_1.getErrorBreakpointScript)()) +
        scriptTag(nonce, (0, viewer_stats_1.getStatsScript)()) +
        scriptTag(nonce, (0, viewer_edit_modal_1.getEditModalScript)()) +
        scriptTag(nonce, (0, viewer_scrollbar_minimap_1.getScrollbarMinimapScript)()) +
        scriptTag(nonce, (0, viewer_session_header_1.getSessionHeaderScript)()) +
        scriptTag(nonce, (0, viewer_export_1.getExportScript)()) +
        scriptTag(nonce, (0, viewer_error_classification_1.getErrorClassificationScript)()) +
        scriptTag(nonce, (0, viewer_error_hover_script_1.getErrorHoverScript)()) +
        scriptTag(nonce, (0, viewer_goto_line_1.getGotoLineScript)()) +
        scriptTag(nonce, (0, viewer_run_nav_1.getRunNavScript)()));
}
//# sourceMappingURL=viewer-content-scripts.js.map