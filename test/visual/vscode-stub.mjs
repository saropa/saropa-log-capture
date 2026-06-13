/**
 * Minimal `vscode` module stub for the visual harness.
 *
 * `buildViewerHtml()` ultimately calls `vscode.l10n.t()` to resolve English strings (and
 * substitute `{0}` placeholders). Outside the Extension Host that module doesn't exist, so we
 * alias `vscode` to this stub at esbuild time. We only need l10n.t for HTML assembly; the other
 * namespaces are present as inert objects so any incidental top-level `import * as vscode` and
 * member access during module evaluation doesn't throw.
 */

/** Replicate vscode.l10n.t placeholder substitution: "{0}" → args[0], etc. */
function interpolate(message, args) {
  return String(message).replace(/\{(\d+)\}/g, (_, i) => (args[i] !== undefined ? String(args[i]) : '{' + i + '}'));
}

export const l10n = {
  t: (message, ...args) => interpolate(message, args),
  bundle: undefined,
};

export const Uri = {
  joinPath: (base, ...parts) => ({ fsPath: [base && base.fsPath, ...parts].filter(Boolean).join('/'), toString: () => parts.join('/') }),
  file: (p) => ({ fsPath: p, toString: () => p }),
  parse: (s) => ({ fsPath: s, toString: () => s }),
};

export const workspace = {
  getConfiguration: () => ({ get: () => undefined, has: () => false }),
  workspaceFolders: undefined,
};

export const window = { activeColorTheme: { kind: 2 } };
export const env = { language: 'en' };
export const commands = { executeCommand: () => Promise.resolve(undefined) };
export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };

export default { l10n, Uri, workspace, window, env, commands, ColorThemeKind };
