/**
 * Per-project conventions for the static source scan (plan 056, Source 3) plus the pure
 * class-name → screen-identity logic. Conventions are app-specific (the contacts app names screens
 * `*_screen.dart` / `*_tab.dart` with `class XxxScreen`), so they live in data here and the scanner
 * stays generic. The identity derivation is pure and unit-tested.
 */

/** A project's screen-discovery convention. */
export interface ScanPreset {
    readonly name: string;
    /** Directories under the project root to walk (forward-slashed, relative). */
    readonly viewDirs: readonly string[];
    /** File-name suffixes that mark a screen/tab/dialog source file. */
    readonly fileSuffixes: readonly string[];
    /** Matches a screen class declaration; group 1 is the class name. */
    readonly classRe: RegExp;
}

/** The contacts app preset (the reference target for plan 056). */
export const CONTACTS_PRESET: ScanPreset = {
    name: 'contacts',
    viewDirs: ['lib/views'],
    fileSuffixes: ['_screen.dart', '_tab.dart'],
    classRe: /^\s*class\s+(\w+(?:Screen|Tab))\b/,
};

/** Trailing class-name words that are role suffixes, not part of the human screen name. */
const ROLE_SUFFIXES = new Set(['Screen', 'Tab', 'Page', 'Dialog']);

/** Split a PascalCase class name into spaced words. */
function spaceWords(className: string): string[] {
    return className.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/);
}

/** Derived identity for a screen class. */
export interface ScreenIdentity {
    /** Normalized key, matching the builder's normalizeKey of a breadcrumb label. */
    readonly key: string;
    /** Human display label, e.g. "Contact View". */
    readonly label: string;
}

/**
 * Derive { key, label } from a class name. Drops one trailing role suffix so `ContactViewScreen`
 * → "Contact View" (NOT dropping "View") and `HomeTab` → "Home". The key matches the builder's
 * label normalization so runtime breadcrumbs join to static nodes (the R6 bridge).
 */
export function deriveScreenIdentity(className: string): ScreenIdentity {
    const words = spaceWords(className);
    if (words.length > 1 && ROLE_SUFFIXES.has(words[words.length - 1])) {
        words.pop();
    }
    const label = words.join(' ');
    return { key: label.toLowerCase().replace(/\s+/g, ' ').trim(), label };
}
