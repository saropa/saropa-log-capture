/**
 * Pure classifier for suite connection status — no fs, no vscode, so the state machine is
 * unit-tested directly under `node --test`. The impure reader (installation + mirror) lives in
 * `suite-connection-status.ts` and feeds this.
 *
 * The four states answer "is this sibling tool actually sharing data with Log Capture?":
 * `notInstalled` (absent), `notApplicable` (installed, but this workspace could never produce its
 * data — e.g. Drift Advisor in a workspace with no `drift` dependency), `silent` (installed and
 * applicable, but its `.saropa/diagnostics` mirror is missing or stale — the case that makes the
 * integration invisible), and `connected` (sharing fresh data).
 */

/** The two diagnostic-producing siblings Log Capture consumes (its own emission is separate). */
export type SiblingTool = 'advisor' | 'lints';

/**
 * Four-state connection: missing tool / installed but this workspace could never produce its data /
 * present-but-silent / sharing fresh data.
 */
export type ConnectionState = 'notInstalled' | 'notApplicable' | 'silent' | 'connected';

/** Dependency names in pubspec.yaml that mark a workspace as Drift-based, mirroring Advisor's own check. */
const DRIFT_DEPENDENCY_NAMES: ReadonlySet<string> = new Set(['drift', 'saropa_drift_advisor']);

/** True when the workspace's declared dependencies indicate Drift Advisor could ever produce data here. */
export function workspaceUsesDrift(dependencyNames: ReadonlySet<string>): boolean {
  for (const name of DRIFT_DEPENDENCY_NAMES) {
    if (dependencyNames.has(name)) {
      return true;
    }
  }
  return false;
}

/** Why a `silent` tool isn't reaching us — drives the guidance shown to the user. */
export type SilentCause = 'noMirror' | 'stale';

/** Resolved connection for one sibling, with the mirror facts the UI / notice surfaces. */
export interface SiblingConnection {
  readonly tool: SiblingTool;
  readonly state: ConnectionState;
  /** Only set when `state === 'silent'`. */
  readonly cause?: SilentCause;
  readonly findingCount?: number;
  readonly capturedCommit?: string;
  readonly generatedAt?: string;
}

/** Pure view of a tool's on-disk mirror, decoupled from fs/vscode so the classifier is testable. */
export interface MirrorSnapshot {
  readonly findingCount: number;
  /** Commit the mirror was captured at (uniform within a file); undefined when none stamped. */
  readonly capturedCommit?: string;
  readonly generatedAt?: string;
}

/**
 * Not installed → the tool is absent. Installed but no readable mirror → silent, the tool has never
 * shared anything here. A mirror captured at a different commit than HEAD is `stale` — surfacing it
 * as current would mislead, so it counts as silent too. Staleness is judged ONLY when both commits
 * are known; an unknown commit on either side is never guessed.
 */
export function classifySibling(
  tool: SiblingTool,
  installed: boolean,
  mirror: MirrorSnapshot | undefined,
  currentCommit: string | undefined,
): SiblingConnection {
  if (!installed) {
    return { tool, state: 'notInstalled' };
  }
  if (!mirror) {
    return { tool, state: 'silent', cause: 'noMirror' };
  }
  const facts = {
    findingCount: mirror.findingCount,
    capturedCommit: mirror.capturedCommit,
    generatedAt: mirror.generatedAt,
  };
  const stale = currentCommit !== undefined
    && mirror.capturedCommit !== undefined
    && mirror.capturedCommit !== currentCommit;
  if (stale) {
    return { tool, state: 'silent', cause: 'stale', ...facts };
  }
  return { tool, state: 'connected', ...facts };
}
