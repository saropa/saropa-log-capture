/**
 * Constants for optional integration with the Drift Advisor extension.
 * Used to detect the extension and invoke its commands from the log viewer.
 * Command ID must match Drift Advisor's package.json contributes.commands.
 */

/** VS Code extension ID for Drift Advisor (publisher.extensionName). */
export const DRIFT_ADVISOR_EXTENSION_ID = 'saropa.drift-viewer';

/** Command to open Drift Advisor (e.g. watch panel). Update when Drift Advisor defines its commands. */
export const DRIFT_ADVISOR_OPEN_COMMAND = 'saropa.drift-viewer.openWatchPanel';
