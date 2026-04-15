/**
 * Stream functions for error-specific analysis in the analysis panel.
 *
 * These run in parallel with existing streams when the analyzed line
 * is classified as an error/warning. They fetch triage status,
 * session occurrences, and cross-session timeline data.
 */

import * as vscode from 'vscode';
import { normalizeLine, hashFingerprint, classifyCategory, type CrashCategory } from '../../modules/analysis/error-fingerprint';
import { aggregateSignals, type RecurringError } from '../../modules/misc/cross-session-aggregator';
import { getErrorStatusBatch, type ErrorStatus } from '../../modules/misc/error-status-store';
import type { SectionData } from '../../modules/analysis/analysis-relevance';
import type { StreamCtx } from './analysis-panel-streams';
import {
    renderErrorHeader, renderTimelineSection,
    renderOccurrencesSection, type ErrorHeaderOptions,
} from './analysis-error-render';
import { emptySlot } from './analysis-panel-render';

/** Pre-computed error context passed to error streams. */
export interface ErrorContext {
    readonly hash: string;
    readonly normalizedText: string;
    readonly crashCategory: CrashCategory;
    readonly errorClass: string | undefined;
}

/** Compute error context from raw line text. Returns undefined if not fingerprintable. */
export function buildErrorContext(lineText: string, errorClass: string | undefined): ErrorContext | undefined {
    const normalized = normalizeLine(lineText);
    if (normalized.length < 5) { return undefined; }
    return {
        hash: hashFingerprint(normalized),
        normalizedText: normalized,
        crashCategory: classifyCategory(lineText),
        errorClass,
    };
}

/** Fetch triage status and post the error header section. */
export async function runTriageLookup(
    ctx: StreamCtx, lineText: string, errCtx: ErrorContext,
): Promise<Partial<SectionData>> {
    const { post, signal } = ctx;
    const statuses = await getErrorStatusBatch([errCtx.hash]).catch(() => ({} as Record<string, ErrorStatus>));
    if (signal.aborted) { return {}; }
    const triageStatus = statuses[errCtx.hash] ?? 'open';
    const headerOpts: ErrorHeaderOptions = {
        errorText: lineText,
        errorClass: errCtx.errorClass,
        crashCategory: errCtx.crashCategory,
        hash: errCtx.hash,
        triageStatus,
    };
    post('error-header', renderErrorHeader(headerOpts));
    return {};
}

/** Fetch cross-session error timeline and post the section. */
export async function runErrorTimeline(
    ctx: StreamCtx, errCtx: ErrorContext,
): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    progress('error-timeline', '📊 Loading error history...');
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    if (signal.aborted) { return {}; }
    const match: RecurringError | undefined = aggregated?.recurringErrors.find(e => e.hash === errCtx.hash);
    if (!match) {
        post('error-timeline', emptySlot('error-timeline', '📊 First occurrence — no history yet'));
        return {};
    }
    post('error-timeline', renderTimelineSection(match));
    return {};
}

/** Scan current session fingerprints for occurrences of this error. */
export async function runOccurrenceScan(
    ctx: StreamCtx, errCtx: ErrorContext, fileUri: vscode.Uri | undefined,
): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    if (!fileUri) {
        post('error-occurrences', emptySlot('error-occurrences', '🔁 No session file'));
        return {};
    }
    progress('error-occurrences', '🔁 Scanning session...');
    const maxScanLines = 50_000;
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        if (signal.aborted) { return {}; }
        const text = Buffer.from(raw).toString('utf-8');
        const lines = text.split('\n');
        const limit = Math.min(lines.length, maxScanLines);
        const examples: string[] = [];
        for (let i = 0; i < limit; i++) {
            const trimmed = lines[i].trim();
            const n = normalizeLine(trimmed);
            if (n.length >= 5 && hashFingerprint(n) === errCtx.hash) {
                examples.push(trimmed);
            }
        }
        post('error-occurrences', renderOccurrencesSection(examples.length, examples));
    } catch {
        post('error-occurrences', emptySlot('error-occurrences', '🔁 Could not scan session'));
    }
    return {};
}
