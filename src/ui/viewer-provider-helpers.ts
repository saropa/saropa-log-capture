/** Helper functions for LogViewerProvider — message handlers and batch processing. */
import * as vscode from "vscode";
import { findHeaderEnd } from "./viewer-file-loader";
import { isFrameworkFrame, isFrameworkLogLine, parseThreadHeader } from "../modules/stack-parser";
import { stripAnsi } from "../modules/ansi";
import { resolveSourceUri } from "../modules/source-resolver";
import { TreeItem, isSplitGroup } from "./session-history-grouping";
import { PendingLine } from "./viewer-file-loader";
import { formatMtime, formatMtimeTimeOnly, formatRelativeTime } from "./session-display";

/** Input data for editing a log line. */
export interface EditLineInput {
	readonly lineIndex: number;
	readonly newText: string;
	readonly timestamp: number;
	readonly loadFromFile: (uri: vscode.Uri) => Promise<void>;
}

/** Handle editing a log line in the current file. */
export async function handleEditLine(
	currentFileUri: vscode.Uri | undefined,
	isSessionActive: boolean,
	input: EditLineInput,
): Promise<void> {
	if (!currentFileUri) {
		vscode.window.showWarningMessage("No log file is currently loaded for editing.");
		return;
	}

	if (isSessionActive) {
		const choice = await vscode.window.showWarningMessage(
			"A debug session is active. Editing the log file now may cause data loss or corruption.",
			{ modal: true },
			"Edit Anyway",
			"Cancel"
		);
		if (choice !== "Edit Anyway") { return; }
	}

	try {
		const raw = await vscode.workspace.fs.readFile(currentFileUri);
		const text = Buffer.from(raw).toString("utf-8");
		const lines = text.split(/\r?\n/);
		const dataStartIndex = findHeaderEnd(lines);
		const targetIndex = dataStartIndex + input.lineIndex;

		if (targetIndex < dataStartIndex || targetIndex >= lines.length) {
			vscode.window.showErrorMessage(`Line index ${input.lineIndex} is out of range.`);
			return;
		}

		lines[targetIndex] = input.newText;
		const newContent = lines.join('\n');
		await vscode.workspace.fs.writeFile(currentFileUri, Buffer.from(newContent, 'utf-8'));
		vscode.window.showInformationMessage(`Line ${input.lineIndex + 1} updated successfully.`);
		await input.loadFromFile(currentFileUri);
	} catch (err) {
		throw new Error(`File edit failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Handle exporting logs to a file.
 */
export async function handleExportLogs(text: string, options: Record<string, unknown>): Promise<void> {
	// Prompt user to choose save location
	const uri = await vscode.window.showSaveDialog({
		defaultUri: vscode.Uri.file('exported-logs.txt'),
		filters: {
			'Text Files': ['txt', 'log'],
			'All Files': ['*']
		},
		saveLabel: 'Export Logs'
	});

	if (!uri) {
		return; // User cancelled
	}

	try {
		// Write the exported content to the selected file
		await vscode.workspace.fs.writeFile(
			uri,
			Buffer.from(text, 'utf-8')
		);

		const lineCount = options.lineCount ?? 0;
		const levels = (options.levels as string[]) ?? [];
		const levelStr = levels.length > 0 ? ` (${levels.join(', ')})` : '';

		vscode.window.showInformationMessage(
			`Exported ${lineCount} line${lineCount === 1 ? '' : 's'}${levelStr} to ${uri.fsPath}`
		);
	} catch (err) {
		throw new Error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Flush batched lines to the webview.
 */
export function flushBatch(
	pendingLines: PendingLine[],
	isReady: boolean,
	postMessage: (msg: unknown) => void,
	sendNewCategories: (lines: readonly PendingLine[]) => void
): void {
	if (pendingLines.length === 0 || !isReady) { return; }
	const lines = pendingLines.splice(0);
	postMessage({ type: "addLines", lines, lineCount: lines[lines.length - 1].lineCount });
	sendNewCategories(lines);
}

/**
 * Send new categories to the webview.
 */
export function sendNewCategories(
	lines: readonly PendingLine[],
	seenCategories: Set<string>,
	postMessage: (msg: unknown) => void
): void {
	const newCats: string[] = [];
	for (const ln of lines) {
		if (!ln.isMarker && !seenCategories.has(ln.category)) {
			seenCategories.add(ln.category);
			newCats.push(ln.category);
		}
	}
	if (newCats.length > 0) {
		postMessage({ type: "setCategories", categories: newCats });
	}
}

/**
 * Classify a log line as framework or app code.
 * Handles both stack frames ("    at ...") and regular output
 * (e.g. Android logcat "D/TAG(PID): msg", launch boilerplate).
 */
export function classifyFrame(text: string): boolean | undefined {
	if (/^\s+at\s/.test(text)) {
		return isFrameworkFrame(text, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
	}
	return isFrameworkLogLine(text);
}

/** If the raw text is a thread header, return styled HTML; otherwise return the original html. */
export function tryFormatThreadHeader(rawText: string, html: string): string {
	const parsed = parseThreadHeader(stripAnsi(rawText));
	if (!parsed) { return html; }
	const tid = parsed.tid !== undefined ? ` (tid=${parsed.tid})` : '';
	const state = parsed.state ? ` \u2014 ${escapeForAttr(parsed.state)}` : '';
	return `<span class="thread-header">${escapeForAttr(parsed.name)}${tid}${state}</span>`;
}

function escapeForAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Send cached configuration (presets and highlight rules) to the webview.
 */
export function sendCachedConfig(
	cachedPresets: readonly unknown[],
	cachedHighlightRules: unknown[],
	postMessage: (msg: unknown) => void
): void {
	if (cachedPresets.length > 0) {
		postMessage({ type: "setPresets", presets: cachedPresets });
	}
	if (cachedHighlightRules.length > 0) {
		postMessage({ type: "setHighlightRules", rules: cachedHighlightRules });
	}
}

/**
 * Update the view badge with watch hit count.
 */
export function updateBadge(
	view: vscode.WebviewView | undefined,
	unreadWatchHits: number
): void {
	if (!view) { return; }
	view.badge = unreadWatchHits > 0
		? { value: unreadWatchHits, tooltip: `${unreadWatchHits} watch hits` }
		: undefined;
}

/**
 * Start the batch timer for flushing pending lines.
 */
export function startBatchTimer(
	batchIntervalMs: number,
	flushBatch: () => void,
	stopBatchTimer: () => void
): ReturnType<typeof setInterval> {
	stopBatchTimer();
	return setInterval(flushBatch, batchIntervalMs);
}

/**
 * Stop the batch timer.
 */
export function stopBatchTimer(timer: ReturnType<typeof setInterval> | undefined): void {
	if (timer !== undefined) {
		clearInterval(timer);
	}
}

const LEVEL_FILTERS_KEY = "slc.levelFilters";

/** Save per-file level filter state to workspace storage. */
export function saveLevelFilters(
	context: vscode.ExtensionContext,
	filename: string,
	levels: string[],
): void {
	if (!filename) { return; }
	const map = context.workspaceState.get<Record<string, string[]>>(LEVEL_FILTERS_KEY, {});
	map[filename] = levels;
	void context.workspaceState.update(LEVEL_FILTERS_KEY, map);
}

/** Retrieve saved level filter state for a file, or undefined if none. */
export function getSavedLevelFilters(
	context: vscode.ExtensionContext,
	filename: string,
): string[] | undefined {
	if (!filename) { return undefined; }
	const map = context.workspaceState.get<Record<string, string[]>>(LEVEL_FILTERS_KEY, {});
	return map[filename];
}

/** Convert tree items to a flat session list for the webview panel. */
export function buildSessionListPayload(
	items: readonly TreeItem[],
	activeUri: vscode.Uri | undefined,
): Record<string, unknown>[] {
	const activeStr = activeUri?.toString();
	type Meta = { filename: string; displayName?: string; adapter?: string; size: number; mtime: number; date?: string; hasTimestamps?: boolean; lineCount?: number; durationMs?: number; errorCount?: number; warningCount?: number; perfCount?: number; fwCount?: number; infoCount?: number; uri: { toString(): string }; trashed?: boolean; tags?: string[]; autoTags?: string[]; correlationTags?: string[] };
	const toRecord = (m: Meta): Record<string, unknown> => ({
		filename: m.filename, displayName: m.displayName ?? m.filename, adapter: m.adapter,
		size: m.size, mtime: m.mtime, formattedMtime: formatMtime(m.mtime),
		formattedTime: formatMtimeTimeOnly(m.mtime), relativeTime: formatRelativeTime(m.mtime), date: m.date,
		hasTimestamps: m.hasTimestamps ?? false, lineCount: m.lineCount ?? 0,
		durationMs: m.durationMs ?? 0, errorCount: m.errorCount ?? 0,
		warningCount: m.warningCount ?? 0, perfCount: m.perfCount ?? 0,
		fwCount: m.fwCount ?? 0, infoCount: m.infoCount ?? 0,
		isActive: activeStr === m.uri.toString(),
		uriString: m.uri.toString(), trashed: m.trashed ?? false, tags: m.tags ?? [],
		autoTags: m.autoTags ?? [], correlationTags: m.correlationTags ?? [],
	});
	return items.flatMap(item =>
		isSplitGroup(item) ? item.parts.map(toRecord) : [toRecord(item)],
	);
}

/** Open a source file at a specific line, optionally in a split editor. */
export async function openSourceFile(
	filePath: string,
	line: number,
	col: number,
	split: boolean,
): Promise<void> {
	const uri = resolveSourceUri(filePath);
	if (!uri) { return; }
	const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
	const viewColumn = split
		? vscode.ViewColumn.Beside
		: (vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One);
	try {
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn });
	} catch {
		// File may not exist on disk — ignore silently.
	}
}

/** Copy a source file path to clipboard (relative or full). */
export function copySourcePath(filePath: string, mode: string): void {
	if (mode === 'full') {
		const uri = resolveSourceUri(filePath);
		vscode.env.clipboard.writeText(uri ? uri.fsPath : filePath);
		return;
	}
	const isAbsolute = /^([/\\]|[a-zA-Z]:)/.test(filePath);
	const text = isAbsolute ? vscode.workspace.asRelativePath(filePath, false) : filePath.replace(/^package:[^/]+\//, '');
	vscode.env.clipboard.writeText(text);
}
