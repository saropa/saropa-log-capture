"use strict";
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
exports.StatusBar = void 0;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
class StatusBar {
    item;
    lineCount = 0;
    paused = false;
    watchCounts = new Map();
    constructor() {
        this.item = vscode.window.createStatusBarItem('saropaLogCapture.status', vscode.StatusBarAlignment.Right, 50);
        this.item.name = 'Saropa Log Capture';
        this.item.command = 'saropaLogCapture.open';
        this.hide();
    }
    show() {
        this.lineCount = 0;
        this.paused = false;
        this.updateText();
        this.item.show();
    }
    hide() {
        this.item.hide();
    }
    updateLineCount(count) {
        this.lineCount = count;
        this.updateText();
    }
    setPaused(value) {
        this.paused = value;
        this.updateText();
    }
    /** Update keyword watch hit counts shown in the status bar. */
    updateWatchCounts(counts) {
        this.watchCounts = new Map(counts);
        this.updateText();
    }
    formatCount(n) {
        return n.toLocaleString('en-US');
    }
    updateText() {
        const watchSuffix = this.buildWatchSuffix();
        const count = this.formatCount(this.lineCount);
        if (this.paused) {
            this.item.text = `$(debug-pause) ${(0, l10n_1.t)('statusBar.pausedLines', count)}${watchSuffix}`;
            this.item.tooltip = (0, l10n_1.t)('statusBar.pausedTooltip');
        }
        else {
            this.item.text = `$(record) ${(0, l10n_1.t)('statusBar.lines', count)}${watchSuffix}`;
            this.item.tooltip = (0, l10n_1.t)('statusBar.recordingTooltip');
        }
    }
    buildWatchSuffix() {
        const parts = [];
        for (const [label, count] of this.watchCounts) {
            if (count > 0) {
                parts.push(`${label}: ${count}`);
            }
        }
        return parts.length > 0 ? ` | ${parts.join(' | ')}` : '';
    }
    dispose() {
        this.item.dispose();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=status-bar.js.map