/**
 * English strings for Investigation Groups (cross-session-analysis idea #2).
 * Merged in ../l10n.ts. Translated later by the runtime l10n pipeline.
 */
export const stringsInvestigations: Record<string, string> = {
    'investigation.newPrompt': 'Name this investigation',
    'investigation.newPlaceholder': 'e.g. Bug #42: Payment timeout',
    'investigation.emptyTitle': 'Enter a name for the investigation.',
    'investigation.created': 'Created investigation "{0}".',
    'investigation.renamePrompt': 'Rename investigation',
    'investigation.renamed': 'Renamed investigation to "{0}".',
    'investigation.notesPrompt': 'Notes for "{0}" — root cause, fix attempts, conclusions',
    'investigation.notesPlaceholder': 'e.g. Root cause was connection pool exhaustion',
    'investigation.notesSaved': 'Saved notes for "{0}".',
    'investigation.deleteConfirm':
        'Delete investigation "{0}"? This removes {1} session link(s); the log files are kept.',
    'investigation.deleteAction': 'Delete',
    'investigation.deleted': 'Deleted investigation "{0}".',
    'investigation.pickPlaceholder': 'Select an investigation',
    'investigation.none': 'No investigations yet. Use "Add to Investigation" on a log to create one.',
    'investigation.sessionCount': '{0} session(s)',
    'investigation.addPlaceholder': 'Add the selected log(s) to which investigation?',
    'investigation.newItemLabel': '$(add) New investigation…',
    'investigation.added': 'Added {0} to "{1}".',
    'investigation.addedMulti': 'Added {0} log(s) to "{1}".',
    'investigation.alreadyMember': '"{1}" already contains {0}.',
    'investigation.removePlaceholder': 'Remove the selected log from which investigation?',
    'investigation.removed': 'Removed {0} from "{1}".',
    'investigation.notInAny': '{0} is not in any investigation.',
    'investigation.openPlaceholder': 'Open a session from "{0}"',
    'investigation.overviewItemLabel': '$(book) Open investigation overview',
    'investigation.emptyInvestigation':
        '"{0}" has no sessions yet. Add some with "Add to Investigation".',
    'investigation.memberMissing': 'That log file could not be found (it may have been deleted).',
    'investigation.noWorkspace': 'Open a folder to use investigations.',
};
