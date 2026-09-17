/**
 * Regression tests for the physical line number a captured line reports to its observers.
 *
 * `LineData.physicalLineCount` is documented as "true physical line number of THIS line ... read
 * AFTER this line's own write", and its two consumers — the error snackbar's "Open Log" jump and
 * screenshot capture's flow-map position — both carry comments saying a wrong value here is the
 * bug that attached screenshots to the wrong screen. It was nonetheless being read on the
 * statement after `appendLine`, which only ENQUEUES: under any queue backlog the reported number
 * pointed earlier than the line really was, and across a split it named the wrong part.
 *
 * These drive the real `LogSession` against real files, because a mock that writes synchronously
 * cannot reproduce a backlog — which is the entire defect.
 *
 * Runs standalone via `node --test out/test/modules/capture/log-session-line-position.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { LogSession, type WritePosition } from '../../../modules/capture/log-session';
import { getPartFileName } from '../../../modules/capture/log-session-split';
import { defaultSplitRules } from '../../../modules/misc/file-splitter';

function makeConfig(logDir: string, maxLines = 0): any {
    return {
        includeTimestamp: false,
        includeSourceLocation: false,
        includeElapsedTime: false,
        logDirectory: logDir,
        redactEnvVars: [],
        splitRules: defaultSplitRules(),
        maxLines,
    };
}

function makeContext(workspaceRoot: string): any {
    return {
        date: new Date('2026-09-17T12:00:00.000Z'),
        projectName: 'line-position',
        debugAdapterType: 'dart',
        configurationName: 'debug',
        configuration: {},
        vscodeVersion: '1.105.0',
        extensionVersion: '9.5.0',
        os: process.platform,
        workspaceFolder: { uri: vscode.Uri.file(workspaceRoot), name: 'ws', index: 0 },
    };
}

async function startSession(maxLines = 0): Promise<LogSession> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-line-pos-'));
    const session = new LogSession(makeContext(root), makeConfig('reports', maxLines), () => {});
    await session.start();
    return session;
}

/** Split the part file the way every reader of these positions does. */
async function readPartLines(session: LogSession, partNumber: number): Promise<string[]> {
    const dir = path.dirname(session.fileUri.fsPath);
    const base = path.basename(session.fileUri.fsPath).replace(/(_\d{3})?\.log$/, '');
    const body = await fs.readFile(path.join(dir, getPartFileName(base, partNumber)), 'utf-8');
    return body.split('\n');
}

test('a reported line number is that line\'s real 1-based position in the file', async () => {
    const session = await startSession();
    const reported = new Map<string, WritePosition>();

    // A burst, so the queue is genuinely backed up when the later lines are enqueued.
    for (let i = 0; i < 20; i++) {
        const text = `burst line ${i}`;
        session.appendLine(text, 'stdout', new Date(), { onWritten: (p) => reported.set(text, p) });
    }
    await session.stop();

    assert.strictEqual(reported.size, 20, 'every written line must report a position');
    const lines = await readPartLines(session, 0);
    for (const [text, position] of reported) {
        // `after` is the 1-based line number, so the line itself sits at index after-1.
        assert.ok(lines[position.after - 1].includes(text), `"${text}" should be at line ${position.after}`);
    }
});

test('the header is counted, so the first captured line is not line 1', async () => {
    // The exact drift this field exists to catch: `lineCount` skips header/DAP/marker writes, so
    // anything using it as a file position starts out wrong by the header and grows from there.
    const session = await startSession();
    let position: WritePosition | undefined;
    session.appendLine('first captured', 'stdout', new Date(), { onWritten: (p) => { position = p; } });
    await session.stop();

    assert.ok(position);
    assert.ok(position.after > 1, `expected the header to be counted, got line ${position.after}`);
    const lines = await readPartLines(session, 0);
    assert.ok(lines[position.after - 1].includes('first captured'));
});

test('positions follow the line into the part the split put it in', async () => {
    const session = await startSession(3);
    const reported = new Map<string, WritePosition>();
    for (let i = 0; i < 12; i++) {
        const text = `split line ${i}`;
        session.appendLine(text, 'stdout', new Date(), { onWritten: (p) => reported.set(text, p) });
    }
    await session.stop();

    assert.ok(session.partNumber > 0, 'test setup should have forced at least one split');
    const parts = new Set([...reported.values()].map((p) => p.partNumber));
    assert.ok(parts.size > 1, 'lines should be spread across parts');

    for (const [text, position] of reported) {
        const lines = await readPartLines(session, position.partNumber);
        assert.ok(
            lines[position.after - 1].includes(text),
            `"${text}" should be at line ${position.after} of part ${position.partNumber}`,
        );
    }
});

test('a line dropped because the session was cleared never reports a position', async () => {
    // The viewer/file agreement bug_011 is about: a line announced but never written is a line the
    // saved file does not contain, which desyncs bookmarks and exports from what the viewer shows.
    const session = await startSession();
    let reported = 0;
    for (let i = 0; i < 10; i++) {
        session.appendLine(`dropped ${i}`, 'stdout', new Date(), { onWritten: () => { reported++; } });
    }
    session.clear();
    await session.stop();

    const lines = await readPartLines(session, 0);
    const written = lines.filter((l) => l.includes('dropped ')).length;
    assert.strictEqual(reported, written, 'reported positions must match what actually reached the file');
});

test('a throwing observer costs its own notification, not the queue', async () => {
    // These observers now run inside the append queue, so an exception from one would otherwise
    // abort the loop and strand every line behind it.
    const session = await startSession();
    let laterLineWritten = false;
    session.appendLine('poison', 'stdout', new Date(), {
        onWritten: () => { throw new Error('observer blew up'); },
    });
    session.appendLine('after poison', 'stdout', new Date(), {
        onWritten: () => { laterLineWritten = true; },
    });
    await session.stop();

    assert.ok(laterLineWritten, 'the queue must keep going after a bad observer');
    const lines = await readPartLines(session, 0);
    assert.ok(lines.some((l) => l.includes('poison')), 'the poison line itself is still written');
    assert.ok(lines.some((l) => l.includes('after poison')), 'and so is everything behind it');
});

test('a line is reported once, not once per observer call', async () => {
    const session = await startSession();
    let calls = 0;
    session.appendLine('single', 'stdout', new Date(), { onWritten: () => { calls++; } });
    await session.stop();
    assert.strictEqual(calls, 1);
});
