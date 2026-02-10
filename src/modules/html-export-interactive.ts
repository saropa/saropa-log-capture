/**
 * Interactive HTML export module.
 *
 * Creates a self-contained, shareable HTML file with embedded JavaScript that
 * works completely offline. Unlike the static HTML export, this version includes
 * interactive features:
 *
 * - **Search**: Ctrl+F to open, F3/Shift+F3 for next/previous match
 * - **Category filter**: Multi-select dropdown to show/hide stdout/stderr/console
 * - **Collapsible stack traces**: Click to expand/collapse error frames
 * - **Collapsible JSON**: Inline JSON objects expand to pretty-printed view
 * - **Theme toggle**: Switch between dark and light themes
 * - **Word wrap toggle**: Toggle between wrapped and horizontal scroll
 *
 * The HTML file embeds all CSS and JavaScript inline - no external dependencies.
 * This makes it perfect for sharing via email, Slack, or archiving.
 *
 * @example
 * // Right-click a session in history -> "Export as HTML (Interactive)"
 * // Opens the generated HTML file in the default browser
 */

import * as vscode from 'vscode';
import { ansiToHtml, escapeHtml } from './ansi';
import { SessionMetadataStore } from './session-metadata';
import { getInteractiveStyles } from './html-export-styles';
import { getInteractiveScript } from './html-export-script';
import { wrapJsonInLine } from './html-export-json';

/**
 * Parsed representation of a log line with metadata for rendering.
 * Used internally during HTML generation.
 */
interface ParsedLine {
    /** Raw line text from the log file */
    readonly text: string;
    /** HTML-rendered version with ANSI colors converted */
    readonly html: string;
    /** DAP output category (stdout, stderr, console) */
    readonly category: string;
    /** True if this line starts a stack trace (matches /^\s+at\s/) */
    readonly isStackFrame: boolean;
}

/**
 * Export a log file to an interactive HTML file.
 *
 * Reads the .log file, converts ANSI codes to HTML, wraps JSON in collapsible
 * elements, groups stack traces, and generates a complete HTML document with
 * embedded CSS and JavaScript.
 *
 * @param logUri - URI of the .log file to export
 * @returns URI of the generated .html file (same location, .html extension)
 */
export async function exportToInteractiveHtml(logUri: vscode.Uri): Promise<vscode.Uri> {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');

    const { headerLines, bodyLines } = splitHeader(lines);
    const headerHtml = headerLines.map(l => escapeHtml(l)).join('\n');

    const store = new SessionMetadataStore();
    const annotations = await store.getAnnotations(logUri);
    const annotationMap = new Map(annotations.map(a => [a.lineIndex, a.text]));

    const parsed = parseLines(bodyLines);
    const categories = extractCategories(parsed);
    const bodyHtml = buildInteractiveBody(parsed, annotationMap);

    const htmlPath = logUri.fsPath.replace(/\.log$/, '.html');
    const htmlUri = vscode.Uri.file(htmlPath);
    const content = buildInteractiveHtmlDocument(headerHtml, bodyHtml, categories);
    await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(content, 'utf-8'));
    return htmlUri;
}

/**
 * Split log content into header and body sections.
 *
 * Log files start with a context header (session metadata) followed by a
 * divider line of "====...". This function separates them so the header
 * can be rendered as a collapsible details element.
 *
 * @param lines - All lines from the log file
 * @returns Object with headerLines (metadata) and bodyLines (actual log output)
 */
function splitHeader(lines: string[]): { headerLines: string[]; bodyLines: string[] } {
    // Find the divider line that separates metadata from log output
    const divider = lines.findIndex(l => l.startsWith('===================='));
    if (divider < 0) {
        // No header found - treat entire file as body
        return { headerLines: [], bodyLines: lines };
    }
    return {
        headerLines: lines.slice(0, divider + 1),  // Include divider in header
        bodyLines: lines.slice(divider + 1),
    };
}

/**
 * Parse all log lines into structured data for rendering.
 *
 * Converts ANSI escape codes to HTML spans, extracts the DAP category,
 * and detects stack trace frames (lines starting with whitespace + "at ").
 *
 * @param lines - Body lines from the log file (after header split)
 * @returns Array of ParsedLine objects ready for HTML generation
 */
