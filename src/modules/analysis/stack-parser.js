"use strict";
/**
 * Stack frame classification — distinguishes app code from framework/library frames.
 * Works across Dart, Node, Python, Go, and other common runtimes.
 * Used by viewer stack UI and analysis panel for frame filtering and grouping.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFrameworkFrame = isFrameworkFrame;
exports.isAppFrame = isAppFrame;
exports.classifyLogLine = classifyLogLine;
exports.isFrameworkLogLine = isFrameworkLogLine;
exports.isAsciiBoxDrawingDecorLine = isAsciiBoxDrawingDecorLine;
exports.isStackFrameLine = isStackFrameLine;
exports.parseThreadHeader = parseThreadHeader;
exports.extractDateFromFilename = extractDateFromFilename;
const device_tag_tiers_1 = require("./device-tag-tiers");
/** Patterns that identify framework / library stack frames. */
const frameworkPatterns = [
    // Dart / Flutter
    /package:flutter\//,
    /\bdart:[a-z]/i, // dart:async, dart:core — not file.dart:42
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
function isFrameworkFrame(frameLine, workspacePath) {
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
function containsWorkspacePath(text, workspacePath) {
    return text.toLowerCase().replace(/\\/g, '/').includes(workspacePath.toLowerCase().replace(/\\/g, '/'));
}
/** Returns true if the frame appears to reference a path within the workspace. */
function isUnderWorkspace(frameLine, _workspacePath) {
    // containsWorkspacePath is already checked by the caller;
    // here we only handle relative paths (assumed to be app code).
    if (!hasAbsolutePath(frameLine)) {
        return true;
    }
    return false;
}
/** Detects whether the line contains an absolute path. */
function hasAbsolutePath(text) {
    return /[a-zA-Z]:[\\/]/.test(text) || /(?:^|\s|[(])\/\w/.test(text);
}
/** Returns true if the frame appears to be user (app) code. */
function isAppFrame(frameLine, workspacePath) {
    return !isFrameworkFrame(frameLine, workspacePath);
}
/** Android logcat pattern: LEVEL/TAG( PID): or LEVEL/TAG: */
const logcatWithPid = /^[VDIWEF]\/(\S+?)\s*\(\s*\d+\):/;
const logcatNoPid = /^[VDIWEF]\/(\S+?):\s/;
/** Dart/Flutter launch and connection boilerplate. */
const launchPatterns = [
    /^Connecting to VM Service at\s/,
    /^Connected to the VM Service/,
    /^Launching\s.+\sin (?:debug|profile|release) mode/,
    /^[√✓] Built\s/,
];
/**
 * Android system process output that arrives WITHOUT a logcat prefix.
 *
 * Why these patterns exist: capturing logs over DAP (or via `adb logcat -v raw`,
 * tombstone dumps, system_server stderr) produces lines from the Android system
 * processes — Zygote, system_server, ActivityManager, lmkd, etc. — with no
 * `D/Tag(pid):` prefix. Without classifying these as `device-other`, they fall
 * through to the `tier='flutter'` fallback in `viewer-data-add.ts`, which means
 * the Device Logs `warnplus` gate cannot filter them and the user sees a flood
 * of boot/system noise even with strict level filters off.
 *
 * Each pattern below is anchored at line start and targets a specific message
 * the Android frameworks emit verbatim. Keep them tight — false positives on
 * user app output would mis-classify legitimate app code as device noise.
 */
const androidSystemPatterns = [
    /* Logcat buffer banner emitted between buffer dumps (`main`, `system`,
       `crash`, `events`, `radio`). Definitive marker that what follows is
       device-side log output. */
    /^---------\s+beginning\s+of\s+\w+/,
    /* Saropa-side custom start banner produced by the capture script when it
       enters a new system_server session. Always brackets system process output. */
    /^>>>>>>\s+START\s+com\.[\w.]+/,
    /* Zygote / system_server process lifecycle (boot path).
       Verbatim strings from frameworks/base. */
    /^Forked\s+child\s+process\s+\d+/,
    /^System\s+server\s+process\s+\d+\s+has\s+been\s+created/,
    /^Entering\s+forkRepeatedly\s+native\s+zygote\s+loop/,
    /^Process\s+\S+\s+\(pid\s+\d+\)\s+has\s+died/,
    /^VM\s+exiting\s+with\s+result\s+code/,
    /* Boot preload / class init / JCA boilerplate. */
    /^(?:begin|end)\s+preload$/,
    /^Called\s+ZygoteHooks\.endPreload\(\)/,
    /^Installed\s+(?:AndroidKeyStoreProvider|JCA\s+providers)/,
    /^Warmed\s+up\s+JCA\s+providers/,
    /^Using\s+default\s+boot\s+image$/,
    /^Leaving\s+lock\s+profiling\s+enabled/,
    /^SAFE\s+MODE\s+(?:not\s+)?enabled/,
    /^Memory\s+class:\s*\d+/,
    /^System\s+now\s+ready/,
    /* ActivityManager / WindowManager system_server diagnostics. */
    /^Slow\s+operation:\s+\d+ms\s+so\s+far/,
    /^Override\s+config\s+changes=/,
    /^DeferredDisplayUpdater:/,
    /^Registering\s+transition\s+player/,
    /^ThemeHomeDelay:/,
    /^ProcessObserver\s+broadcast\s+(?:disabled|enabled)/,
    /^Skipping\s+saving\s+the\s+start\s+info/,
    // Android also emits combined verb form "start/bind service ...".
    /^Too\s+early\s+to\s+(?:(?:start|bind)\s+service|start\/bind\s+service)\s+in\s+system_server/,
    /^Current\s+user\s*:\s*\d+/,
    /* Service registration / receiver / unbind diagnostics. */
    /^Unable\s+to\s+(?:start\s+service|find\s+com\.)/,
    /^Receiver\s+with\s+filter\s+\S+\s+already\s+registered/,
    /^Unbind\s+failed:\s+could\s+not\s+find\s+connection/,
    /* lmkd / freezer / display settings boot output. */
    /^Connection\s+with\s+lmkd\s+established/,
    /^lmkd\s+data\s+connection\s+established/,
    /^Freezer\s+(?:timeout\s+set\s+to|exemption\s+set\s+to|enabled|override\s+set\s+to)/,
    /^freezer\s+override\s+set\s+to/,
    /^No\s+existing\s+display\s+settings/,
    /* StatsPullAtomService boot probe — emits "not ready yet" repeatedly. */
    /^StatsPullAtomService\s+not\s+ready\s+yet/,
    /* WebViewLoader / forkRepeatedly native zygote diagnostics. */
    /^mbuffer\s+starts\s+with\s+\d+/,
    /^forkRepeatedly\s+terminated\s+due\s+to\s+non-simple\s+command/,
    /* Accepting command socket connections (Zygote). */
    /^Accepting\s+command\s+socket\s+connections/,
];
/**
 * Classify a regular (non-stack-frame) log line by device tier.
 * Returns a DeviceTier for logcat lines, 'device-other' for launch boilerplate,
 * or undefined if the line format is unrecognised.
 */
function classifyLogLine(text) {
    const m = logcatWithPid.exec(text) ?? logcatNoPid.exec(text);
    if (m) {
        return (0, device_tag_tiers_1.getDeviceTier)(m[1]);
    }
    for (const pat of launchPatterns) {
        if (pat.test(text)) {
            return 'device-other';
        }
    }
    /* Prefixless Android system process output. Run AFTER logcat/launch checks
       so an explicit logcat tag still wins (a hypothetical line that matches
       both should keep its logcat tag classification). */
    for (const pat of androidSystemPatterns) {
        if (pat.test(text)) {
            return 'device-other';
        }
    }
    return undefined;
}
/**
 * Classify a regular (non-stack-frame) log line as framework or app.
 * @deprecated Use classifyLogLine() for tier-aware classification.
 */
function isFrameworkLogLine(text) {
    const tier = classifyLogLine(text);
    if (tier === undefined) {
        return undefined;
    }
    return tier !== 'flutter';
}
/**
 * Unicode vertical-bar variants that commonly pair to form banner side-rails.
 * Covers: │ (light, U+2502), ┃ (heavy, U+2503), ║ (double, U+2551),
 * ╎ (light dashed, U+254E), ╏ (heavy dashed, U+254F),
 * ╽ (light up / heavy down, U+257D), ╿ (heavy up / light down, U+257F).
 * ASCII `|` is intentionally excluded to avoid false-positives on markdown tables
 * and natural text — the 0.6 art-char ratio in isLogViewerSeparatorLine still
 * catches pure-ASCII `|...|` banners via shape.
 */
const DECOR_BAR_CLASS = "[\\u2502\\u2503\\u2551\\u254E\\u254F\\u257D\\u257F]";
/** Bar-pair banner: a vertical bar on each side with content (or just whitespace) between. */
const BAR_PAIR_RE = new RegExp(`^\\s*${DECOR_BAR_CLASS}\\s+(?:.*\\S\\s*)?${DECOR_BAR_CLASS}\\s*$`);
/**
 * Pure box-drawing rule: the whole line (after trimming) is made of box-drawing
 * characters (U+2500–U+257F) and whitespace, with at least two box-drawing chars.
 * Catches rounded/heavy/mixed variants like `╭──╮`, `├──┤`, `╰──╯`, `┏━━┓`, `╒══╕`
 * that earlier bar-pair logic missed because corners/T-connectors are not bars.
 */
const PURE_BOX_RULE_RE = /^\s*[\u2500-\u257F][\u2500-\u257F\s]*[\u2500-\u257F]\s*$/;
/**
 * True for decorative log banners: either paired vertical bars on one line
 * (`│ … │`, `┃ … ┃`, `║ … ║`, …), or a pure box-drawing rule line using any
 * corners/T-connectors (`╭──╮`, `├──┤`, `╰──╯`, `┏━━┓`, `╔══╗`, …). Seen in
 * Drift debug server output (v3.3.3 switched from `┌┐└┘` to rounded `╭╮╰╯`
 * with `├┤` dividers), Isar connect, boxen, rich, etc. These are not trace
 * gutters; the viewer avoids grouping them as stack frames so preview mode
 * does not insert `[+N more]` mid-banner.
 */
function isAsciiBoxDrawingDecorLine(line) {
    return BAR_PAIR_RE.test(line) || PURE_BOX_RULE_RE.test(line);
}
/** Detect whether a line is a continuation of a stack trace. Multi-language. */
function isStackFrameLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
        return false;
    }
    if (/^\s+at\s/.test(line)) {
        return true;
    }
    if (/^#\d+\s/.test(trimmed)) {
        return true;
    }
    if (/^\s+File "/.test(line)) {
        return true;
    }
    if (/^\s*\u2502\s/.test(line)) {
        if (isAsciiBoxDrawingDecorLine(line)) {
            return false;
        }
        return true;
    }
    if (/^package:/.test(trimmed)) {
        return true;
    }
    if (/^\s+\S+\.\S+:\d+/.test(line)) {
        return true;
    }
    // Mid-line Dart source paths: "Method package:foo/bar.dart:1:2" or "(./lib/foo.dart:1:2)"
    if (/\bpackage:\S+\.dart:\d+/.test(line)) {
        return true;
    }
    return /\(\.\/\S+\.dart:\d+:\d+\)/.test(line);
}
/** Thread header patterns for Java/Android/Dart thread dumps. */
const threadHeaderPatterns = [
    // "main" tid=1 Runnable  |  "AsyncTask #1" prio=5 tid=12 Waiting
    {
        pattern: /^"(.+?)"\s+(?:.*?tid=(\d+))?\s*([\w]+)?\s*$/,
        groups: (m) => ({ name: m[1], tid: m[2] ? parseInt(m[2], 10) : undefined, state: m[3] }),
    },
    // --- main ---
    {
        pattern: /^---\s+(\S+)\s+---$/,
        groups: (m) => ({ name: m[1] }),
    },
];
/** Parse a thread header line. Returns undefined if not a thread header. */
function parseThreadHeader(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 200) {
        return undefined;
    }
    for (const { pattern, groups } of threadHeaderPatterns) {
        const m = pattern.exec(trimmed);
        if (m) {
            return groups(m);
        }
    }
    return undefined;
}
/** Extract YYYY-MM-DD date from a session filename like `20250207_143000_name.log`. */
function extractDateFromFilename(filename) {
    const m = /^(\d{4})(\d{2})(\d{2})_/.exec(filename);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
//# sourceMappingURL=stack-parser.js.map