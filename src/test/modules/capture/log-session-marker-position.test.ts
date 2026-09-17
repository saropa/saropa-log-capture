/**
 * Regression tests for the marker position `LogSession` reports to `getSignalDelta` (PLAN 119).
 *
 * These drive the REAL `LogSession` against a real temp directory — not a model of it — because
 * the defect these pin was invisible to any test that supplies boundaries by hand: the boundary
 * math was correct, the position fed into it was not. `appendMarker` only ENQUEUES its write, so a
 * caller reading `partNumber`/`physicalLineCount` at call time records where the file was before
 * the queue backlog drained, not where the marker actually lands. Every line already queued then
 * falls on the wrong side of the boundary, and if the queue splits the file first, the recorded
 * part number names a file the marker was never written to at all.
 *
 * Runs standalone via `node --test out/test/modules/capture/log-session-marker-position.test.js`.
 */

import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { LogSession } from '../../../modules/capture/log-session';
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
        projectName: 'marker-position',
        debugAdapterType: 'dart',
        configurationName: 'debug',
        configuration: {},
        vscodeVersion: '1.105.0',
        extensionVersion: '9.4.2',
        os: process.platform,
        workspaceFolder: { uri: vscode.Uri.file(workspaceRoot), name: 'ws', index: 0 },
    };
}

async function startSession(maxLines = 0): Promise<LogSession> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'saropa-marker-pos-'));
    const session = new LogSession(makeContext(root), makeConfig('reports', maxLines), () => {});
    await session.start();
    return session;
}

/** Split the part file the same way `diskPartReader` does, so indices mean the same thing. */
async function readPartLines(session: LogSession, partNumber: number): Promise<string[]> {
    const dir = path.dirname(session.fileUri.fsPath);
    const base = path.basename(session.fileUri.fsPath).replace(/(_\d{3})?\.log$/, '');
    const body = await fs.readFile(path.join(dir, getPartFileName(base, partNumber)), 'utf-8');
    return body.split('\n');
}

test('marker position accounts for lines still sitting in the append queue', async () => {
    const session = await startSession();
    let reported: { partNumber: number; physicalLineIndex: number } | undefined;

    // A burst of captured output immediately followed by a marker — the exact call pattern of a
    // sibling extension bracketing a command while the app is still producing output.
    for (let i = 0; i < 5; i++) { session.appendLine(`burst line ${i}`, 'stdout', new Date()); }
    session.appendMarker('RUN START', (partNumber, physicalLineIndex) => {
        reported = { partNumber, physicalLineIndex };
    });
    await session.stop();

    assert.ok(reported, 'expected the marker write to report a position');
    const lines = await readPartLines(session, reported.partNumber);
    const actualMarkerIndex = lines.findIndex((l) => l.includes('MARKER: '));
    assert.notStrictEqual(actualMarkerIndex, -1, 'marker should be in the reported part');

    // The reported index is the split point: everything before it is "before the marker", and the
    // marker block itself starts there (its leading blank line first, then the MARKER line).
    assert.strictEqual(reported.physicalLineIndex, actualMarkerIndex - 1);
    for (let i = 0; i < 5; i++) {
        assert.ok(
            lines.slice(0, reported.physicalLineIndex).some((l) => l.includes(`burst line ${i}`)),
            `burst line ${i} was logged before the marker and must fall before the boundary`,
        );
    }
});

test('marker position names the part the marker actually landed in, across splits', async () => {
    // maxLines 3 forces the queue to split the file several times while the burst drains, so a
    // position captured at enqueue time would name part 0 for a marker that lands much later.
    const session = await startSession(3);
    let reported: { partNumber: number; physicalLineIndex: number } | undefined;

    for (let i = 0; i < 10; i++) { session.appendLine(`burst line ${i}`, 'stdout', new Date()); }
    session.appendMarker('RUN START', (partNumber, physicalLineIndex) => {
        reported = { partNumber, physicalLineIndex };
    });
    await session.stop();

    assert.ok(reported, 'expected the marker write to report a position');
    assert.ok(session.partNumber > 0, 'test setup should have forced at least one split');
    assert.strictEqual(reported.partNumber, session.partNumber, 'marker landed in the final part');

    const lines = await readPartLines(session, reported.partNumber);
    const actualMarkerIndex = lines.findIndex((l) => l.includes('MARKER: '));
    assert.strictEqual(reported.physicalLineIndex, actualMarkerIndex - 1);
});

test('marker position is the continuation-header offset when a marker opens a fresh part', async () => {
    // Pins the split-seeding path: performSplit writes the continuation header straight to the new
    // stream, bypassing the counter's choke point, and seeds `_physicalLineCount` from its own line
    // count. A marker written right after must land after that header, not at line 0.
    const session = await startSession(2);
    let reported: { partNumber: number; physicalLineIndex: number } | undefined;

    for (let i = 0; i < 6; i++) { session.appendLine(`line ${i}`, 'stdout', new Date()); }
    session.appendMarker('AFTER SPLIT', (partNumber, physicalLineIndex) => {
        reported = { partNumber, physicalLineIndex };
    });
    await session.stop();

    assert.ok(reported);
    const lines = await readPartLines(session, reported.partNumber);
    assert.ok(reported.physicalLineIndex > 0, 'must sit past the continuation header, not at line 0');
    assert.strictEqual(lines.findIndex((l) => l.includes('MARKER: ')), reported.physicalLineIndex + 1);
});

test('a marker refused by a stopped session never reports a position', async () => {
    const session = await startSession();
    await session.stop();

    let reported = false;
    const text = session.appendMarker('TOO LATE', () => { reported = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(text, undefined, 'a stopped session refuses the marker');
    assert.strictEqual(reported, false, 'a refused marker must not report a position');
});
