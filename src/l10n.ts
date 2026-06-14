import * as vscode from 'vscode';
import { stringsA } from './l10n/strings-a';
import { stringsB } from './l10n/strings-b';
import { stringsWebview } from './l10n/strings-webview';
import { stringsWebviewB } from './l10n/strings-webview-b';
import { stringsViewer } from './l10n/strings-viewer';
import { stringsViewerB } from './l10n/strings-viewer-b';
import { stringsViewerC } from './l10n/strings-viewer-c';
import { stringsViewerD } from './l10n/strings-viewer-d';
import { stringsViewerE } from './l10n/strings-viewer-e';
import { stringsViewerF } from './l10n/strings-viewer-f';
import { stringsViewerG } from './l10n/strings-viewer-g';
import { stringsKbd } from './l10n/strings-kbd';
import { stringsSignals } from './l10n/strings-signals';

/**
 * English strings keyed by symbolic ID.
 * Source of truth for default (English) text lives in l10n/strings-a.ts, strings-b.ts,
 * strings-viewer.ts (host-built viewer HTML), and strings-webview.ts (client-side
 * webview strings). Translation bundles in `l10n/` map the English string →
 * translated string.
 */
const strings: Record<string, string> = {
    ...stringsA,
    ...stringsB,
    ...stringsViewer,
    ...stringsViewerB,
    ...stringsViewerC,
    ...stringsViewerD,
    ...stringsViewerE,
    ...stringsViewerF,
    ...stringsViewerG,
    ...stringsKbd,
    ...stringsSignals,
    ...stringsWebview,
    ...stringsWebviewB,
};

/**
 * Localized string lookup. Resolves a symbolic key to its English string,
 * then passes through `vscode.l10n.t()` for translation and argument substitution.
 */
export function t(key: string, ...args: (string | number | boolean)[]): string {
    const message = strings[key] ?? key;
    return args.length > 0
        ? vscode.l10n.t(message, ...args)
        : vscode.l10n.t(message);
}

/**
 * Resolve every webview string key to its translated template (placeholders
 * like `{0}` left intact for client-side substitution). Shipped into the iframe
 * by getWebviewL10nScript() as the `__VT` map. Only webview keys are included so
 * the injected blob stays small — extension-host strings never reach the page.
 */
export function getWebviewL10nMap(): Record<string, string> {
    const map: Record<string, string> = {};
    // Both webview source files feed the client `__VT` map. Keep this in sync
    // when adding another strings-webview-*.ts split — a key only in the merged
    // host `strings` map but missing here would make vt() emit the raw key.
    for (const key of [...Object.keys(stringsWebview), ...Object.keys(stringsWebviewB)]) {
        map[key] = t(key);
    }
    return map;
}
