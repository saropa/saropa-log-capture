import * as assert from 'assert';
import * as vscode from 'vscode';
import { ErrorSnackbarNotifier, type ErrorSnackbarDeps } from '../../../modules/features/error-snackbar';
import type { LineData } from '../../../modules/session/session-event-bus';

/** Build a LineData with sensible defaults; override per test. */
function makeLine(partial: Partial<LineData> & { text: string }): LineData {
    return {
        isMarker: false,
        lineCount: 10,
        category: 'stdout',
        timestamp: new Date(0),
        logFileUri: 'file:///logs/app.log',
        ...partial,
    };
}

suite('ErrorSnackbarNotifier', () => {
    let shown: { message: string; buttons: string[] }[];
    let opened: { fileUri: string; line: number }[];
    let reported: { text: string; lineIndex: number; fileUri: string }[];
    let pickButton: string | undefined;
    let clock: number;
    let originalShow: typeof vscode.window.showWarningMessage;

    /** Flush the fire-and-forget showSnackbar() microtask chain so routing assertions can run. */
    const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    function makeNotifier(enabled = true): ErrorSnackbarNotifier {
        const deps: ErrorSnackbarDeps = {
            isEnabled: () => enabled,
            openLogAtLine: (fileUri, line) => { opened.push({ fileUri, line }); },
            openReport: (text, lineIndex, fileUri) => { reported.push({ text, lineIndex, fileUri }); },
            now: () => clock,
        };
        return new ErrorSnackbarNotifier(deps);
    }

    setup(() => {
        shown = [];
        opened = [];
        reported = [];
        pickButton = undefined;
        clock = 100000; // arbitrary base far from 0 so the first line clears the cooldown
        originalShow = vscode.window.showWarningMessage;
        // Record every snackbar and resolve with the test-selected button.
        (vscode.window as { showWarningMessage: unknown }).showWarningMessage = (
            message: string,
            ...buttons: string[]
        ): Thenable<string | undefined> => {
            shown.push({ message, buttons });
            return Promise.resolve(pickButton);
        };
    });

    teardown(() => {
        (vscode.window as { showWarningMessage: unknown }).showWarningMessage = originalShow;
    });

    test('shows one snackbar for an error line with both action buttons', () => {
        makeNotifier().onLine(makeLine({ text: 'NullPointerException at foo' }));
        assert.strictEqual(shown.length, 1);
        assert.ok(shown[0].message.includes('NullPointerException at foo'));
        assert.deepStrictEqual(shown[0].buttons, ['Open Log', 'Error Report']);
    });

    test('does not fire for non-error, marker, or warning-only lines', () => {
        const n = makeNotifier();
        n.onLine(makeLine({ text: 'plain info line, nothing here' }));
        n.onLine(makeLine({ text: 'SESSION END', isMarker: true }));
        n.onLine(makeLine({ text: 'this is only a warning', category: 'stdout' }));
        assert.strictEqual(shown.length, 0);
    });

    test('does not fire when the setting is off', () => {
        makeNotifier(false).onLine(makeLine({ text: 'FatalError: boom' }));
        assert.strictEqual(shown.length, 0);
    });

    test('does not fire when the line has no origin file', () => {
        makeNotifier().onLine(makeLine({ text: 'TypeError: bad', logFileUri: undefined }));
        assert.strictEqual(shown.length, 0);
    });

    test('coalesces fingerprint-variant errors (same signature, different port)', () => {
        const n = makeNotifier();
        n.onLine(makeLine({ text: 'SocketException: connection refused on port 5432' }));
        clock += 10000; // past the cooldown, so only the fingerprint can suppress the second
        n.onLine(makeLine({ text: 'SocketException: connection refused on port 5488' }));
        assert.strictEqual(shown.length, 1);
    });

    test('suppresses a distinct error inside the cooldown, then shows it after', () => {
        const n = makeNotifier();
        n.onLine(makeLine({ text: 'FirstError: alpha' }));
        assert.strictEqual(shown.length, 1);
        // Distinct error 1s later — within the 4s cooldown → suppressed.
        clock += 1000;
        n.onLine(makeLine({ text: 'SecondError: beta' }));
        assert.strictEqual(shown.length, 1);
        // Same distinct error after the cooldown elapses → now shows (it was never remembered).
        clock += 4000;
        n.onLine(makeLine({ text: 'SecondError: beta' }));
        assert.strictEqual(shown.length, 2);
    });

    test('routes "Open Log" to openLogAtLine with the 1-based line', async () => {
        pickButton = 'Open Log';
        makeNotifier().onLine(makeLine({ text: 'RangeError: oops', lineCount: 42 }));
        await flush();
        assert.deepStrictEqual(opened, [{ fileUri: 'file:///logs/app.log', line: 42 }]);
        assert.strictEqual(reported.length, 0);
    });

    test('routes "Error Report" to openReport with the 0-based line index', async () => {
        pickButton = 'Error Report';
        makeNotifier().onLine(makeLine({ text: 'StateError: nope', lineCount: 42 }));
        await flush();
        assert.deepStrictEqual(reported, [
            { text: 'StateError: nope', lineIndex: 41, fileUri: 'file:///logs/app.log' },
        ]);
        assert.strictEqual(opened.length, 0);
    });

    test('dismissing the snackbar routes to neither action', async () => {
        pickButton = undefined; // user closed the notification without picking
        makeNotifier().onLine(makeLine({ text: 'AssertionError: x' }));
        await flush();
        assert.strictEqual(opened.length, 0);
        assert.strictEqual(reported.length, 0);
    });
});
