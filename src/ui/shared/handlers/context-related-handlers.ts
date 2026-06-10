/**
 * Dedicated "Related X" popover handlers (database queries, HTTP requests).
 *
 * Both variants correlate a log line to integration data by the context time window plus an
 * optional request ID (when the configured `requestIdPattern` matches the line), then post the
 * matching entries to the webview with no cap. They share one implementation so the two cannot
 * drift apart — e.g. one gaining request-ID matching while the other silently lacks it.
 *
 * Extracted from `context-handlers.ts` to keep that file under the 300-line cap; the shared
 * correlation helpers (`getSessionCenterTime`, `extractRequestIdFromLine`) are imported back.
 */
import * as vscode from 'vscode';
import { t } from '../../../l10n';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { loadContextData, type ContextWindow } from '../../../modules/context/context-loader';
import type { ContextData } from '../../../modules/context/context-loader-types';
import type { PostFn } from './crashlytics-handlers';
import { getSessionCenterTime, extractRequestIdFromLine } from './context-handlers';

/** One options bag for {@link postRelatedContext} — keeps the helper to a single parameter. */
interface RelatedContextArgs {
    readonly logUri: vscode.Uri | undefined;
    readonly lineIndex: number;
    readonly post: PostFn;
    readonly options?: { timestamp?: number; lineText?: string };
    /** Outbound message `type`, the result field name, and which context slice to return. */
    readonly postType: string;
    readonly resultKey: string;
    readonly pick: (d: ContextData) => unknown[];
}

/** Shared correlation loader: resolve the center time + optional request ID, load, and post. */
async function postRelatedContext(args: RelatedContextArgs): Promise<void> {
    const { logUri, lineIndex, post, options, postType, resultKey, pick } = args;
    if (!logUri) {
        post({ type: postType, error: t('msg.noIntegrationContext') });
        return;
    }
    try {
        const store = new SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const windowMs = cfg.get<number>('contextWindowSeconds', 5) * 1000;
        const centerTime = (options?.timestamp && options.timestamp > 0)
            ? options.timestamp
            : getSessionCenterTime(meta.integrations);
        if (centerTime === 0) {
            post({ type: postType, lineIndex, [resultKey]: [] });
            return;
        }
        const requestId = extractRequestIdFromLine(options?.lineText, cfg);
        const window: ContextWindow = { centerTime, windowMs, ...(requestId ? { requestId } : {}) };
        const contextData = await loadContextData(logUri, window);
        post({ type: postType, lineIndex, [resultKey]: pick(contextData) });
    } catch {
        post({ type: postType, error: t('msg.noIntegrationContext') });
    }
}

/** Post database queries correlated to a log line (time-window + optional request ID, no cap). */
export function handleRelatedQueriesRequest(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
    post: PostFn,
    options?: { timestamp?: number; lineText?: string },
): Promise<void> {
    return postRelatedContext({
        logUri, lineIndex, post, options,
        postType: 'relatedQueriesData', resultKey: 'queries', pick: (d) => d.database ?? [],
    });
}

/** Post HTTP requests correlated to a log line — same correlation as the database sibling. */
export function handleRelatedRequestsRequest(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
    post: PostFn,
    options?: { timestamp?: number; lineText?: string },
): Promise<void> {
    return postRelatedContext({
        logUri, lineIndex, post, options,
        postType: 'relatedRequestsData', resultKey: 'requests', pick: (d) => d.http ?? [],
    });
}
