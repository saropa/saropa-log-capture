/**
 * Filter Presets Module
 *
 * Manages saved filter configurations for quick application in the viewer.
 * Presets save a combination of category filters, search patterns, and
 * exclusion toggles as named shortcuts.
 *
 * Presets are stored in workspace settings and can be applied via:
 * - Dropdown in viewer toolbar
 * - Command palette
 * - Keyboard shortcut
 */

import * as vscode from 'vscode';

/**
 * A saved filter preset configuration.
 * Captures the state of viewer filters for quick restoration.
 */
export interface FilterPreset {
    /** User-friendly name for the preset (e.g., "Errors Only"). */
    readonly name: string;

    /** DAP categories to show (empty = all). e.g., ["stderr", "console"] */
    readonly categories?: string[];

    /** Search pattern to apply (string or /regex/). */
    readonly searchPattern?: string;

    /** Whether exclusions should be enabled when preset is applied. */
    readonly exclusionsEnabled?: boolean;
}

/**
 * Built-in starter presets that ship with the extension.
 * Users can override these by creating presets with the same name.
 */
export const builtInPresets: readonly FilterPreset[] = [
    {
        name: 'Errors Only',
        categories: ['stderr'],
        searchPattern: '/error|exception|fatal|fail/i',
    },
    {
        name: 'Warnings & Errors',
        searchPattern: '/warn|error|exception|fatal/i',
    },
    {
        name: 'No Framework Noise',
        exclusionsEnabled: true,
    },
];

const SECTION = 'saropaLogCapture';
const PRESETS_KEY = 'filterPresets';

/**
 * Load all filter presets (user-defined + built-in).
 * User presets with the same name override built-in ones.
 *
 * @returns Array of all available presets
 */
export function loadPresets(): FilterPreset[] {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const userPresets = cfg.get<FilterPreset[]>(PRESETS_KEY, []);

    // Merge: user presets override built-in presets with same name
    const presetMap = new Map<string, FilterPreset>();

    for (const preset of builtInPresets) {
        presetMap.set(preset.name.toLowerCase(), preset);
    }

    for (const preset of userPresets) {
        if (preset.name) {
            presetMap.set(preset.name.toLowerCase(), preset);
        }
    }

    return Array.from(presetMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    );
}

/**
 * Save a new preset to workspace settings.
 * If a preset with the same name exists, it is overwritten.
 *
 * @param preset - The preset configuration to save
 */
export async function savePreset(preset: FilterPreset): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const existing = cfg.get<FilterPreset[]>(PRESETS_KEY, []);

    // Remove any existing preset with the same name (case-insensitive)
    const filtered = existing.filter(
        p => p.name.toLowerCase() !== preset.name.toLowerCase()
    );

    // Add the new preset
    filtered.push(preset);

    await cfg.update(PRESETS_KEY, filtered, vscode.ConfigurationTarget.Workspace);
}

/**
 * Delete a preset from workspace settings by name.
 *
 * @param name - Name of the preset to delete
 * @returns true if a preset was deleted, false if not found
 */
export async function deletePreset(name: string): Promise<boolean> {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const existing = cfg.get<FilterPreset[]>(PRESETS_KEY, []);

    const filtered = existing.filter(
        p => p.name.toLowerCase() !== name.toLowerCase()
    );

    if (filtered.length === existing.length) {
        return false; // Nothing was removed
    }

    await cfg.update(PRESETS_KEY, filtered, vscode.ConfigurationTarget.Workspace);
    return true;
}

/**
 * Get a preset by name.
 *
 * @param name - Name of the preset to find
 * @returns The preset if found, undefined otherwise
 */
export function getPreset(name: string): FilterPreset | undefined {
    const presets = loadPresets();
    return presets.find(p => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Show Quick Pick to select a preset.
 *
 * @returns The selected preset, or undefined if cancelled
 */
export async function pickPreset(): Promise<FilterPreset | undefined> {
    const presets = loadPresets();

    if (presets.length === 0) {
        vscode.window.showInformationMessage('No filter presets configured.');
        return undefined;
    }

    const items = presets.map(p => ({
        label: p.name,
        description: buildPresetDescription(p),
        preset: p,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a filter preset to apply',
        title: 'Filter Presets',
    });

    return selected?.preset;
}

/**
 * Build a description string for a preset (shown in Quick Pick).
 */
function buildPresetDescription(preset: FilterPreset): string {
    const parts: string[] = [];

    if (preset.categories && preset.categories.length > 0) {
        parts.push(`categories: ${preset.categories.join(', ')}`);
    }

    if (preset.searchPattern) {
        parts.push(`search: ${preset.searchPattern}`);
    }

    if (preset.exclusionsEnabled !== undefined) {
        parts.push(`exclusions: ${preset.exclusionsEnabled ? 'on' : 'off'}`);
    }

    return parts.join(' · ') || 'No filters';
}

/**
 * Prompt user to save current filters as a new preset.
 *
 * @param currentFilters - The current filter state from the viewer
 * @returns The saved preset, or undefined if cancelled
 */
export async function promptSavePreset(currentFilters: {
    categories?: string[];
    searchPattern?: string;
    exclusionsEnabled?: boolean;
}): Promise<FilterPreset | undefined> {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter a name for this filter preset',
        placeHolder: 'e.g., Errors Only, SQL Queries, Network Debug',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Preset name cannot be empty';
            }
            return undefined;
        },
    });

    if (!name) {
        return undefined;
    }

    const preset: FilterPreset = {
        name: name.trim(),
        ...currentFilters,
    };

    await savePreset(preset);
    vscode.window.showInformationMessage(`Filter preset "${preset.name}" saved.`);

    return preset;
}
