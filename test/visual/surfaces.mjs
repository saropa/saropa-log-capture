/**
 * Surface drivers for the visual harness. Each entry opens one dashboard surface, feeds it
 * representative mock host→webview messages (shapes mirror the real `post({...})` sites in
 * src/ui/shared/handlers/*), and names the element to clip the screenshot to.
 *
 * postMessage on window dispatches the same 'message' event the webview listens for, so feeding
 * data here drives the exact production render path.
 */

const signalData = {
  type: 'signalData',
  statuses: {},
  hotFiles: [
    { filename: 'lib/src/contacts/contact_repository.dart', count: 14 },
    { filename: 'lib/src/sync/sync_engine.dart', count: 9 },
    { filename: 'lib/src/ui/home/home_screen.dart', count: 5 },
  ],
  platforms: ['android', 'ios'],
  sdkVersions: ['Flutter 3.24.1'],
  debugAdapters: ['dart'],
  allSignals: [
    { kind: 'error', label: 'StateError: Bad state: No element', fingerprint: 'a1', sessionCount: 6, totalOccurrences: 23, detail: 'package:contacts/contact_list.dart:142', category: 'fatal' },
    { kind: 'sql', label: 'N+1 query on contacts table (48 reads)', fingerprint: 'b2', sessionCount: 3, totalOccurrences: 48, detail: 'SELECT * FROM contacts WHERE id = ?' },
    { kind: 'warning', label: 'Slow frame: 34ms build on HomeScreen', fingerprint: 'c3', sessionCount: 4, totalOccurrences: 12 },
  ],
  signalsInThisLog: [
    { kind: 'error', label: 'Null check operator used on a null value', fingerprint: 'd4', sessionCount: 1, totalOccurrences: 3, detail: 'lib/main.dart:88' },
    { kind: 'performance', label: 'Jank: 18 frames dropped during scroll', fingerprint: 'e5', sessionCount: 1, totalOccurrences: 1 },
  ],
  coOccurrences: [],
  filterSuggestions: [],
};

const performanceData = {
  type: 'performanceData',
  trends: [],
  sessionCount: 5,
  sessionData: { events: [], platform: 'android' },
  currentLogLabel: '2026-06-12 14-03 contacts session.log',
  heroErrorCount: 7,
  heroWarningCount: 3,
  heroSnapshotSummary: 'Snapshot: 512 MB free',
  heroSparklineData: { freememMb: [820, 790, 760, 712, 690, 642, 604, 581] },
};

const crashlyticsData = {
  type: 'crashlyticsData',
  context: {
    available: true,
    issues: [
      { kind: 'crash', isFatal: true, state: 'OPEN', repetitive: true, regressed: false, userCount: 128, eventCount: 540, title: 'NullPointerException', subtitle: 'in ContactSyncWorker.doWork', firstVersion: '8.1.0', lastVersion: '8.1.1', archived: false, id: 'x1', fingerprint: 'x1' },
      { kind: 'anr', isFatal: false, state: 'OPEN', repetitive: false, regressed: true, userCount: 14, eventCount: 31, title: 'ANR in MainActivity', subtitle: 'Input dispatching timed out', firstVersion: '8.0.9', lastVersion: '8.1.1', archived: false, id: 'x2', fingerprint: 'x2' },
      { kind: 'nonfatal', isFatal: false, state: 'CLOSED', repetitive: false, regressed: false, userCount: 3, eventCount: 7, title: 'TimeoutException on network request', subtitle: 'fetchContacts() timed out after 30s', firstVersion: '8.1.1', lastVersion: '8.1.1', archived: false, id: 'x3', fingerprint: 'x3' },
    ],
    setupHint: '',
    setupChecklist: [],
    helpSections: [],
  },
};

/** Open a panel by its global fn, optionally feed messages, give the render a beat. */
function opener(openFn, messages = []) {
  return async (page) => {
    await page.evaluate(({ fn, msgs }) => {
      if (typeof window[fn] === 'function') window[fn]();
      for (const m of msgs) window.postMessage(m, '*');
    }, { fn: openFn, msgs: messages });
    await page.waitForTimeout(220);
  };
}

export const surfaces = [
  { name: 'signals', clip: '.signal-panel', drive: opener('openSignalPanel', [performanceData, signalData]) },
  { name: 'signals-hover', clip: '.signal-panel', hover: '.signal-trend-row', drive: opener('openSignalPanel', [performanceData, signalData]) },
  { name: 'signals-empty', clip: '.signal-panel', drive: opener('openSignalPanel', []) },
  { name: 'crashlytics', clip: '.crashlytics-panel', drive: opener('openCrashlyticsPanel', [crashlyticsData]) },
  { name: 'crashlytics-empty', clip: '.crashlytics-panel', drive: opener('openCrashlyticsPanel', []) },
  { name: 'performance', clip: '.performance-panel', drive: opener('openPerformancePanel', [performanceData]) },
  { name: 'sql-history', clip: '.sql-query-history-panel', drive: opener('openSqlQueryHistoryPanel', []) },
  { name: 'options', clip: '.options-panel', drive: opener('openOptionsPanel', []) },
];
