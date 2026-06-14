/**
 * Predictive error surfacing (cross-session-analysis idea #1).
 *
 * On session end, proactively tell the user which errors deserve attention BEFORE they open
 * anything: error patterns new to this session (a likely regression) plus errors that recur
 * across sessions. This supersedes the older recurring-only notification so a single session end
 * never fires two overlapping toasts — the composite message carries strictly more information.
 *
 * Best-effort throughout: a brand-new session may have no metadata yet, the aggregator may be
 * empty for a fresh workspace, and none of that may break finalization. Stays silent when there
 * is nothing actionable (idea #8 "silence is golden") — an empty session must not nag.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { t } from '../../l10n';
import { aggregateSignals } from '../misc/cross-session-aggregator';
import { SessionMetadataStore } from './session-metadata';
import { loadFilteredMetas, parseSessionDate } from './metadata-loader';
import { detectRegressions } from '../signals/regression-detector';
import { selectSurfacingVariant, truncateLabel } from './session-signal-surfacing-format';

/** Longest error label shown inline before truncation — keeps the toast scannable. */
const MAX_LABEL_LENGTH = 60;

/** Counts that drive the toast. topLabel is the single most actionable item, if any. */
interface SessionSignalSummary {
    readonly newErrorCount: number;
    readonly recurringCount: number;
    readonly topLabel: string | undefined;
}

/**
 * Compose the just-ended session's actionable signals and, if any, show one notification.
 * Fire-and-forget: callers run this after fingerprint scans settle and do not await it.
 */
export function surfacePredictiveSignals(fileUri: vscode.Uri, out: vscode.OutputChannel): void {
    computeSessionSignalSummary(fileUri)
        .then((summary) => notifyIfActionable(summary, out))
        .catch(() => { /* metadata/aggregator may be absent — surfacing must never throw */ });
}

/**
 * Build the summary by combining two already-persisted data sources: the regression detector
 * (new error patterns vs the previous sessions) and the cross-session aggregator (which of this
 * session's error fingerprints recur across 5+ sessions). No new scan, no new storage.
 */
async function computeSessionSignalSummary(fileUri: vscode.Uri): Promise<SessionSignalSummary> {
    const sessionFilename = path.basename(fileUri.fsPath);
    const meta = await new SessionMetadataStore().loadMetadata(fileUri);
    const currentFingerprints = meta?.fingerprints ?? [];

    // New error patterns: present this session, absent from the previous sessions (oldest → newest).
    const allMetas = await loadFilteredMetas('all').catch(() => []);
    const pastMetas = [...allMetas]
        .filter((m) => m.filename !== sessionFilename)
        .sort((a, b) => parseSessionDate(a.filename) - parseSessionDate(b.filename));
    const { newErrors } = detectRegressions({ currentFingerprints, pastMetas });

    // Recurring: cross-session error/warning signals whose fingerprint also appears in this session.
    const currentHashes = new Set(currentFingerprints.map((f) => f.h).filter(Boolean));
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    const recurring = (aggregated?.allSignals ?? []).filter(
        (s) => s.recurring
            && (s.kind === 'error' || s.kind === 'warning')
            && currentHashes.has(s.fingerprint),
    );

    // Prefer a new error as the headline (highest actionability), else the top recurring signal.
    const topLabel = newErrors[0]?.example ?? recurring[0]?.label;
    return { newErrorCount: newErrors.length, recurringCount: recurring.length, topLabel };
}

/** Show the toast with an "Open Signals" action, but only when something is worth surfacing. */
function notifyIfActionable(summary: SessionSignalSummary, out: vscode.OutputChannel): void {
    const variant = selectSurfacingVariant(summary);
    // A null key means nothing actionable — suppress the toast rather than nag on an empty session.
    if (variant.key === null) { return; }
    let msg = t(variant.key, ...variant.args);
    if (summary.topLabel) {
        msg = t('msg.sessionSignals.top', msg, truncateLabel(summary.topLabel, MAX_LABEL_LENGTH));
    }
    out.appendLine(msg);
    void vscode.window.showInformationMessage(msg, t('action.openSignals')).then((action) => {
        if (action === t('action.openSignals')) {
            void vscode.commands.executeCommand('saropaLogCapture.showSignals');
        }
    });
}
