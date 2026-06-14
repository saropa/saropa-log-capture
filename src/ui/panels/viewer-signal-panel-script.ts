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
    // Folded in from the global vt('viewer.signalPanel.*') keys so the panel uses one string
    // mechanism. {N} placeholders are filled client-side by fillSignalString.
    suggestionImpact: string;
    sessionMeta: string;
    recurringTitle: string;
    reliabilityConsistent: string;
    reliabilityIntermittent: string;
    reliabilityRare: string;
    heroErrors: string;
    heroWarnings: string;
    metaAvg: string;
    metaMax: string;
    // Cross-session report sections + co-occurrence rows + relative-time labels, folded off the global
    // vt('viewer.signal.*') keys so the whole panel uses this one standalone object. *One/*Many pairs
    // are selected client-side by count; {N} placeholders are filled by fillSignalString.
    cooccurTitle: string;
    cooccurMeta: string;
    timeJustNow: string;
    timeMinAgo: string;
    timeHoursAgo: string;
    timeDaysAgo: string;
    timeWeeksAgo: string;
    suggestionsSummary: string;
    hotfilesSummaryEmpty: string;
    hotfilesSummaryOne: string;
    hotfilesSummaryMany: string;
    hotfilesSessionsOne: string;
    hotfilesSessionsMany: string;
    envPlatforms: string;
    envSdkRuntime: string;
    envDebugAdapters: string;
    envSummaryEmpty: string;
    envSummary: string;
    envEmpty: string;
    allSummaryEmpty: string;
    allSummary: string;
    inLogSummaryEmpty: string;
    inLogSummary: string;
    inLogSummaryWindow: string;
    noLogOpen: string;
    relatedSummaryOne: string;
    relatedSummaryMany: string;
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
    suggestionImpact: '~{0} lines ({1}%)',
    sessionMeta: '{0} session(s), {1} total',
    recurringTitle: 'Recurring in {0} sessions',
    reliabilityConsistent: '{0}% of sessions — consistent',
    reliabilityIntermittent: '{0}% of sessions — intermittent',
    reliabilityRare: '{0}% of sessions — rare',
    heroErrors: 'Errors: {0}',
    heroWarnings: 'Warnings: {0}',
    metaAvg: ', avg {0}',
    metaMax: ', max {0}',
    cooccurTitle: '{0} and {1} co-occur in {2} sessions',
    cooccurMeta: '{0} shared, {1}% overlap',
    timeJustNow: 'just now',
    timeMinAgo: '{0} min ago',
    timeHoursAgo: '{0}h ago',
    timeDaysAgo: '{0} days ago',
    timeWeeksAgo: '{0}w ago',
    suggestionsSummary: 'Filter suggestions ({0})',
    hotfilesSummaryEmpty: 'Frequently modified files',
    hotfilesSummaryOne: '{0} file frequently modified',
    hotfilesSummaryMany: '{0} files frequently modified',
    hotfilesSessionsOne: '{0} session',
    hotfilesSessionsMany: '{0} sessions',
    envPlatforms: 'Platforms',
    envSdkRuntime: 'SDK / runtime',
    envDebugAdapters: 'Debug adapters',
    envSummaryEmpty: 'Environment',
    envSummary: 'Environment ({0} entries)',
    envEmpty: 'No environment data across sessions.',
    allSummaryEmpty: 'All signals',
    allSummary: 'All signals ({0})',
    inLogSummaryEmpty: 'Signals in this log',
    inLogSummary: 'Signals in this log ({0})',
    inLogSummaryWindow: 'Signals in this log ({0} of {1})',
    noLogOpen: 'No log open',
    relatedSummaryOne: 'Related signals ({0} pair)',
    relatedSummaryMany: 'Related signals ({0} pairs)',
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
