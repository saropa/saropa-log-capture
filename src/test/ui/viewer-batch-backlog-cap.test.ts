import * as assert from 'node:assert';
import {
  appendLiveLineToBatch,
  flushPendingBatch,
  computeBatchDelay,
  MAX_PENDING_LINES,
  type BatchTarget,
} from '../../ui/provider/log-viewer-provider-batch';
import { createThreadDumpState } from '../../ui/viewer/viewer-thread-grouping';
import { type PendingLine } from '../../ui/viewer/viewer-file-loader';

// Regression coverage for bug 001: an unbounded pendingLines staging queue let a
// high-rate firehose grow the extension-host heap until V8 aborted. The cap must
// bound the queue (drop oldest), surface the drop once, and the cadence must
// drain FASTER under backlog, never slower.

interface PostedAddLines {
  readonly type: string;
  readonly lines: readonly PendingLine[];
}

/** Minimal BatchTarget whose view is always visible and which records posts. */
function makeTarget(posted: PostedAddLines[]): BatchTarget {
  return {
    pendingLines: [],
    batchTimer: undefined,
    threadDumpState: createThreadDumpState(),
    getView: () => ({ visible: true }),
    getSeenCategories: () => new Set<string>(),
    postMessage: (msg: unknown) => { posted.push(msg as PostedAddLines); },
  };
}

/** A plain (non-marker, non-stack-frame, non-thread-header) live line. */
function makeLine(i: number): { line: PendingLine; rawText: string } {
  const rawText = `lc ${i}`;
  return {
    line: { text: rawText, rawText, isMarker: false, lineCount: i, category: 'console', timestamp: 0 },
    rawText,
  };
}

/** Drain a target fully via repeated flushPendingBatch; return every posted line in order. */
function drainAll(target: BatchTarget, posted: PostedAddLines[]): PendingLine[] {
  let guard = 0;
  while (target.pendingLines.length > 0) {
    flushPendingBatch(target);
    if (++guard > 100_000) { throw new Error('drain did not terminate'); }
  }
  return posted.filter((m) => m.type === 'addLines').flatMap((m) => [...m.lines]);
}

suite('viewer batch backlog cap (bug 001)', () => {
  test('floods never exceed MAX_PENDING_LINES and account for every dropped line', () => {
    const target = makeTarget([]);
    const total = 200_000;
    for (let i = 0; i < total; i++) {
      const { line, rawText } = makeLine(i);
      appendLiveLineToBatch(target, line, rawText);
    }
    assert.ok(
      target.pendingLines.length <= MAX_PENDING_LINES,
      `queue ${target.pendingLines.length} must stay within ${MAX_PENDING_LINES}`,
    );
    // Conservation: kept + dropped == everything that arrived (nothing vanishes
    // without being counted, mirroring EarlyOutputBuffer's drop accounting).
    assert.strictEqual(
      target.pendingLines.length + (target.droppedLiveLines ?? 0),
      total,
    );
    assert.ok((target.droppedLiveLines ?? 0) > 0, 'a 200k flood must record drops');
  });

  test('posts exactly one drop-notice marker on flush, not one per dropped line', () => {
    const posted: PostedAddLines[] = [];
    const target = makeTarget(posted);
    for (let i = 0; i < 200_000; i++) {
      const { line, rawText } = makeLine(i);
      appendLiveLineToBatch(target, line, rawText);
    }
    const allLines = drainAll(target, posted);
    const markers = allLines.filter((l) => l.isMarker && /dropped/.test(l.rawText ?? ''));
    assert.strictEqual(markers.length, 1, 'exactly one drop notice');
    assert.match(markers[0].rawText ?? '', /viewer backlog cap 20000 reached/);
    assert.strictEqual(target.droppedLiveLines ?? 0, 0, 'counter reset after the notice');
  });

  test('below the cap, nothing is dropped and every line is eventually posted', () => {
    const posted: PostedAddLines[] = [];
    const target = makeTarget(posted);
    const total = 1_000;
    for (let i = 0; i < total; i++) {
      const { line, rawText } = makeLine(i);
      appendLiveLineToBatch(target, line, rawText);
    }
    const allLines = drainAll(target, posted);
    const content = allLines.filter((l) => !l.isMarker);
    const markers = allLines.filter((l) => l.isMarker);
    assert.strictEqual(content.length, total, 'all lines posted under normal volume');
    assert.strictEqual(markers.length, 0, 'no drop notice when under the cap');
    assert.strictEqual(target.droppedLiveLines ?? 0, 0);
  });

  test('cadence drains FASTER under backlog than at rest (Fix B regression guard)', () => {
    const atRest = computeBatchDelay(0);
    const backlogged = computeBatchDelay(50_000);
    assert.strictEqual(atRest, 200, 'normal flush interval unchanged');
    assert.ok(
      backlogged < atRest,
      `under-load delay ${backlogged} must be shorter than at-rest ${atRest}`,
    );
    assert.ok(backlogged > 0, 'still a positive interval');
  });
});
