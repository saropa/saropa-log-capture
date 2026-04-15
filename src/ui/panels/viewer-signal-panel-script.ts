/**
 * Signal panel script content (single-scroll, context-aware).
 * Assembled from part-a, part-b, part-c to stay under max-lines.
 *
 * UX enhancements (14 items): empty states (Cases, Recurring, Hot files); loading states;
 * "This log" single empty message when no errors/recurring; keyboard nav (arrows, Enter/Space)
 * on section headers; scroll/focus after add-to-case and create-case; Session details hint;
 * recurring/errors-in-log text truncation with full tooltip; "Top 3 of N" for errors-in-log;
 * cases list N sources · updated ago; hero 0/0 and no-data message; sparkline "Session trend"
 * label; export confirmation (handled in command). Section order State A: Cases → Across → Env.
 */

import { getSignalScriptPartA } from './viewer-signal-panel-script-part-a';
import { getSignalScriptPartB } from './viewer-signal-panel-script-part-b';
import { getSignalScriptPartC } from './viewer-signal-panel-script-part-c';
import { getSignalScriptPartD } from './viewer-signal-panel-script-part-d';

const MAX_RECURRING_TEXT_LEN = 90;

export interface SignalScriptStrings {
    addToCase: string;
    heroSparklineTitle: string;
    heroLoading: string;
    heroNoSamplingHint: string;
    errorsInLogEmpty: string;
    emptyCases: string;
    emptyRecurring: string;
    emptyHotFiles: string;
    thisLogEmpty: string;
    sessionTrendLabel: string;
    topOfTotal: string;
    sourcesCount: string;
    updatedAgo: string;
    heroNoErrorsWarnings: string;
    sectionErrorsInLog: string;
}

const DEFAULT_SIGNAL_STRINGS: SignalScriptStrings = {
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
