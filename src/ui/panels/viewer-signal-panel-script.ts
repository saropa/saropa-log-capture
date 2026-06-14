/**
 * Signal panel script content (single-scroll, context-aware).
 * Assembled from part-a, part-b, part-c to stay under max-lines.
 *
 * UX enhancements: empty states (Recurring, Hot files); loading states;
 * "This log" single empty message when no errors/recurring; keyboard nav (arrows, Enter/Space)
 * on section headers; Session details hint;
 * recurring/errors-in-log text truncation with full tooltip; "Top 3 of N" for errors-in-log;
 * hero 0/0 and no-data message; sparkline "Session trend"
 * label; export confirmation (handled in command). Section order State A: Across → Env.
 */

import { getSignalScriptPartA } from './viewer-signal-panel-script-part-a';
import { getSignalScriptPartB } from './viewer-signal-panel-script-part-b';
import { getSignalScriptPartC } from './viewer-signal-panel-script-part-c';
import { getSignalScriptPartD } from './viewer-signal-panel-script-part-d';

const MAX_RECURRING_TEXT_LEN = 90;

export interface SignalScriptStrings {
    heroSparklineTitle: string;
    heroLoading: string;
    heroNoSamplingHint: string;
    errorsInLogEmpty: string;
    emptyRecurring: string;
    emptyHotFiles: string;
    thisLogEmpty: string;
    sessionTrendLabel: string;
    topOfTotal: string;
    heroNoErrorsWarnings: string;
    sectionErrorsInLog: string;
    // Signal-row action affordances (triage / copy / cross-tool links / trend tooltips). Kept in this
    // panel-standalone string object so the row scripts never hardcode English. openRuleTitle carries a
    // {0} for the rule name (substituted client-side via split/join). "DA" stays an abbreviation.
    accept: string;
    reject: string;
    triageClose: string;
    triageMute: string;
    triageReopen: string;
    ruleLabel: string;
    openRuleTitle: string;
    openDriftAdvisorTitle: string;
    copyLabel: string;
    copySignalTitle: string;
    trendIncreasing: string;
    trendDecreasing: string;
    trendStable: string;
    evidenceLineTitle: string;
    supportingLogLines: string;
}

const DEFAULT_SIGNAL_STRINGS: SignalScriptStrings = {
    heroSparklineTitle: 'Free memory over session',
    heroLoading: 'Loading…',
    heroNoSamplingHint: 'Enable session sampling for trend',
    errorsInLogEmpty: 'No error patterns in this session.',
    emptyRecurring: 'No recurring errors yet. They\'ll appear as you capture logs.',
    emptyHotFiles: 'No frequently modified files across sessions yet.',
    thisLogEmpty: 'No errors or recurring patterns in this log.',
    sessionTrendLabel: 'Session trend',
    topOfTotal: 'Top 3 of {0}',
    heroNoErrorsWarnings: 'No errors or warnings recorded',
    sectionErrorsInLog: 'Errors in this log',
    accept: 'Accept',
    reject: 'Reject',
    triageClose: 'Close',
    triageMute: 'Mute',
    triageReopen: 'Re-open',
    ruleLabel: 'Rule',
    openRuleTitle: 'Open rule docs for {0}',
    openDriftAdvisorTitle: 'Open Drift Advisor',
    copyLabel: 'Copy',
    copySignalTitle: 'Copy signal details for analysis',
    trendIncreasing: 'Increasing',
    trendDecreasing: 'Decreasing',
    trendStable: 'Stable',
    evidenceLineTitle: 'Line {0}: {1}',
    supportingLogLines: 'Supporting log lines',
};

/** Generate the Signal panel script. Single scroll; State A vs B. */
export function getSignalPanelScriptContent(storageKey: string, strings?: SignalScriptStrings): string {
    const s = strings ?? DEFAULT_SIGNAL_STRINGS;
    const scriptStringsJson = JSON.stringify(s);
    return (
        /* js */ `(function() {\n` +
        getSignalScriptPartA(storageKey, scriptStringsJson) +
        getSignalScriptPartB(MAX_RECURRING_TEXT_LEN) +
        getSignalScriptPartC() +
        getSignalScriptPartD() +
        `})();\n`
    );
}
