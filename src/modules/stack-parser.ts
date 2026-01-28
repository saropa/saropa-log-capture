/**
 * Stack frame classification — distinguishes app code from framework/library frames.
 * Works across Dart, Node, Python, Go, and other common runtimes.
 */

/** Patterns that identify framework / library stack frames. */
const frameworkPatterns: RegExp[] = [
    // Dart / Flutter
    /package:flutter\//,
    /\bdart:/,
    // Node.js
    /\bnode_modules\//,
    /\bnode:internal\//,
    /\bnode:/,
    /<anonymous>/,
    // Python
    /\/lib\/python\d/,
    /\bsite-packages\//,
    // Go
    /\/usr\/local\/go\//,
    /\bruntime\//,
    /\bruntime\/internal\//,
    // Java / Kotlin
    /\bjava\./,
    /\bjavax\./,
    /\bsun\./,
    /\bcom\.sun\./,
    /\borg\.gradle\./,
    /\bkotlin\./,
    /\bkotlinx\./,
    // .NET / C#
    /\bSystem\./,
    /\bMicrosoft\./,
];

/**
 * Returns true if the frame line appears to come from a framework or library,
 * rather than the user's own application code.
 *
 * Checks against known framework path patterns first. If the workspace path
 * is provided and the frame contains an absolute path, frames outside the
 * workspace are treated as framework code.
 */
export function isFrameworkFrame(frameLine: string, workspacePath?: string): boolean {
    const text = frameLine.trim();
    if (!text) {
        return false;
    }
    for (const pat of frameworkPatterns) {
        if (pat.test(text)) {
            return true;
        }
    }
    if (workspacePath) {
        return !isUnderWorkspace(text, workspacePath);
    }
    return false;
}

/** Returns true if the frame appears to reference a path within the workspace. */
function isUnderWorkspace(frameLine: string, workspacePath: string): boolean {
    const lower = frameLine.toLowerCase();
    const wsLower = workspacePath.toLowerCase().replace(/\\/g, '/');
    // Check forward-slash normalised path.
    if (lower.replace(/\\/g, '/').includes(wsLower)) {
        return true;
    }
    // Relative paths (no drive letter or leading /) are assumed to be app code.
    if (!hasAbsolutePath(frameLine)) {
        return true;
    }
    return false;
}

/** Detects whether the line contains an absolute path. */
function hasAbsolutePath(text: string): boolean {
    return /[a-zA-Z]:[\\/]/.test(text) || /(?:^|\s|[(])\/\w/.test(text);
}

/** Returns true if the frame appears to be user (app) code. */
export function isAppFrame(frameLine: string, workspacePath?: string): boolean {
    return !isFrameworkFrame(frameLine, workspacePath);
}
