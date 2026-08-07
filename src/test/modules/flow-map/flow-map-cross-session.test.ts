import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    MAX_COMPARE_SESSIONS, findCompareSessions, loadSessionShots, shotsForScreen,
} from '../../../modules/flow-map/flow-map-cross-session';
import type { FlowShot } from '../../../modules/flow-map/flow-map-screenshots';

/**
 * Cross-session compare reads OTHER logs off disk, so these run against real files in a temp
 * directory rather than fixtures — the behavior under test IS the directory scan and the sidecar
 * join, and a mocked filesystem would only test the mock.
 */
suite('FlowMap cross-session compare', () => {
    let dir = '';

    const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
    const nav = (clock: string, name: string) => `[${clock}.000] [console] [log] Screen Navigation: ${name}`;

    setup(async () => {
        dir = path.join(os.tmpdir(), `slc-xsession-${process.hrtime.bigint()}`);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    });

    /** Write a log, and optionally its sidecar + PNGs, exactly as the capturer would lay them out. */
    async function makeSession(name: string, lines: string[], shots: { file: string; logLine: number }[] = []) {
        const logFsPath = path.join(dir, `${name}.log`);
        const enc = new TextEncoder();
        await vscode.workspace.fs.writeFile(vscode.Uri.file(logFsPath), enc.encode(lines.join('\n')));
        if (shots.length === 0) { return logFsPath; }
        const shotDir = path.join(dir, `${name}.screenshots`);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(shotDir));
        for (const s of shots) {
            await vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(shotDir, s.file)), new Uint8Array([1]));
        }
        const sidecar = {
            version: 1,
            screenshots: shots.map((s, i) => ({
                file: s.file, trigger: 'nav', timestamp: 1000 + i, logLine: s.logLine, text: 'x', fingerprint: '',
            })),
        };
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(path.join(dir, `${name}.screenshots.json`)), enc.encode(JSON.stringify(sidecar)),
        );
        return logFsPath;
    }

    const LINES = [...HEAD, nav('08:00:01', 'Home'), nav('08:00:05', 'Emergency Dashboard')];

    test('should offer other sessions that have captures, and never the current one', async () => {
        const self = await makeSession('20260101_090000_app', LINES, [{ file: '001_nav_1.png', logLine: 3 }]);
        await makeSession('20260102_090000_app', LINES, [{ file: '001_nav_1.png', logLine: 3 }]);
        const found = await findCompareSessions(vscode.Uri.file(self));
        assert.deepStrictEqual(found.map(s => s.label), ['20260102_090000_app']);
    });

    test('should ignore a log with no captures — there is nothing to compare against', async () => {
        const self = await makeSession('20260101_090000_app', LINES, [{ file: '001_nav_1.png', logLine: 3 }]);
        await makeSession('20260102_090000_app', LINES);
        assert.deepStrictEqual(await findCompareSessions(vscode.Uri.file(self)), []);
    });

    test('should offer the newest sessions first and cap the list', async () => {
        // Logs are timestamp-named, so a lexical sort IS chronological — that is why the scan does
        // not stat every candidate for a real mtime.
        const self = await makeSession('20260101_000000_app', LINES, [{ file: '001_nav_1.png', logLine: 3 }]);
        for (let i = 1; i <= MAX_COMPARE_SESSIONS + 3; i++) {
            await makeSession(`202602${String(i).padStart(2, '0')}_090000_app`, LINES, [{ file: '001_nav_1.png', logLine: 3 }]);
        }
        const found = await findCompareSessions(vscode.Uri.file(self));
        assert.strictEqual(found.length, MAX_COMPARE_SESSIONS, 'capped');
        assert.ok(found[0].label > found[1].label, 'newest first');
    });

    test('should join another session\'s captures to the screens they were taken on', async () => {
        const other = await makeSession('20260102_090000_app', LINES, [
            { file: '001_nav_1.png', logLine: 3 }, { file: '002_nav_2.png', logLine: 4 },
        ]);
        const shots = await loadSessionShots(other);
        assert.deepStrictEqual(shots.map(s => s.screenLabel), ['Home', 'Emergency Dashboard']);
    });

    test('should drop a capture whose PNG is gone rather than offering a broken pane', async () => {
        const other = await makeSession('20260102_090000_app', LINES, [{ file: '001_nav_1.png', logLine: 3 }]);
        await vscode.workspace.fs.delete(vscode.Uri.file(path.join(dir, '20260102_090000_app.screenshots', '001_nav_1.png')));
        assert.deepStrictEqual(await loadSessionShots(other), []);
    });

    test('should return [] for a session with no sidecar at all', async () => {
        const other = await makeSession('20260102_090000_app', LINES);
        assert.deepStrictEqual(await loadSessionShots(other), []);
    });

    suite('shotsForScreen', () => {
        const shot = (label: string | undefined): FlowShot => ({
            src: 'file:///a.png', path: '/a.png', clock: '08:00:00', trigger: 'nav', logLine: 1,
            screenLabel: label, text: 'x',
        });

        test('should match on the NORMALIZED key so two sessions agree despite spacing or casing', () => {
            const shots = [shot('Emergency   DASHBOARD'), shot('Home')];
            assert.strictEqual(shotsForScreen(shots, 'emergency dashboard').length, 1);
        });

        test('should return nothing for a screen that session never reached', () => {
            assert.deepStrictEqual(shotsForScreen([shot('Home')], 'settings'), []);
        });

        test('should return nothing for an empty key rather than everything', () => {
            // An unanchored capture has no screen; matching it against "" would pair captures that
            // have nothing to do with each other.
            assert.deepStrictEqual(shotsForScreen([shot(undefined), shot('Home')], ''), []);
        });
    });
});
