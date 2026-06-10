/**
 * Recovers the crashing widget's source location from a Flutter error report.
 *
 * Flutter prints, inside an "Exception caught by …" block:
 *
 *     The relevant error-causing widget was:
 *         ListView ListView:file:///D:/src/contacts/lib/.../culture_religion_picker_dialog.dart:101:14
 *
 * This is the ONLY reliable pointer to the widget that failed when the app emitted no navigation
 * breadcrumb for it (plan 056 — the culture/religion picker crash had no `[log]` line). Parsing it
 * lets the flow map create and anchor a crash node to source even with zero runtime nav signal.
 */

import type { SourceAnchor } from './flow-map-model';

/** The widget name plus its source location, as recovered from the error report. */
export interface ErrorCausingWidget {
    readonly widget: string;
    readonly source?: SourceAnchor;
}

const MARKER = /relevant error-causing widget was:/i;

/**
 * Extract a `file:line` anchor from any text containing a `file:///…/foo.dart:line:col` token.
 *
 * Returns a project-relative path when `projectRoot` is supplied and the file sits under it;
 * otherwise the path is returned as captured (forward-slashed, drive-letter stripped of the
 * `file://` scheme) so the caller still has something clickable.
 */
export function extractDartFileAnchor(text: string, projectRoot?: string): SourceAnchor | undefined {
    // Match an absolute file URI ending in .dart with a line (col optional).
    const m = /file:\/\/\/?([^\s)]+?\.dart):(\d+)(?::\d+)?/i.exec(text);
    if (!m) {
        return undefined;
    }
    const abs = m[1].replace(/\\/g, '/');
    const line = parseInt(m[2], 10);
    return { file: toRelative(abs, projectRoot), line };
}

/** Reduce an absolute path to a project-relative one when it sits under the root. */
function toRelative(absForwardSlash: string, projectRoot?: string): string {
    if (!projectRoot) {
        return absForwardSlash;
    }
    const root = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    const lowerAbs = absForwardSlash.toLowerCase();
    const lowerRoot = root.toLowerCase();
    if (lowerAbs.startsWith(lowerRoot + '/')) {
        return absForwardSlash.slice(root.length + 1);
    }
    return absForwardSlash;
}

/**
 * Scan log lines for the error-causing-widget marker and return the widget + anchor.
 * Returns undefined when the marker is absent. Reads the marker line plus the next few lines,
 * since the widget description sits on the line(s) following the marker.
 */
export function parseErrorCausingWidget(lines: readonly string[], projectRoot?: string): ErrorCausingWidget | undefined {
    for (let i = 0; i < lines.length; i++) {
        if (!MARKER.test(lines[i])) {
            continue;
        }
        // The widget line is the next non-blank line; scan a small window to tolerate wrapping.
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            const widgetLine = lines[j].trim();
            if (!widgetLine) {
                continue;
            }
            return buildWidget(widgetLine, projectRoot);
        }
        return undefined;
    }
    return undefined;
}

/** Build the result from the widget description line. */
function buildWidget(widgetLine: string, projectRoot?: string): ErrorCausingWidget {
    const source = extractDartFileAnchor(widgetLine, projectRoot);
    // The widget name is the identifier immediately before `:file:` (e.g. `ListView ListView:file://…`
    // → "ListView"). This is robust to the leading `[clock] [channel]` log decoration, which a
    // leading-identifier match would otherwise pick up as the timestamp. Fall back to the first
    // capitalized word anywhere on the line.
    const beforeFile = /(\w+)\s*:file:/i.exec(widgetLine);
    const capitalized = /\b([A-Z]\w+)/.exec(widgetLine);
    const widget = beforeFile?.[1] ?? capitalized?.[1] ?? 'Widget';
    return { widget, source };
}
