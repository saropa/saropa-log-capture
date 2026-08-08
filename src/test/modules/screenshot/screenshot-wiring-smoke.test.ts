import * as assert from 'node:assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'saropa.saropa-log-capture';

/**
 * Extension-Host smoke test for the screenshot wiring, exercised through the ACTIVATED extension.
 *
 * Every piece either side of the wiring seam has unit tests; the seam itself had none, so an
 * unregistered command or a handler that throws on its first call would have compiled, passed every
 * test, and shown up only on a real F5 run.
 *
 * Deliberately NOT by calling `registerScreenshotCapture` again: the real extension already
 * registered these command ids during activation, and a second registration throws. Going through
 * the live registration is also the stronger assertion — it proves the wiring the USER gets works,
 * not that a freshly-built copy of it would.
 *
 * Runs under `npm run test`, NOT under `npm run test:smoke` — that script deliberately runs only
 * `extension-smoke.test.js`, the minimal activation check.
 *
 * What is NOT asserted: that a PNG is produced. The transport needs a VM Service or adb, and neither
 * exists on a test machine — `screenshot-pipeline-e2e.test.ts` covers capture and reports the
 * transport failure rather than pretending.
 */
suite('screenshot wiring (Extension Host smoke)', () => {

    /**
     * Run a command as a real Promise. `executeCommand` returns a `Thenable`, which `doesNotReject`
     * does not accept — the conversion is a type requirement, not decoration.
     */
    const run = (command: string): Promise<unknown> =>
        Promise.resolve(vscode.commands.executeCommand(command));

    suiteSetup(async () => {
        // Activation is LAZY: the commands do not exist until something triggers it, so asserting
        // registration without this would pass or fail on test ORDERING rather than on the wiring.
        // Activated directly (the pattern extension-smoke.test.ts uses) rather than by executing a
        // command and swallowing the error: a genuine activation failure then reports itself here,
        // instead of surfacing later as a confusing "the command is not registered".
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext, 'the extension must be present in the Extension Test Host');
        await ext.activate();
    });

    test('should have registered both screenshot commands at activation', async () => {
        const all = await vscode.commands.getCommands(true);
        assert.ok(all.includes('saropaLogCapture.captureScreenshot'), 'the manual capture command');
        assert.ok(all.includes('saropaLogCapture.diagnoseScreenshots'), 'the diagnosis command');
    });

    test('should run the diagnosis command against the live pipeline without throwing', async () => {
        // Covers everything the pure report test cannot: the registration, the side-effecting
        // wrapper, the real settings read, the output-channel reveal, and the no-session path (no
        // debug session runs here, which is exactly the state the report has to describe).
        await assert.doesNotReject(
            () => run('saropaLogCapture.diagnoseScreenshots'),
            'the diagnosis must survive being asked when nothing is running',
        );
    });

    test('should run the diagnosis twice without the second call failing', async () => {
        // The report reads back from disk and touches the store's pending state; running it twice is
        // the cheapest check that it does not consume or mutate what it reports.
        await vscode.commands.executeCommand('saropaLogCapture.diagnoseScreenshots');
        await assert.doesNotReject(() => run('saropaLogCapture.diagnoseScreenshots'));
    });

    test('should survive a manual capture invoked from the palette at any time', async () => {
        // Deliberately asserts only that it does not reject. The OUTCOME depends on session state
        // this suite does not own — every test file shares one Extension Host — so asserting a
        // particular refusal would be asserting something this test cannot control.
        await assert.doesNotReject(() => run('saropaLogCapture.captureScreenshot'));
    });

});

// Manifest coverage — that both ids also appear in `contributes.commands`, so the palette can reach
// them — is deliberately NOT asserted here. `npm run verify:list-commands` checks package.json
// against plans/reference/contributes-commands.md on every compile, and a test that re-checked it
// through `vscode.extensions.getExtension` would depend on an extension lookup that does not resolve
// reliably in the test host.
