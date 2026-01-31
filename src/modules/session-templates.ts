/**
 * Session Templates Module
 *
 * Save and load project-specific configuration bundles including:
 * - Watch keywords and alert types
 * - Exclusion filters
 * - Filter presets
 * - Auto-tag rules
 * - File split rules
 * - Highlight rules
 *
 * Templates are stored in .vscode/saropaLogCapture/templates/
 */

import * as vscode from 'vscode';

/** A saved session template configuration. */
export interface SessionTemplate {
    readonly name: string;
    readonly description?: string;
    readonly createdAt: string;

    /** Watch patterns configuration. */
    readonly watchPatterns?: readonly {
        readonly pattern: string;
        readonly alertType?: string;
    }[];

    /** Exclusion filter patterns. */
    readonly exclusions?: readonly string[];

    /** Filter presets. */
    readonly filterPresets?: readonly {
        readonly name: string;
        readonly categories?: readonly string[];
        readonly searchPattern?: string;
        readonly exclusionsEnabled?: boolean;
    }[];

    /** Auto-tag rules. */
    readonly autoTagRules?: readonly {
        readonly pattern: string;
        readonly tag: string;
    }[];

    /** Split rules configuration. */
    readonly splitRules?: {
        readonly maxLines?: number;
        readonly maxSizeKB?: number;
        readonly keywords?: readonly string[];
        readonly maxDurationMinutes?: number;
        readonly silenceMinutes?: number;
    };

    /** Highlight rules. */
    readonly highlightRules?: readonly {
        readonly pattern: string;
        readonly color?: string;
        readonly backgroundColor?: string;
        readonly bold?: boolean;
        readonly italic?: boolean;
        readonly label?: string;
    }[];
}

/** Built-in starter templates for common frameworks. */
export const builtInTemplates: readonly SessionTemplate[] = [
    {
        name: 'Flutter',
        description: 'Optimized for Flutter/Dart debugging',
        createdAt: new Date().toISOString(),
        watchPatterns: [
            { pattern: '/\\[ERROR\\]|Exception|Error:/i', alertType: 'flash' },
            { pattern: '/\\[WARNING\\]/i', alertType: 'badge' },
            { pattern: 'Hot restart', alertType: 'none' },
        ],
        exclusions: [
            '/^I\\/flutter/',
            '/^D\\//',
            '/Syncing files to device/',
        ],
        highlightRules: [
            { pattern: '/\\[ERROR\\]/i', color: 'var(--vscode-errorForeground)', label: 'Error' },
            { pattern: '/\\[WARNING\\]/i', color: 'var(--vscode-editorWarning-foreground)', label: 'Warning' },
            { pattern: '/Hot restart|Hot reload/i', color: 'var(--vscode-debugConsole-sourceForeground)', label: 'Hot Reload' },
        ],
        splitRules: {
            keywords: ['Performing hot restart', 'Performing hot reload'],
        },
    },
    {
        name: 'Node.js',
        description: 'Optimized for Node.js debugging',
        createdAt: new Date().toISOString(),
        watchPatterns: [
            { pattern: '/error|ERR!|Error:/i', alertType: 'flash' },
            { pattern: '/warn|WARN/i', alertType: 'badge' },
            { pattern: '/unhandledRejection|uncaughtException/i', alertType: 'flash' },
        ],
        exclusions: [
            '/^Debugger attached/',
            '/^Waiting for the debugger/',
        ],
        highlightRules: [
            { pattern: '/\\berror\\b|ERR!/i', color: 'var(--vscode-errorForeground)', label: 'Error' },
            { pattern: '/\\bwarn\\b|WARN/i', color: 'var(--vscode-editorWarning-foreground)', label: 'Warning' },
            { pattern: '/\\binfo\\b|INFO/i', color: 'var(--vscode-debugConsole-infoForeground)', label: 'Info' },
        ],
    },
    {
        name: 'Python',
        description: 'Optimized for Python debugging',
        createdAt: new Date().toISOString(),
        watchPatterns: [
            { pattern: '/Traceback|Exception|Error:/i', alertType: 'flash' },
            { pattern: '/Warning:/i', alertType: 'badge' },
        ],
        exclusions: [
            '/^pydevd/',
            '/^Traceback \\(most recent call last\\):$/',
        ],
        highlightRules: [
            { pattern: '/Traceback|Exception|Error:/i', color: 'var(--vscode-errorForeground)', label: 'Error' },
            { pattern: '/Warning:/i', color: 'var(--vscode-editorWarning-foreground)', label: 'Warning' },
            { pattern: '/DEBUG:/i', color: 'var(--vscode-descriptionForeground)', label: 'Debug' },
        ],
    },
];

