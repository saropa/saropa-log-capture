"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.builtInTemplates = void 0;
exports.loadTemplates = loadTemplates;
exports.saveTemplate = saveTemplate;
exports.deleteTemplate = deleteTemplate;
exports.applyTemplate = applyTemplate;
exports.createTemplateFromSettings = createTemplateFromSettings;
const vscode = __importStar(require("vscode"));
/** Built-in starter templates for common frameworks. */
exports.builtInTemplates = [
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
function getTemplatesDir() {
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
async function loadTemplates() {
    const templates = new Map();
    // Add built-in templates
    for (const t of exports.builtInTemplates) {
        templates.set(t.name.toLowerCase(), t);
    }
    // Load user templates
    const dir = getTemplatesDir();
    if (dir) {
        await loadUserTemplates(dir, templates);
    }
    return Array.from(templates.values()).sort((a, b) => a.name.localeCompare(b.name));
}
async function loadUserTemplates(dir, templates) {
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return;
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith('.json')) {
            continue;
        }
        try {
            const data = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dir, name));
            const template = JSON.parse(Buffer.from(data).toString('utf-8'));
            if (template.name) {
                templates.set(template.name.toLowerCase(), template);
            }
        }
        catch { /* skip invalid template files */ }
    }
}
/**
 * Save a template to the workspace templates directory.
 */
async function saveTemplate(template) {
    const dir = getTemplatesDir();
    if (!dir) {
        throw new Error('No workspace folder open');
    }
    // Ensure directory exists
    try {
        await vscode.workspace.fs.createDirectory(dir);
    }
    catch {
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
async function deleteTemplate(name) {
    // Check if it's a built-in template
    if (exports.builtInTemplates.some(t => t.name.toLowerCase() === name.toLowerCase())) {
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
    }
    catch {
        return false;
    }
}
/**
 * Apply a template to the current workspace settings.
 */
async function applyTemplate(template) {
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
function createTemplateFromSettings(name, description) {
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
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}
//# sourceMappingURL=session-templates.js.map