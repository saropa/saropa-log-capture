/** Shared type definitions for Firebase Crashlytics integration. */

import type { DiagnosticDetails } from './crashlytics-diagnostics';

export interface FirebaseConfig { readonly projectId: string; readonly appId: string; }

export interface CrashlyticsIssue {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly eventCount: number;
    readonly userCount: number;
    readonly isFatal: boolean;
    readonly state: 'OPEN' | 'CLOSED' | 'REGRESSION' | 'UNKNOWN';
    readonly firstVersion?: string;
    readonly lastVersion?: string;
}

/** Per-step status for the setup checklist (ok, missing, or not yet checked because a prior step failed). */
export type SetupStepStatus = 'ok' | 'missing' | 'pending';

export interface SetupChecklist {
    readonly gcloud: 'ok' | 'missing';
    readonly token: SetupStepStatus;
    readonly config: SetupStepStatus;
}

export interface FirebaseContext {
    readonly available: boolean;
    readonly setupHint?: string;
    /** Which setup step failed — drives the wizard UI in the panel. */
    readonly setupStep?: 'gcloud' | 'token' | 'config';
    /** Per-step status for checklist when available is false or when diagnostics are shown. */
    readonly setupChecklist?: SetupChecklist;
    readonly issues: readonly CrashlyticsIssue[];
    readonly consoleUrl?: string;
    readonly queriedAt?: number;
    readonly diagnostics?: DiagnosticDetails;
}

export interface CrashlyticsStackFrame {
    readonly text: string;
    readonly fileName?: string;
    readonly lineNumber?: number;
}

export interface CrashlyticsThread {
    readonly name: string;
    readonly frames: readonly CrashlyticsStackFrame[];
}

export interface CrashlyticsEventDetail {
    readonly issueId: string;
    readonly crashThread?: CrashlyticsThread;
    readonly appThreads: readonly CrashlyticsThread[];
    readonly deviceModel?: string;
    readonly osVersion?: string;
    readonly eventTime?: string;
    readonly customKeys?: readonly { readonly key: string; readonly value: string }[];
    readonly logs?: readonly { readonly timestamp?: string; readonly message: string }[];
}

export interface CrashlyticsIssueEvents {
    readonly issueId: string;
    readonly events: readonly CrashlyticsEventDetail[];
    readonly currentIndex: number;
}
