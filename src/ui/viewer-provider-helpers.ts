/**
 * Helper functions for LogViewerProvider.
 *
 * Extracted to keep the main provider class under 300 lines.
 * Contains message handlers and batch processing logic.
 */
import * as vscode from "vscode";
import { findHeaderEnd } from "./viewer-file-loader";
import { loadSourcePreview } from "./viewer-file-loader";
import { isFrameworkFrame } from "../modules/stack-parser";
import { PendingLine } from "./viewer-file-loader";

/**
 * Handle editing a log line in the current file.
 */
export async function handleEditLine(
	currentFileUri: vscode.Uri | undefined,
	isSessionActive: boolean,
	lineIndex: number,
	newText: string,
	timestamp: number,
	loadFromFile: (uri: vscode.Uri) => Promise<void>
): Promise<void> {
	// Check if we have a file to edit
	if (!currentFileUri) {
		vscode.window.showWarningMessage("No log file is currently loaded for editing.");
		return;
	}

	// Warn if session is active
	if (isSessionActive) {
		const choice = await vscode.window.showWarningMessage(
			"A debug session is active. Editing the log file now may cause data loss or corruption.",
			{ modal: true },
			"Edit Anyway",
			"Cancel"
		);
		if (choice !== "Edit Anyway") {
			return;
		}
	}

	try {
		// Read the current file
		const raw = await vscode.workspace.fs.readFile(currentFileUri);
		const text = Buffer.from(raw).toString("utf-8");
		const lines = text.split(/\r?\n/);

		// Find the header end
		const headerEnd = findHeaderEnd(lines);
		const dataStartIndex = headerEnd;
		const targetIndex = dataStartIndex + lineIndex;

		// Validate index
		if (targetIndex < dataStartIndex || targetIndex >= lines.length) {
			vscode.window.showErrorMessage(`Line index ${lineIndex} is out of range.`);
			return;
		}

		// Replace the line
		lines[targetIndex] = newText;

		// Write back to file
		const newContent = lines.join('\n');
		await vscode.workspace.fs.writeFile(
			currentFileUri,
			Buffer.from(newContent, 'utf-8')
		);

		vscode.window.showInformationMessage(`Line ${lineIndex + 1} updated successfully.`);

		// Reload the file in the viewer to show the change
		await loadFromFile(currentFileUri);
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
 * Load source preview for a file path and line number.
 */
export async function handleSourcePreview(
	filePath: string,
	line: number,
	postMessage: (msg: unknown) => void
): Promise<void> {
	postMessage({ type: "sourcePreview", ...await loadSourcePreview(filePath, line) });
}

/**
 * Flush batched lines to the webview.
 */
export function flushBatch(
	pendingLines: PendingLine[],
	view: vscode.WebviewView | undefined,
	postMessage: (msg: unknown) => void,
	sendNewCategories: (lines: readonly PendingLine[]) => void
): void {
	if (pendingLines.length === 0 || !view) { return; }
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
 * Classify a line as framework code if it looks like a stack frame.
 */
export function classifyFrame(text: string): boolean | undefined {
	if (!/^\s+at\s/.test(text)) { return undefined; }
	return isFrameworkFrame(text, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
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
