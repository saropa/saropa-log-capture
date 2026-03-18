/**
 * Handlers for code quality popover (show quality for frame).
 * Loads quality payload from session meta or from the log's .quality.json sidecar,
 * resolves the file for the selected line, and posts codeQualityPopoverData to the webview.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { normalizeForLookup } from '../../../modules/integrations/providers/quality-types';
import type { CodeQualityPayload, FileQualityMetrics } from '../../../modules/integrations/providers/quality-types';
import { parseJSONOrDefault } from '../../../modules/misc/safe-json';
import { extractSourceReference } from '../../../modules/source/source-linker';
import { t } from '../../../l10n';

export type PostFn = (msg: unknown) => void;

/** Find best-matching file key in payload.files for a given source path. */
function findFileKey(files: Record<string, FileQualityMetrics>, sourcePath: string): string | undefined {
    const norm = normalizeForLookup(sourcePath);
    if (!norm) { return undefined; }
    const keys = Object.keys(files);
    const exact = keys.find(k => normalizeForLookup(k) === norm);
    if (exact) { return exact; }
    const basename = path.basename(sourcePath).toLowerCase();
    const byBasename = keys.filter(k => path.basename(k).toLowerCase() === basename);
    if (byBasename.length === 1) { return byBasename[0]; }
    const suffixMatch = keys.find(k => norm.endsWith(normalizeForLookup(k)) || normalizeForLookup(k).endsWith(norm));
    return suffixMatch;
}

/** Load code quality payload from meta or from quality.json sidecar. */
async function loadCodeQualityPayload(logUri: vscode.Uri): Promise<CodeQualityPayload | undefined> {
    const store = new SessionMetadataStore();
    const meta = await store.loadMetadata(logUri);
    const fromMeta = meta.integrations?.codeQuality as CodeQualityPayload | undefined;
    if (fromMeta && typeof fromMeta === 'object' && fromMeta.files && typeof fromMeta.files === 'object') {
        return fromMeta;
    }
    const logDir = path.dirname(logUri.fsPath);
    const baseFileName = path.basename(logUri.fsPath);
    const qualityPath = path.join(logDir, `${baseFileName}.quality.json`);
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(qualityPath));
        const data = parseJSONOrDefault<CodeQualityPayload>(Buffer.from(content).toString('utf-8'), {} as CodeQualityPayload);
        if (data?.files && typeof data.files === 'object') { return data; }
    } catch {
        // ignore
    }
    return undefined;
}

/**
 * Handle showCodeQualityForFrame: load quality data, resolve file for the line, post popover data.
 */
export async function handleCodeQualityForFrameRequest(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
    lineText: string,
    post: PostFn,
): Promise<void> {
    if (!logUri) {
        post({ type: 'codeQualityPopoverData', error: t('msg.noActiveSession') });
        return;
    }
    const sourceRef = extractSourceReference(lineText);
    const sourcePath = sourceRef?.filePath;
    if (!sourcePath) {
        post({ type: 'codeQualityPopoverData', lineIndex, error: 'No source file reference in this line.' });
        return;
    }
    try {
        const payload = await loadCodeQualityPayload(logUri);
        if (!payload) {
            post({ type: 'codeQualityPopoverData', lineIndex, error: t('msg.noQualityReportFound') });
            return;
        }
        const fileKey = findFileKey(payload.files, sourcePath);
        if (!fileKey) {
            post({
                type: 'codeQualityPopoverData',
                lineIndex,
                filePath: sourcePath,
                error: 'No quality data for this file.',
            });
            return;
        }
        const metrics = payload.files[fileKey];
        post({
            type: 'codeQualityPopoverData',
            lineIndex,
            filePath: fileKey,
            metrics: metrics ?? undefined,
            summary: payload.summary,
        });
    } catch {
        post({ type: 'codeQualityPopoverData', lineIndex, error: t('msg.noQualityReportFound') });
    }
}
