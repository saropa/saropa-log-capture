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
    assert.ok(names.length >= 3, 'expected split parts to be created');

    let merged = '';
    for (const name of names) {
      merged += await fs.readFile(path.join(dir, name), 'utf-8');
    }
    for (let i = 0; i < 7; i++) {
      assert.ok(merged.includes(`roll-line-${i}`), `expected roll-line-${i} across split parts`);
    }
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