const TEMPLATES_DIR = '.vscode/saropaLogCapture/templates';

/**
 * Get the templates directory URI for the workspace.
 */
function getTemplatesDir(): vscode.Uri | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }
    return vscode.Uri.joinPath(folder.uri, TEMPLATES_DIR);
}

/**
 * Load all templates (user-defined + built-in).
 * User templates with the same name override built-in ones.
 */
export async function loadTemplates(): Promise<SessionTemplate[]> {
    const templates = new Map<string, SessionTemplate>();

    // Add built-in templates
    for (const t of builtInTemplates) {
        templates.set(t.name.toLowerCase(), t);
    }

    // Load user templates
    const dir = getTemplatesDir();
    if (dir) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(dir);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File && name.endsWith('.json')) {
                    try {
                        const uri = vscode.Uri.joinPath(dir, name);
                        const data = await vscode.workspace.fs.readFile(uri);
                        const template = JSON.parse(Buffer.from(data).toString('utf-8')) as SessionTemplate;
                        if (template.name) {
                            templates.set(template.name.toLowerCase(), template);
                        }
                    } catch {
                        // Skip invalid template files
                    }
                }
            }
        } catch {
            // Templates directory doesn't exist yet
        }
    }

    return Array.from(templates.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Save a template to the workspace templates directory.
 */
export async function saveTemplate(template: SessionTemplate): Promise<void> {
    const dir = getTemplatesDir();
    if (!dir) {
        throw new Error('No workspace folder open');
    }

    // Ensure directory exists
    try {
        await vscode.workspace.fs.createDirectory(dir);
    } catch {
        // Directory may already exist
    }

    const filename = `${sanitizeFilename(template.name)}.json`;
    const uri = vscode.Uri.joinPath(dir, filename);
    const content = JSON.stringify(template, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
}

/**
 * Delete a user template by name.
 * Built-in templates cannot be deleted.
 */
export async function deleteTemplate(name: string): Promise<boolean> {
    // Check if it's a built-in template
    if (builtInTemplates.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        return false;
    }

    const dir = getTemplatesDir();
    if (!dir) {
        return false;
    }

    const filename = `${sanitizeFilename(name)}.json`;
    const uri = vscode.Uri.joinPath(dir, filename);

    try {
        await vscode.workspace.fs.delete(uri);
        return true;
    } catch {
        return false;
    }
}

/**
 * Apply a template to the current workspace settings.
 */
export async function applyTemplate(template: SessionTemplate): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');

    if (template.watchPatterns) {
        await cfg.update('watchPatterns', template.watchPatterns, vscode.ConfigurationTarget.Workspace);
    }

    if (template.exclusions) {
        await cfg.update('exclusions', template.exclusions, vscode.ConfigurationTarget.Workspace);
    }

    if (template.filterPresets) {
        await cfg.update('filterPresets', template.filterPresets, vscode.ConfigurationTarget.Workspace);
    }

    if (template.autoTagRules) {
        await cfg.update('autoTagRules', template.autoTagRules, vscode.ConfigurationTarget.Workspace);
    }

    if (template.splitRules) {
        await cfg.update('splitRules', template.splitRules, vscode.ConfigurationTarget.Workspace);
    }

    if (template.highlightRules) {
        await cfg.update('highlightRules', template.highlightRules, vscode.ConfigurationTarget.Workspace);
    }
}

/**
 * Create a template from the current workspace settings.
 */
export function createTemplateFromSettings(name: string, description?: string): SessionTemplate {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');

    return {
        name,
        description,
        createdAt: new Date().toISOString(),
        watchPatterns: cfg.get('watchPatterns'),
        exclusions: cfg.get('exclusions'),
        filterPresets: cfg.get('filterPresets'),
        autoTagRules: cfg.get('autoTagRules'),
        splitRules: cfg.get('splitRules'),
        highlightRules: cfg.get('highlightRules'),
    };
}


/**
 * Sanitize a filename by removing invalid characters.
 */
function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}