function parseLines(lines: string[]): ParsedLine[] {
    return lines.map(line => {
        const category = extractCategory(line);
        // Stack frames in most languages start with "   at " or "\tat "
        const isStackFrame = /^\s+at\s/.test(line);
        return {
            text: line,
            html: ansiToHtml(line),
            category,
            isStackFrame,
        };
    });
}

/**
 * Extract the DAP output category from a log line.
 *
 * Our log format prefixes lines with [category] when available.
 * Falls back to 'console' if no category tag is found.
 *
 * @param line - A single log line
 * @returns The category string (stdout, stderr, console, etc.)
 */
function extractCategory(line: string): string {
    const match = line.match(/^\[(\w+)\]/);
    return match ? match[1] : 'console';
}

/**
 * Collect unique categories from all parsed lines.
 *
 * Used to populate the filter dropdown with available options.
 * Returns sorted array for consistent ordering.
 *
 * @param lines - All parsed log lines
 * @returns Sorted array of unique category names
 */
function extractCategories(lines: ParsedLine[]): string[] {
    const cats = new Set<string>();
    for (const line of lines) {
        cats.add(line.category);
    }
    return Array.from(cats).sort();
}

/**
 * Build the HTML body with interactive elements.
 *
 * Processes parsed lines to:
 * 1. Group consecutive stack frames into collapsible sections
 * 2. Wrap detected JSON in collapsible elements
 * 3. Add data attributes for filtering (data-cat, data-idx)
 * 4. Include any line annotations from session metadata
 *
 * @param lines - Parsed log lines
 * @param annotations - Map of line index to annotation text
 * @returns HTML string for the log content
 */
function buildInteractiveBody(lines: ParsedLine[], annotations: Map<number, string>): string {
    const parts: string[] = [];
    let groupId = 0;
    let inStackGroup = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cls = line.category === 'stderr' ? 'line cat-stderr' : 'line';

        if (line.isStackFrame) {
            if (!inStackGroup) {
                inStackGroup = true;
                groupId++;
                parts.push(`<div class="stack-header collapsed" data-gid="${groupId}">▶ ${line.html}</div>`);
                parts.push(`<div class="stack-frames" data-gid="${groupId}" style="display:none">`);
            } else {
                parts.push(`<div class="${cls}" data-idx="${i}" data-cat="${line.category}">${line.html}</div>`);
            }
        } else {
            if (inStackGroup) {
                parts.push('</div>');
                inStackGroup = false;
            }
            const jsonHtml = wrapJsonInLine(line.html);
            parts.push(`<div class="${cls}" data-idx="${i}" data-cat="${line.category}">${jsonHtml}</div>`);
        }

        const ann = annotations.get(i);
        if (ann) {
            parts.push(`<div class="annotation">[Note: ${escapeHtml(ann)}]</div>`);
        }
    }

    if (inStackGroup) {
        parts.push('</div>');
    }

    return parts.join('\n');
}

function buildInteractiveHtmlDocument(headerHtml: string, bodyHtml: string, categories: string[]): string {
    const catOptions = categories.map(c => `<option value="${c}" selected>${c}</option>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saropa Log Capture</title>
<style>
${getInteractiveStyles()}
</style>
</head>
<body class="dark-theme">
<div id="toolbar">
    <button id="theme-toggle" title="Toggle theme">☀️</button>
    <div id="search-bar" style="display:none">
        <input id="search-input" type="text" placeholder="Search..." />
        <span id="match-count"></span>
        <button id="search-prev" title="Previous (Shift+F3)">◀</button>
        <button id="search-next" title="Next (F3)">▶</button>
        <button id="search-close" title="Close (Esc)">✕</button>
    </div>
    <select id="filter-select" multiple title="Filter by category">
        ${catOptions}
    </select>
    <button id="wrap-toggle">Wrap</button>
    <span id="stats"></span>
</div>
<details open id="header-section">
    <summary>Session Context</summary>
    <div class="header-block"><pre>${headerHtml}</pre></div>
</details>
<div id="log-content" class="nowrap">
${bodyHtml}
</div>
<div id="footer">
    <span id="footer-text">Interactive Log Viewer</span>
    <span id="hidden-count"></span>
</div>
<script>
${getInteractiveScript()}
</script>
</body>
</html>`;
}

