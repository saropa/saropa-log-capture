import * as assert from 'assert';
import type * as vscode from 'vscode';
import { getExtensionLogger, setExtensionLogger } from '../../../modules/misc/extension-logger';
import { selfCheckFlowMapPanelScripts } from '../../../ui/panels/flow-map-panel-scripts-self-check';

suite('flow-map panel scripts self-check', () => {
    let originalChannel: vscode.OutputChannel;

    setup(() => { originalChannel = getExtensionLogger(); });
    teardown(() => { setExtensionLogger(originalChannel); });

    test('logs nothing when every generator\'s real output still parses', () => {
        const lines: string[] = [];
        setExtensionLogger({ appendLine: (line: string) => { lines.push(line); } } as unknown as vscode.OutputChannel);

        assert.doesNotThrow(() => selfCheckFlowMapPanelScripts());
        assert.deepStrictEqual(lines, [], 'no warning expected while the five scripts parse cleanly');
    });
});
