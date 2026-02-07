/**
 * Stack frame classification — distinguishes app code from framework/library frames.
 * Works across Dart, Node, Python, Go, and other common runtimes.
 */

/** Patterns that identify framework / library stack frames. */
const frameworkPatterns: RegExp[] = [
    // Dart / Flutter
    /package:flutter\//,
    /\bdart:[a-z]/i,  // dart:async, dart:core — not file.dart:42
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
 * Absolute paths under the workspace take priority over framework patterns
 * to avoid false positives (e.g., a user's `src/runtime/` directory matching
 * the Go runtime pattern). Relative paths fall through to pattern matching.
 */
export function isFrameworkFrame(frameLine: string, workspacePath?: string): boolean {
    const text = frameLine.trim();
    if (!text) {
        return false;
    }
    // Absolute paths containing the workspace root are always app code,
    // even if they match a framework pattern like /runtime/.
    if (workspacePath && containsWorkspacePath(text, workspacePath)) {
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

/** Returns true if the frame text contains the workspace path (slash-normalised). */
function containsWorkspacePath(text: string, workspacePath: string): boolean {
    return text.toLowerCase().replace(/\\/g, '/').includes(
        workspacePath.toLowerCase().replace(/\\/g, '/'),
    );
}

/** Returns true if the frame appears to reference a path within the workspace. */
function isUnderWorkspace(frameLine: string, workspacePath: string): boolean {
    // containsWorkspacePath is already checked by the caller;
    // here we only handle relative paths (assumed to be app code).
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

/** Android logcat pattern: LEVEL/TAG( PID): or LEVEL/TAG: */
const logcatWithPid = /^[VDIWEF]\/(\S+?)\s*\(\s*\d+\):/;
const logcatNoPid = /^[VDIWEF]\/(\S+?):\s/;

/** Dart/Flutter launch and connection boilerplate. */
const launchPatterns: RegExp[] = [
    /^Connecting to VM Service at\s/,
    /^Connected to the VM Service/,
    /^Launching\s.+\sin (?:debug|profile|release) mode/,
    /^[√✓] Built\s/,
];

/**
 * Classify a regular (non-stack-frame) log line as framework or app.
 * Returns true for framework/system output, false for app output,
 * or undefined if the line format is unrecognised.
 */
export function isFrameworkLogLine(text: string): boolean | undefined {
    const m = logcatWithPid.exec(text) ?? logcatNoPid.exec(text);
    if (m) {
        return m[1] !== 'flutter';
    }
    for (const pat of launchPatterns) {
        if (pat.test(text)) { return true; }
    }
    return undefined;
}

/** Detect whether a line is a continuation of a stack trace. Multi-language. */
export function isStackFrameLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) { return false; }
    if (/^\s+at\s/.test(line)) { return true; }
    if (/^#\d+\s/.test(trimmed)) { return true; }
    if (/^\s+File "/.test(line)) { return true; }
    if (/^\s*\u2502\s/.test(line)) { return true; }
    if (/^package:/.test(trimmed)) { return true; }
    return /^\s+\S+\.\S+:\d+/.test(line);
}

/** Extract YYYY-MM-DD date from a session filename like `20250207_143000_name.log`. */
export function extractDateFromFilename(filename: string): string | undefined {
    const m = /^(\d{4})(\d{2})(\d{2})_/.exec(filename);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
