"use strict";
/**
 * Insight panel script content (single-scroll, context-aware).
 * Assembled from part-a, part-b, part-c to stay under max-lines.
 *
 * UX enhancements (14 items): empty states (Cases, Recurring, Hot files); loading states;
 * "This log" single empty message when no errors/recurring; keyboard nav (arrows, Enter/Space)
 * on section headers; scroll/focus after add-to-case and create-case; Session details hint;
 * recurring/errors-in-log text truncation with full tooltip; "Top 3 of N" for errors-in-log;
 * cases list N sources · updated ago; hero 0/0 and no-data message; sparkline "Session trend"
 * label; export confirmation (handled in command). Section order State A: Cases → Across → Env.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInsightPanelScriptContent = getInsightPanelScriptContent;
const viewer_insight_panel_script_part_a_1 = require("./viewer-insight-panel-script-part-a");
const viewer_insight_panel_script_part_b_1 = require("./viewer-insight-panel-script-part-b");
const viewer_insight_panel_script_part_c_1 = require("./viewer-insight-panel-script-part-c");
const MAX_RECURRING_TEXT_LEN = 90;
const DEFAULT_INSIGHT_STRINGS = {
    addToCase: 'Add to case',
    heroSparklineTitle: 'Free memory over session',
    heroLoading: 'Loading…',
    heroNoSamplingHint: 'Enable session sampling for trend',
    errorsInLogEmpty: 'No error patterns in this session.',
    emptyCases: 'No cases yet. Create one to pin logs and files.',
    emptyRecurring: 'No recurring errors yet. They\'ll appear as you capture logs.',
    emptyHotFiles: 'No frequently modified files across sessions yet.',
    thisLogEmpty: 'No errors or recurring patterns in this log.',
    sessionTrendLabel: 'Session trend',
    topOfTotal: 'Top 3 of {0}',
    sourcesCount: '{0} source(s)',
    updatedAgo: 'Updated {0}',
    heroNoErrorsWarnings: 'No errors or warnings recorded',
    sectionErrorsInLog: 'Errors in this log',
};
/** Generate the Insight panel script. Single scroll; State A vs B. */
function getInsightPanelScriptContent(storageKey, strings) {
    const s = strings ?? DEFAULT_INSIGHT_STRINGS;
    const scriptStringsJson = JSON.stringify(s);
    return (
    /* js */ `(function() {\n` +
        (0, viewer_insight_panel_script_part_a_1.getInsightScriptPartA)(storageKey, scriptStringsJson) +
        (0, viewer_insight_panel_script_part_b_1.getInsightScriptPartB)(MAX_RECURRING_TEXT_LEN) +
        (0, viewer_insight_panel_script_part_c_1.getInsightScriptPartC)() +
        `})();\n`);
}
//# sourceMappingURL=viewer-insight-panel-script.js.map