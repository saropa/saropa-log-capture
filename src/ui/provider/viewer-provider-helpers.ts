/**
 * Helper functions for LogViewerProvider — message handlers and batch processing.
 *
 * Handles edit-line, export-logs, copy, and tree→webview payload building. Also provides
 * line batching, category tracking, and cached config (presets/highlight rules) posting.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { findHeaderEnd } from "../viewer/viewer-file-loader";
import { isFrameworkFrame, classifyLogLine, isStackFrameLine, parseThreadHeader } from "../../modules/analysis/stack-parser";
import { type DeviceTier } from "../../modules/analysis/device-tag-tiers";
import { stripAnsi } from "../../modules/capture/ansi";
import { extractSourceReference } from "../../modules/source/source-linker";
import { getPerFileCoverageMap } from "../../modules/integrations/providers/code-coverage";
import { lookupCoverage } from "../../modules/integrations/providers/coverage-per-file";
import { PendingLine } from "../viewer/viewer-file-loader";
import { logExtensionError } from "../../modules/misc/extension-logger";

export { buildSessionListPayload, buildSessionItemRecord, openSourceFile, copySourcePath, buildCopyWithSource, LOG_LAST_VIEWED_KEY, updateLastViewed, type CopySourceRef, type SessionListPayloadOptions } from "./viewer-provider-actions";

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
		vscode.window.showWarningMessage(t('msg.noLogFileLoaded'));
		return;
	}

	if (isSessionActive) {
		const choice = await vscode.window.showWarningMessage(
			t('msg.debugSessionActiveEdit'),
			{ modal: true },
			t('action.editAnyway'),
			t('action.cancel'),
		);
		if (choice !== t('action.editAnyway')) { return; }
	}

	try {
		const raw = await vscode.workspace.fs.readFile(currentFileUri);
		const text = Buffer.from(raw).toString("utf-8");
		const lines = text.split(/\r?\n/);
		const dataStartIndex = findHeaderEnd(lines);
		const targetIndex = dataStartIndex + input.lineIndex;

		if (targetIndex < dataStartIndex || targetIndex >= lines.length) {
			vscode.window.showErrorMessage(t('msg.lineIndexOutOfRange', String(input.lineIndex)));
			return;
		}

		lines[targetIndex] = input.newText;
		const newContent = lines.join('\n');
		await vscode.workspace.fs.writeFile(currentFileUri, Buffer.from(newContent, 'utf-8'));
		vscode.window.showInformationMessage(t('msg.lineUpdatedSuccess', String(input.lineIndex + 1)));
		await input.loadFromFile(currentFileUri);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logExtensionError('editLine', err instanceof Error ? err : new Error(message));
		throw new Error(`File edit failed: ${message}`);
	}
}

/**
 * Handle exporting logs to a file.
 */
export async function handleExportLogs(text: string, options: Record<string, unknown>): Promise<void> {
	// Prompt user to choose save location (workspace-based default for remote/SSH/WSL/Dev Containers)
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const defaultUri = workspaceFolder
		? vscode.Uri.joinPath(workspaceFolder.uri, 'exported-logs.txt')
		: vscode.Uri.file('exported-logs.txt');
	const uri = await vscode.window.showSaveDialog({
		defaultUri,
		filters: {
			[t('filter.textFiles')]: ['txt', 'log'],
			[t('filter.allFiles')]: ['*'],
		},
		saveLabel: t('saveLabel.exportLogs'),
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
			t('msg.exportedLinesTo', String(lineCount), lineCount === 1 ? '' : 's', levelStr, uri.fsPath),
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logExtensionError('exportLogs', err instanceof Error ? err : new Error(message));
		throw new Error(`Export failed: ${message}`);
	}
}

/** Max lines sent per addLines message to avoid webview CPU spike under heavy load. */
export const MAX_LINES_PER_BATCH = 800;

/**
 * Flush batched lines to the webview. Sends at most MAX_LINES_PER_BATCH per call.
 */
export function flushBatch(
	pendingLines: PendingLine[],
	isReady: boolean,
	postMessage: (msg: unknown) => void,
	sendNewCategories: (lines: readonly PendingLine[]) => void
): void {
	if (pendingLines.length === 0 || !isReady) { return; }
	const take = Math.min(pendingLines.length, MAX_LINES_PER_BATCH);
	const lines = pendingLines.splice(0, take);
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
 * Classify a log line by device tier.
 * Handles both stack frames ("    at ...") and regular output
 * (e.g. Android logcat "D/TAG(PID): msg", launch boilerplate).
 * Stack frames return 'flutter' (app) or 'device-other' (framework).
 */
export function classifyFrame(text: string): DeviceTier | undefined {
	if (/^\s+at\s/.test(text)) {
		const isFw = isFrameworkFrame(text, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
		if (isFw === undefined) { return undefined; }
		return isFw ? 'device-other' : 'flutter';
	}
	return classifyLogLine(text);
}

/**
 * Look up per-file coverage for an app-code stack frame line.
 * Returns coverage percent (0–100) or undefined if not applicable.
 */
export function lookupQuality(text: string, tier: DeviceTier | undefined): number | undefined {
	if (tier !== 'flutter') { return undefined; }
	if (!isStackFrameLine(text)) { return undefined; }
	const map = getPerFileCoverageMap();
	if (!map) { return undefined; }
	const ref = extractSourceReference(text);
	if (!ref) { return undefined; }
	return lookupCoverage(map, ref.filePath);
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
 * Optionally include lastUsedPresetName so the webview can re-apply it on load.
 */
export function sendCachedConfig(
	cachedPresets: readonly unknown[],
	cachedHighlightRules: unknown[],
	postMessage: (msg: unknown) => void,
	lastUsedPresetName?: string | undefined
): void {
	if (cachedPresets.length > 0) {
		postMessage({ type: "setPresets", presets: cachedPresets, lastUsedPresetName: lastUsedPresetName ?? undefined });
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
