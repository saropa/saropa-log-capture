/**
 * Tests for signal report context analysis (pure functions, no VS Code dependency).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSessionTiming,
  detectSessionOutcome,
  describeTimelinePosition,
  findPrecedingAction,
  classifyErrorOrigin,
  parseSessionHeader,
  buildFingerprintNote,
} from '../../ui/signals/signal-report-context';

// --- parseSessionTiming ---

test('parseSessionTiming: should parse start and end timestamps', () => {
  const lines = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    'Extension version: 7.0.0',
    'Date:           2026-04-18T02:08:27.252Z',
    '==========================================',
    '',
    '[22:08:33.448] [stdout] some output',
    '',
    '=== SESSION END — 2026-04-18T02:23:09.318Z — 3 lines ===',
  ];
  const timing = parseSessionTiming(lines);
  assert.ok(timing);
  assert.strictEqual(timing.startIso, '2026-04-18T02:08:27.252Z');
  assert.strictEqual(timing.endIso, '2026-04-18T02:23:09.318Z');
  assert.ok(timing.durationMs && timing.durationMs > 0);
});

test('parseSessionTiming: should return undefined when no header found', () => {
  const lines = ['just some random log lines', 'no header here'];
  assert.strictEqual(parseSessionTiming(lines), undefined);
});

test('parseSessionTiming: should handle missing footer gracefully', () => {
  const lines = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    'Date:           2026-04-18T02:08:27.252Z',
    '==========================================',
    'some log output',
  ];
  const timing = parseSessionTiming(lines);
  assert.ok(timing);
  assert.strictEqual(timing.endIso, undefined);
  assert.strictEqual(timing.durationMs, undefined);
});

// --- detectSessionOutcome ---

test('detectSessionOutcome: should detect clean stop', () => {
  const lines = [
    'some output',
    '=== SESSION END — 2026-04-18T02:23:09.318Z — 3 lines ===',
    '',
  ];
  assert.strictEqual(detectSessionOutcome(lines), 'clean-stop');
});

test('detectSessionOutcome: should detect missing footer', () => {
  const lines = ['some output', 'more output', ''];
  assert.strictEqual(detectSessionOutcome(lines), 'no-footer');
});

// --- describeTimelinePosition ---

test('describeTimelinePosition: should describe startup position', () => {
  // Line 1 of 100 = 1%, should be "startup"
  const result = describeTimelinePosition(0, 100);
  assert.ok(result.includes('startup'));
  assert.ok(result.includes('Line 1 of 100'));
});

test('describeTimelinePosition: should describe mid-session position', () => {
  // Line 50 of 100 = 50%, should be "mid-session"
  const result = describeTimelinePosition(49, 100);
  assert.ok(result.includes('mid-session'));
});

test('describeTimelinePosition: should describe late position', () => {
  // Line 90 of 100 = 90%, should be "late"
  const result = describeTimelinePosition(89, 100);
  assert.ok(result.includes('late'));
});

// --- findPrecedingAction ---

test('findPrecedingAction: should find timestamped log output', () => {
  const lines = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    '==========================================',
    '[22:08:33.448] [stdout] some output',
    'Error: something broke',
  ];
  const action = findPrecedingAction(lines, 3);
  assert.ok(action);
  assert.ok(action.includes('[stdout]'));
});

test('findPrecedingAction: should find hot reload action', () => {
  const lines = [
    'some output',
    'Performing hot restart...',
    'Error: crash after restart',
  ];
  const action = findPrecedingAction(lines, 2);
  assert.ok(action);
  assert.ok(action.includes('Performing hot'));
});

test('findPrecedingAction: should return undefined when no action found', () => {
  const lines = ['Error: something broke'];
  assert.strictEqual(findPrecedingAction(lines, 0), undefined);
});

// --- classifyErrorOrigin ---

test('classifyErrorOrigin: should detect config dump lines', () => {
  const lines = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    '  __breakOnConditionalError: false',
    '==========================================',
  ];
  // Line 1 is inside the config dump header
  assert.strictEqual(classifyErrorOrigin(lines[1], lines, 1), 'config-dump');
});

test('classifyErrorOrigin: should detect framework logcat lines', () => {
  const lines = ['E/MediaCodec: Service not found'];
  assert.strictEqual(classifyErrorOrigin(lines[0], lines, 0), 'framework');
});

test('classifyErrorOrigin: should detect app stack frames', () => {
  const lines = ['at com.myapp.MyClass.method(MyClass.java:42)'];
  assert.strictEqual(classifyErrorOrigin(lines[0], lines, 0), 'app');
});

test('classifyErrorOrigin: should detect Java/Android framework frames', () => {
  const lines = ['at android.app.Activity.onCreate(Activity.java:100)'];
  assert.strictEqual(classifyErrorOrigin(lines[0], lines, 0), 'framework');
});

test('classifyErrorOrigin: should return unknown for ambiguous lines', () => {
  const lines = ['TypeError: Cannot read properties of null'];
  assert.strictEqual(classifyErrorOrigin(lines[0], lines, 0), 'unknown');
});

// --- parseSessionHeader ---

test('parseSessionHeader: should parse key fields from header', () => {
  const lines = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    'Extension version: 7.1.1',
    'Date:           2026-04-18T02:08:27.252Z',
    'Debug Adapter:  pwa-extensionHost',
    'launch.json:    Run Extension',
    'VS Code:        1.116.0',
    'OS:             Windows_NT 10.0.22631 (x64)',
    'Git Branch:     main',
    'Git Commit:     b954c08 (dirty)',
    '==========================================',
  ];
  const header = parseSessionHeader(lines);
  assert.strictEqual(header.extensionVersion, '7.1.1');
  assert.strictEqual(header.debugAdapter, 'pwa-extensionHost');
  assert.strictEqual(header.configurationName, 'Run Extension');
  assert.strictEqual(header.vscodeVersion, '1.116.0');
  assert.strictEqual(header.gitBranch, 'main');
});

test('parseSessionHeader: should handle empty log', () => {
  const header = parseSessionHeader([]);
  assert.strictEqual(header.extensionVersion, undefined);
});

// --- buildFingerprintNote ---

test('buildFingerprintNote: should show normalized form when different', () => {
  // A line with timestamps/numbers that will be normalized
  const note = buildFingerprintNote('Error at 2026-04-18T02:08:27.252Z line 42');
  assert.ok(note.includes('Fingerprint key'));
});

test('buildFingerprintNote: should return empty for unchanged text', () => {
  // Simple text that normalization won't change
  const note = buildFingerprintNote('Error');
  assert.strictEqual(note, '');
});
