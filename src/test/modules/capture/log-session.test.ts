import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import * as vscode from 'vscode';
import { LogSession } from '../../../modules/capture/log-session';
import { defaultSplitRules } from '../../../modules/misc/file-splitter';

function makeSessionConfig(logDir: string, maxLines = 1000): any {
  return {
    includeTimestamp: true,
    includeSourceLocation: false,
    includeElapsedTime: false,
    logDirectory: logDir,
    redactEnvVars: [],
    splitRules: defaultSplitRules(),
    maxLines,
  };
}

function makeSessionContext(workspaceRoot: string): any {
  return {
    date: new Date('2026-03-23T10:00:00.000Z'),
    projectName: 'queue-test',
    debugAdapterType: 'dart',
    configurationName: 'debug',
    configuration: {},
    vscodeVersion: '1.105.0',
    extensionVersion: '3.12.1',
    os: process.platform,
    workspaceFolder: { uri: vscode.Uri.file(workspaceRoot), name: 'ws', index: 0 },
  };
}

suite('LogSession queue safety', () => {
  test('stop drains queued lines before closing stream', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-session-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();
    for (let i = 0; i < 40; i++) {
      session.appendLine(`queued-line-${i}`, 'console', new Date(`2026-03-23T10:00:${String(i % 60).padStart(2, '0')}.000Z`));
    }
    await session.stop();

    const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
    for (let i = 0; i < 40; i++) {
      assert.ok(body.includes(`queued-line-${i}`), `expected queued-line-${i} to be written before stop`);
    }
  });

  test('identical consecutive lines are all written (capture-side dedup bypass)', async () => {
    /* Unified line-collapsing rethink (bugs/unified-line-collapsing.md):
       LogSession no longer routes incoming lines through Deduplicator.process(),
       so identical-within-500ms runs that the old path would have folded to
       `line (x5)` are now each written as their own row. This preserves per-line
       timestamps and 1:1 file-line-number-to-app-output mapping — the viewer
       handles the display-time fold. Regression test pins that every repeat
       reaches disk and no `(xN)` suffix is appended by the capture side. */
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-nodedup-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();
    const identical = 'Error: Connection refused';
    for (let i = 0; i < 5; i++) {
      session.appendLine(identical, 'console', new Date(`2026-03-23T10:02:00.${String(i * 50).padStart(3, '0')}Z`));
    }
    await session.stop();
    const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
    const occurrences = body.split(identical).length - 1;
    assert.strictEqual(occurrences, 5, 'all five identical lines must reach the file');
    assert.ok(!/\(x\d+\)/.test(body), 'capture side must not stamp an (xN) suffix');
  });

  test('physicalLineCount counts the session header; lineCount (split threshold) does not', async () => {
    /* This is the fix for a real bug: screenshot capture recorded a picture's position by reading
       `session.lineCount` and treating it as "the line number in the file" — but that counter
       deliberately skips header/DAP/marker writes (it exists to drive the maxLines split
       threshold, not to number the file), so every capture's recorded line was too small by at
       least the header's own length, growing further with every DAP line and marker for the rest
       of the session. Screenshots attached to the wrong screen in the flow map as a result.
       `physicalLineCount` is the fix: a true count of newlines actually written, counted at the
       one choke point every write passes through. Proven here at the earliest possible moment —
       right after start(), before a single appendLine — where lineCount is necessarily still 0
       but the header has already put several real lines in the file. */
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-physical-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();

    assert.strictEqual(session.lineCount, 0, 'the split-threshold counter has counted nothing yet');
    assert.ok(
      session.physicalLineCount > 1,
      `the physical counter already reflects the header's own multiple lines (got ${session.physicalLineCount})`);

    // Confirm against the file too, once it has actually landed on disk — start() awaits the
    // header WRITE resolving, not the underlying stream's 'open'/flush completing, so a read
    // immediately after start() can race the file's own creation on some platforms.
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const header = await fs.readFile(session.fileUri.fsPath, 'utf-8');
        assert.strictEqual(
          session.physicalLineCount, (header.match(/\n/g) ?? []).length,
          'the physical counter matches the header actually on disk, exactly');
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT' || attempt === 19) { throw err; }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    await session.stop();
  });

  test('physicalLineCount counts every line a marker writes, not the single line lineCount credits it', async () => {
    // appendMarker's block is `\n--- MARKER: … ---\n` + `\n` — three real lines — but only bumps
    // the split-threshold lineCount by one (it is `countsAsLine: true`, not "counts as 3").
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-physical-marker-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();
    const before = session.physicalLineCount;
    session.appendMarker('checkpoint');
    // appendMarker enqueues; give the queue a tick to flush before reading the counter.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const grew = session.physicalLineCount - before;
    assert.ok(grew > 1, `the marker's own real line count (${grew}) must exceed the 1 lineCount would credit it`);

    await session.stop();
    const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
    assert.ok(body.includes('--- MARKER: '), 'the marker text actually reached the file');
  });

  test('physicalLineCount resets to 0 on clear(), matching lineCount', async () => {
    const session = new LogSession(makeSessionContext(os.tmpdir()), makeSessionConfig('reports'), () => {});
    await session.start();
    session.clear();
    assert.strictEqual(session.physicalLineCount, 0);
    assert.strictEqual(session.lineCount, 0);
  });

  test('physicalLineCount is seeded from the continuation header on split, not reset to 0', async () => {
    /* performFileSplit writes the continuation header directly on the new part's raw stream,
       bypassing writeBackpressured (the sole choke point that increments physicalLineCount) — so a
       flat reset-to-0 after a split would undercount every line by the header's own line count until
       the next line landed, reintroducing a narrower version of the screenshot-mismatch bug this
       counter exists to fix. maxLines: 1 forces exactly one split (the split-gating counter now
       resets per part, so a second line does not re-trigger another split immediately). */
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-split-header-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1), () => {});
    await session.start();
    session.appendLine('roll-line-0', 'console', new Date('2026-03-23T10:02:00.000Z'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    session.appendLine('roll-line-1', 'console', new Date('2026-03-23T10:02:01.000Z'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(session.partNumber, 1, 'maxLines: 1 forces exactly one split for a 2nd line');
    assert.ok(session.physicalLineCount > 0, 'not flatly reset to 0 after the split');
    const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
    const actualNewlines = (body.match(/\n/g) ?? []).length;
    assert.strictEqual(
      session.physicalLineCount, actualNewlines,
      `the current part's counter matches its file's real newline count exactly (got ${session.physicalLineCount}, file has ${actualNewlines})`);
    await session.stop();
  });

  test('a write-stream error is caught and the stream dropped, not thrown (crash safety)', async () => {
    /* A Node stream that emits 'error' with no listener throws an uncaught exception that kills the
       extension host (disk full, revoked permission, file deleted mid-capture). The permanent
       'error' handler must catch it, log, and null the stream so the session degrades instead of
       crashing — the file on disk keeps everything written before the failure (append-only). */
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-err-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();

    const internal = session as unknown as { writeStream?: { emit(ev: string, e: Error): boolean } };
    assert.ok(internal.writeStream, 'stream open after start');
    // With no listener this emit would throw synchronously; the handler must absorb it.
    assert.doesNotThrow(() => internal.writeStream!.emit('error', new Error('ENOSPC: simulated disk full')));

    const dropped = session as unknown as { writeStream?: unknown };
    assert.strictEqual(dropped.writeStream, undefined, 'stream dropped after error so appends no-op');
    // Subsequent activity must stay safe: appends are ignored and stop() still resolves cleanly.
    session.appendLine('after-error', 'console', new Date());
    await session.stop();
  });

  test('a marker between lines is written in queue order and counts as a line', async () => {
    /* H2: markers/DAP/header lines used to write directly to the stream, bypassing the ordered queue
       (they could interleave with queued lines and skip split accounting). They now flow through the
       same queue. The marker text is still returned synchronously for the viewer broadcast. */
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-marker-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 1000), () => {});
    await session.start();
    session.appendLine('before-marker', 'console', new Date('2026-03-23T10:00:00.000Z'));
    const markerText = session.appendMarker('checkpoint');
    session.appendLine('after-marker', 'console', new Date('2026-03-23T10:00:01.000Z'));
    await session.stop();

    assert.ok(typeof markerText === 'string' && markerText.includes('checkpoint'), 'marker text returned synchronously');
    const body = await fs.readFile(session.fileUri.fsPath, 'utf-8');
    const beforeIdx = body.indexOf('before-marker');
    const markerIdx = body.indexOf('MARKER: ');
    const afterIdx = body.indexOf('after-marker');
    assert.ok(beforeIdx >= 0 && markerIdx >= 0 && afterIdx >= 0, 'all three present in the file');
    assert.ok(beforeIdx < markerIdx && markerIdx < afterIdx, 'marker is ordered between the two lines');
  });

  test('maxLines rotates parts and preserves newest lines', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-split-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 3), () => {});
    await session.start();
    for (let i = 0; i < 7; i++) {
      session.appendLine(`roll-line-${i}`, 'console', new Date(`2026-03-23T10:01:${String(i % 60).padStart(2, '0')}.000Z`));
    }
    await session.stop();

    const dir = path.dirname(session.fileUri.fsPath);
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.log')).sort();
    // Exactly ceil(7/3) = 3 parts. Previously loose (>= 3) and never caught a real regression: a
    // per-part threshold that never reset (_lineCount, reused for split-gating and never zeroed
    // after a split) meant every line past the FIRST split re-triggered ANOTHER split — 7 lines at
    // maxLines: 3 degenerated into 9 one-line files, and the old >= 3 assertion passed regardless.
    assert.strictEqual(names.length, 3, 'maxLines rotates on a PER-PART threshold, not a cumulative one');

    let merged = '';
    for (const name of names) {
      merged += await fs.readFile(path.join(dir, name), 'utf-8');
    }
    for (let i = 0; i < 7; i++) {
      assert.ok(merged.includes(`roll-line-${i}`), `expected roll-line-${i} across split parts`);
    }
  });

  test('lineCount (status-bar total) keeps climbing across a split; only the split gate resets', async () => {
    // The status bar's "N lines" figure reads LogSession.lineCount and must never drop mid-session
    // — a user watching it fall after a split would read that as data loss, even though every line
    // is still on disk (just in a new part). Only the internal split-gating counter is per-part.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-cumulative-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 2), () => {});
    await session.start();
    for (let i = 0; i < 5; i++) {
      session.appendLine(`cum-line-${i}`, 'console', new Date(`2026-03-23T10:03:${String(i % 60).padStart(2, '0')}.000Z`));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(session.partNumber >= 1, 'maxLines: 2 forced at least one split by the 5th line');
    assert.strictEqual(session.lineCount, 5, 'the cumulative total reflects every line written, not just the current part');
    await session.stop();
  });

  test('high-volume writes preserve order and completeness under backpressure', async () => {
    /* D1 backpressure: a fast producer on a slow disk makes write() return false. The serialized
       append queue now awaits 'drain' before the next write. This must change pacing only — never
       drop or reorder a line. Writing thousands of large lines overruns the default ~16KB stream
       buffer many times, exercising the drain path; every line must still reach disk in order. */
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-log-volume-'));
    const session = new LogSession(makeSessionContext(tmpRoot), makeSessionConfig('reports', 100000), () => {});
    await session.start();
    const count = 3000;
    const pad = 'x'.repeat(200); // big lines so total (~650KB) dwarfs the stream buffer
    for (let i = 0; i < count; i++) {
      session.appendLine(`vol-${i}-${pad}`, 'console', new Date('2026-03-23T10:05:00.000Z'));
    }
    await session.stop();

    // Merge across any split parts (size rules may rotate the file under this volume).
    const dir = path.dirname(session.fileUri.fsPath);
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.log')).sort();
    let merged = '';
    for (const name of names) {
      merged += await fs.readFile(path.join(dir, name), 'utf-8');
    }
    assert.ok(merged.includes('vol-0-'), 'first line present after backpressured writes');
    assert.ok(merged.includes(`vol-${count - 1}-`), 'last line present after backpressured writes');
    assert.ok(merged.indexOf('vol-0-') < merged.indexOf(`vol-${count - 1}-`), 'order preserved');
    for (let i = 0; i < count; i += 250) {
      assert.ok(merged.includes(`vol-${i}-`), `vol-${i} must reach disk`);
    }
  });

  /** A stream whose write() always reports a full buffer, so writeBackpressured must await an event. */
  function alwaysBackpressuredStream(): EventEmitter & { write(d: string): boolean } {
    const em = new EventEmitter() as EventEmitter & { write(d: string): boolean };
    em.write = (): boolean => false;
    return em;
  }

  test('writeBackpressured waits for drain, then resolves and unhooks listeners', async () => {
    const session = new LogSession(makeSessionContext(os.tmpdir()), makeSessionConfig('reports'), () => {});
    const helper = session as unknown as { writeBackpressured(s: unknown, d: string): Promise<void> };
    const stream = alwaysBackpressuredStream();
    let resolved = false;
    const p = helper.writeBackpressured(stream, 'payload').then(() => { resolved = true; });
    await Promise.resolve(); // let the helper register its listeners
    assert.strictEqual(resolved, false, 'must not resolve while the buffer is full (write() === false)');
    stream.emit('drain');
    await p;
    assert.ok(resolved, 'resolves once drain fires');
    assert.strictEqual(stream.listenerCount('drain'), 0, 'drain listener removed');
    assert.strictEqual(stream.listenerCount('error'), 0, 'error listener removed');
    assert.strictEqual(stream.listenerCount('close'), 0, 'close listener removed');
  });

  test('writeBackpressured resolves on error so a dying stream cannot hang the queue', async () => {
    const session = new LogSession(makeSessionContext(os.tmpdir()), makeSessionConfig('reports'), () => {});
    const helper = session as unknown as { writeBackpressured(s: unknown, d: string): Promise<void> };
    const stream = alwaysBackpressuredStream();
    const p = helper.writeBackpressured(stream, 'payload');
    // Stream dies before 'drain' could ever fire — the helper must still resolve, not wait forever.
    stream.emit('error', new Error('ENOSPC: simulated disk full'));
    await p;
    assert.strictEqual(stream.listenerCount('error'), 0, 'temporary error listener removed after resolve');
    assert.strictEqual(stream.listenerCount('drain'), 0, 'drain listener removed after resolve');
  });
});

