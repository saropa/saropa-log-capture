/**
 * Reads the declared dependency names from a workspace pubspec.yaml so the
 * integration-recommendation surface can map known packages to adapters.
 *
 * Deliberately NOT a full YAML parse: pulling in a parser package for one
 * feature is a blast-radius cost we avoid (plan 106, R1). pubspec dependency
 * blocks are flat `name: version` / `name:` mappings under three fixed
 * top-level keys, which a small indentation-aware line scanner handles
 * correctly without a library.
 */

import * as vscode from 'vscode';

/** Top-level pubspec keys whose direct children are dependency names. */
const dependencySections: ReadonlySet<string> = new Set([
    'dependencies',
    'dev_dependencies',
    'dependency_overrides',
]);

/** Max bytes to read from a manifest (pubspec.yaml / package.json). This large is pathological; cap to avoid blocking. */
const MANIFEST_MAX_READ = 256 * 1024;

/** Count leading space characters (YAML indentation; tabs are invalid in YAML and ignored). */
function leadingSpaces(line: string): number {
    let n = 0;
    while (n < line.length && line[n] === ' ') { n += 1; }
    return n;
}

/** The key portion before the first colon, or undefined if the line is not a `key:` mapping entry. */
function mappingKey(trimmed: string): string | undefined {
    const colon = trimmed.indexOf(':');
    if (colon <= 0) { return undefined; }
    const key = trimmed.slice(0, colon).trim();
    // A real dependency key is a single token; a space means this is a list item or prose, not a key.
    if (key.length === 0 || key.includes(' ')) { return undefined; }
    return key;
}

/**
 * Extract the union of dependency names from `dependencies`, `dev_dependencies`,
 * and `dependency_overrides`. Pure (no I/O) so it is fully unit-testable.
 *
 * Sub-configuration under a block-form dependency (`sdk:`, `git:`, `version:`,
 * `path:`, `hosted:`) is more deeply indented than the dependency name itself,
 * so anchoring on the first child's indent and accepting only lines at exactly
 * that indent excludes it. Malformed input yields whatever names parse cleanly.
 */
export function parsePubspecDependencies(text: string): Set<string> {
    const names = new Set<string>();
    let inSection = false;
    // Indent of direct dependency entries in the current section; -1 until the first child sets it.
    let childIndent = -1;

    for (const raw of text.split(/\r?\n/)) {
        const trimmed = raw.trim();
        // Blank lines do not terminate a section; full-line comments and list items are never dep keys.
        if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('-')) { continue; }

        const indent = leadingSpaces(raw);
        // A top-level key (no indent) opens or closes a dependency section.
        if (indent === 0) {
            const key = mappingKey(trimmed);
            inSection = key !== undefined && dependencySections.has(key);
            childIndent = -1;
            continue;
        }
        if (!inSection) { continue; }

        // Anchor on the first indented entry; deeper lines are this dependency's own sub-config.
        if (childIndent === -1) { childIndent = indent; }
        if (indent !== childIndent) { continue; }

        const name = mappingKey(trimmed);
        if (name) { names.add(name); }
    }
    return names;
}

/**
 * Read pubspec.yaml from a workspace folder and return its declared dependency
 * names. Returns an empty set on any failure (missing file, read error, decode
 * error) so callers can treat "no manifest" and "unreadable manifest" alike —
 * a recommendation surface must never throw at activation.
 */
export async function readPubspecDependencies(rootUri: vscode.Uri): Promise<Set<string>> {
    try {
        const fileUri = vscode.Uri.joinPath(rootUri, 'pubspec.yaml');
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const capped = bytes.length > MANIFEST_MAX_READ ? bytes.subarray(0, MANIFEST_MAX_READ) : bytes;
        const text = Buffer.from(capped).toString('utf-8');
        return parsePubspecDependencies(text);
    } catch {
        return new Set<string>();
    }
}

/** Object whose own enumerable string keys are dependency names. */
function isDependencyRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract dependency names from a package.json's `dependencies` and
 * `devDependencies` maps. Pure (no I/O); tolerates any non-object shape by
 * contributing nothing for that field.
 */
export function parsePackageJsonDependencies(text: string): Set<string> {
    const names = new Set<string>();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return names;
    }
    if (!isDependencyRecord(parsed)) { return names; }
    for (const field of ['dependencies', 'devDependencies']) {
        const block = parsed[field];
        if (isDependencyRecord(block)) {
            for (const key of Object.keys(block)) { names.add(key); }
        }
    }
    return names;
}

/**
 * Read package.json from a workspace folder and return its declared dependency
 * names. Returns an empty set on any failure, mirroring readPubspecDependencies.
 */
export async function readPackageJsonDependencies(rootUri: vscode.Uri): Promise<Set<string>> {
    try {
        const fileUri = vscode.Uri.joinPath(rootUri, 'package.json');
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const capped = bytes.length > MANIFEST_MAX_READ ? bytes.subarray(0, MANIFEST_MAX_READ) : bytes;
        const text = Buffer.from(capped).toString('utf-8');
        return parsePackageJsonDependencies(text);
    } catch {
        return new Set<string>();
    }
}
