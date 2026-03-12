/**
 * Investigation mode data model types.
 * An investigation is a named collection of pinned sources (sessions and files)
 * that can be searched together and exported as a bundle.
 */

/** A source pinned to an investigation. */
export interface InvestigationSource {
    /** Source type: 'session' auto-includes sidecars, 'file' is standalone. */
    readonly type: 'session' | 'file';
    /** Path relative to workspace root (portable across machines). */
    readonly relativePath: string;
    /** Display name shown in UI. */
    readonly label: string;
    /** Timestamp when source was pinned (epoch ms). */
    readonly pinnedAt: number;
}

/** A named investigation containing pinned sources. */
export interface Investigation {
    /** Unique identifier (UUID). */
    readonly id: string;
    /** User-provided name, e.g. "Auth Timeout Bug #1234". */
    readonly name: string;
    /** Creation timestamp (epoch ms). */
    readonly createdAt: number;
    /** Last modification timestamp (epoch ms). */
    readonly updatedAt: number;
    /** Pinned sources in this investigation. */
    readonly sources: readonly InvestigationSource[];
    /** User notes/description (optional). */
    readonly notes?: string;
    /** Last search query for restoring state (optional). */
    readonly lastSearchQuery?: string;
}

/** Input for creating a new investigation. */
export interface CreateInvestigationInput {
    readonly name: string;
    readonly notes?: string;
}

/** Input for adding a source to an investigation. */
export interface AddSourceInput {
    readonly type: 'session' | 'file';
    readonly relativePath: string;
    readonly label: string;
}

/** Persisted format of the investigations file. */
export interface InvestigationsFile {
    readonly version: 1;
    readonly investigations: Investigation[];
}

/** Maximum number of investigations per workspace. */
export const MAX_INVESTIGATIONS = 50;

/** Maximum number of sources per investigation. */
export const MAX_SOURCES_PER_INVESTIGATION = 20;
