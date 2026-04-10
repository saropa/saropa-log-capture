"use strict";
/**
 * Filter presets: saved filter configurations (categories, levels, search, exclusions) for the viewer.
 * Stored in workspace settings; loaded in extension-activation and applied via viewer toolbar / commands.
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
exports.builtInPresets = void 0;
exports.loadPresets = loadPresets;
exports.savePreset = savePreset;
exports.deletePreset = deletePreset;
exports.getPreset = getPreset;
exports.pickPreset = pickPreset;
exports.promptSavePreset = promptSavePreset;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
/**
 * Built-in starter presets that ship with the extension.
 * Users can override these by creating presets with the same name.
 */
exports.builtInPresets = [
    {
        name: 'Errors Only',
        levels: ['error'],
    },
    {
        name: 'Warnings & Errors',
        levels: ['error', 'warning'],
    },
    {
        name: 'Flutter Only',
        deviceEnabled: false,
    },
    {
        name: 'Just debug output',
        sources: ['debug'],
    },
    {
        name: 'Complete (all sources)',
        sources: [], // empty = show all (debug + terminal + any external)
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
function loadPresets() {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const userPresets = cfg.get(PRESETS_KEY, []);
    // Merge: user presets override built-in presets with same name
    const presetMap = new Map();
    for (const preset of exports.builtInPresets) {
        presetMap.set(preset.name.toLowerCase(), preset);
    }
    for (const preset of userPresets) {
        if (preset.name) {
            presetMap.set(preset.name.toLowerCase(), preset);
        }
    }
    return Array.from(presetMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * Save a new preset to workspace settings.
 * If a preset with the same name exists, it is overwritten.
 *
 * @param preset - The preset configuration to save
 */
async function savePreset(preset) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const existing = cfg.get(PRESETS_KEY, []);
    // Remove any existing preset with the same name (case-insensitive)
    const filtered = existing.filter(p => p.name.toLowerCase() !== preset.name.toLowerCase());
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
async function deletePreset(name) {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const existing = cfg.get(PRESETS_KEY, []);
    const filtered = existing.filter(p => p.name.toLowerCase() !== name.toLowerCase());
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
function getPreset(name) {
    const presets = loadPresets();
    return presets.find(p => p.name.toLowerCase() === name.toLowerCase());
}
/**
 * Show Quick Pick to select a preset.
 *
 * @returns The selected preset, or undefined if cancelled
 */
async function pickPreset() {
    const presets = loadPresets();
    if (presets.length === 0) {
        vscode.window.showInformationMessage((0, l10n_1.t)('msg.noFilterPresets'));
        return undefined;
    }
    const items = presets.map(p => ({
        label: p.name,
        description: buildPresetDescription(p),
        preset: p,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: (0, l10n_1.t)('prompt.selectPreset'),
        title: 'Quick Filters',
    });
    return selected?.preset;
}
/**
 * Build a description string for a preset (shown in Quick Pick).
 */
function buildPresetDescription(preset) {
    const parts = [];
    if (preset.sources && preset.sources.length > 0) {
        parts.push(`sources: ${preset.sources.join(', ')}`);
    }
    else if (preset.sources && preset.sources.length === 0) {
        parts.push('all sources');
    }
    if (preset.levels && preset.levels.length > 0) {
        parts.push(`levels: ${preset.levels.join(', ')}`);
    }
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
async function promptSavePreset(currentFilters) {
    const name = await vscode.window.showInputBox({
        prompt: (0, l10n_1.t)('prompt.presetName'),
        placeHolder: (0, l10n_1.t)('prompt.presetPlaceholder'),
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Quick Filter name cannot be empty';
            }
            return undefined;
        },
    });
    if (!name) {
        return undefined;
    }
    const preset = {
        name: name.trim(),
        ...currentFilters,
    };
    await savePreset(preset);
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.filterPresetSaved', preset.name));
    return preset;
}
//# sourceMappingURL=filter-presets.js.map