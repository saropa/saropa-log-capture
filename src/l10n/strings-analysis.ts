/**
 * English strings for host-built analysis-panel HTML that wasn't already covered by the
 * `viewer.analysis.*` keys in strings-viewer-d.ts (notably the stack-frame deep-dive rendering).
 * Merged into the host `strings` map in ../l10n.ts and looked up with `t()`.
 */
export const stringsAnalysis: Record<string, string> = {
    'viewer.analysis.frame.stackTrace': 'Stack Trace',
    'viewer.analysis.frame.count': '{0} frames ({1} app, {2} fw)',
    'viewer.analysis.frame.appOnly': 'App frames only',
    'viewer.analysis.frame.fwRun': '{0} framework frames',
    'viewer.analysis.frame.badgeApp': 'APP',
    'viewer.analysis.frame.badgeFw': 'FW',
    'viewer.analysis.frame.repeatTitle': '{0} identical consecutive frames (e.g. recursion)',
    'viewer.analysis.frame.copyTitle': 'Copy frame',
    'viewer.analysis.frame.blame': 'Last changed by {0} on {1} · {2} {3}',
    'viewer.analysis.frame.annotations': '{0} urgent annotation(s) nearby',
    'viewer.analysis.frame.noContext': 'Source file found but no context available',
};
