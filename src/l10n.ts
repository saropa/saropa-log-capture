import * as vscode from 'vscode';
import { stringsA } from './l10n/strings-a';
import { stringsB } from './l10n/strings-b';

/**
 * English strings keyed by symbolic ID.
 * Source of truth for default (English) text lives in l10n/strings-a.ts and l10n/strings-b.ts.
 * Translation bundles in `l10n/` map the English string → translated string.
 */
const strings: Record<string, string> = { ...stringsA, ...stringsB };

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
