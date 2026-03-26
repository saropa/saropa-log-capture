"use strict";
/** Render Crashlytics crash event detail — frame classification and HTML output. */
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
exports.renderCrashDetail = renderCrashDetail;
exports.renderDeviceDistribution = renderDeviceDistribution;
exports.renderApiDistribution = renderApiDistribution;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../../modules/capture/ansi");
const stack_parser_1 = require("../../modules/analysis/stack-parser");
const source_linker_1 = require("../../modules/source/source-linker");
const analysis_frame_render_1 = require("./analysis-frame-render");
/** Classify Crashlytics stack frames as app or framework using workspace context. */
function classifyFrames(frames) {
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return frames.map(f => ({
        text: f.text,
        isApp: !(0, stack_parser_1.isFrameworkFrame)(f.text, wsPath),
        sourceRef: (0, source_linker_1.extractSourceReference)(f.text),
    }));
}
/** Render crash event detail with classified stack frames, device metadata, keys, and logs. */
function renderCrashDetail(detail) {
    if (!detail.crashThread && detail.appThreads.length === 0 && !detail.customKeys?.length && !detail.logs?.length) {
        return '<div class="no-matches">No stack trace available</div>';
    }
    let html = renderDeviceMeta(detail);
    if (detail.crashThread) {
        html += `<div class="crash-thread-header">${(0, ansi_1.escapeHtml)(detail.crashThread.name)}</div>`;
        const frames = classifyFrames(detail.crashThread.frames);
        if (frames.length > 0) {
            html += (0, analysis_frame_render_1.renderFrameSection)(frames);
        }
        else {
            html += '<div class="no-matches">No frames in crash thread</div>';
        }
    }
    const appThreads = detail.appThreads.filter(t => {
        const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return t.frames.some(f => !(0, stack_parser_1.isFrameworkFrame)(f.text, wsPath));
    });
    if (appThreads.length > 0) {
        html += renderAppThreads(appThreads);
    }
    if (detail.customKeys && detail.customKeys.length > 0) {
        html += renderKeysSection(detail.customKeys);
    }
    if (detail.logs && detail.logs.length > 0) {
        html += renderLogsSection(detail.logs);
    }
    return html;
}
function renderDeviceMeta(detail) {
    const parts = [];
    if (detail.deviceModel) {
        parts.push((0, ansi_1.escapeHtml)(detail.deviceModel));
    }
    if (detail.osVersion) {
        parts.push(`Android ${(0, ansi_1.escapeHtml)(detail.osVersion)}`);
    }
    if (detail.eventTime) {
        parts.push((0, ansi_1.escapeHtml)(formatEventTime(detail.eventTime)));
    }
    if (parts.length === 0) {
        return '';
    }
    return `<div class="crash-device-meta">${parts.join(' · ')}</div>`;
}
function formatEventTime(raw) {
    try {
        return new Date(raw).toLocaleString();
    }
    catch {
        return raw;
    }
}
function renderKeysSection(keys) {
    let html = '<details class="group"><summary class="group-header">Keys <span class="match-count">' + keys.length + '</span></summary><table class="crash-keys-table">';
    for (const kv of keys) {
        html += `<tr><td class="crash-key-name">${(0, ansi_1.escapeHtml)(kv.key)}</td><td class="crash-key-value">${(0, ansi_1.escapeHtml)(kv.value)}</td></tr>`;
    }
    return html + '</table></details>';
}
function renderLogsSection(logs) {
    let html = '<details class="group"><summary class="group-header">Logs <span class="match-count">' + logs.length + ' breadcrumbs</span></summary>';
    for (const entry of logs) {
        const ts = entry.timestamp ? `<span class="crash-log-ts">${(0, ansi_1.escapeHtml)(entry.timestamp)}</span> ` : '';
        html += `<div class="crash-log-entry">${ts}${(0, ansi_1.escapeHtml)(entry.message)}</div>`;
    }
    return html + '</details>';
}
function renderAppThreads(threads) {
    let html = `<details class="group"><summary class="group-header">Other Threads <span class="match-count">${threads.length} with app frames</span></summary>`;
    for (const t of threads.slice(0, 5)) {
        html += `<div class="crash-thread-header">${(0, ansi_1.escapeHtml)(t.name)}</div>`;
        const frames = classifyFrames(t.frames);
        const appFrames = frames.filter(f => f.isApp);
        for (const f of appFrames.slice(0, 10)) {
            const badge = '<span class="frame-badge frame-badge-app">APP</span>';
            if (f.sourceRef) {
                const file = (0, ansi_1.escapeHtml)(f.sourceRef.filePath);
                html += `<div class="stack-frame frame-app" data-frame-file="${file}" data-frame-line="${f.sourceRef.line}">${badge}<span class="line-text">${(0, ansi_1.escapeHtml)(f.text)}</span></div>`;
            }
            else {
                html += `<div class="stack-frame frame-app-nosrc">${badge}<span class="line-text">${(0, ansi_1.escapeHtml)(f.text)}</span></div>`;
            }
        }
    }
    return html + '</details>';
}
/** Render device/OS distribution summary across all events in an issue. */
function renderDeviceDistribution(multi) {
    if (multi.events.length < 2) {
        return '';
    }
    const devices = new Map();
    const osVersions = new Map();
    for (const ev of multi.events) {
        if (ev.deviceModel) {
            devices.set(ev.deviceModel, (devices.get(ev.deviceModel) ?? 0) + 1);
        }
        if (ev.osVersion) {
            osVersions.set(ev.osVersion, (osVersions.get(ev.osVersion) ?? 0) + 1);
        }
    }
    if (devices.size === 0 && osVersions.size === 0) {
        return '';
    }
    let html = '<details class="group" open><summary class="group-header">Device Distribution <span class="match-count">' + multi.events.length + ' events</span></summary>';
    if (devices.size > 0) {
        html += renderDistributionBar('Devices', devices, multi.events.length);
    }
    if (osVersions.size > 0) {
        html += renderDistributionBar('OS Versions', osVersions, multi.events.length);
    }
    return html + '</details>';
}
/** Render aggregate device/OS distribution from Crashlytics stats API. */
function renderApiDistribution(stats) {
    if (stats.deviceStats.length === 0 && stats.osStats.length === 0) {
        return '';
    }
    let html = '<details class="group" open><summary class="group-header">Aggregate Distribution <span class="match-count">all events</span></summary>';
    if (stats.deviceStats.length > 0) {
        const devices = new Map(stats.deviceStats.map(e => [e.name, e.count]));
        html += renderDistributionBar('Devices', devices, stats.deviceStats.reduce((s, e) => s + e.count, 0));
    }
    if (stats.osStats.length > 0) {
        const os = new Map(stats.osStats.map(e => [e.name, e.count]));
        html += renderDistributionBar('OS Versions', os, stats.osStats.reduce((s, e) => s + e.count, 0));
    }
    return html + '</details>';
}
function renderDistributionBar(label, counts, total) {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    let html = `<div class="crash-dist-label">${label}</div>`;
    for (const [name, count] of sorted) {
        const pct = Math.round((count / total) * 100);
        html += `<div class="crash-dist-row"><span class="crash-dist-name">${(0, ansi_1.escapeHtml)(name)}</span><div class="crash-dist-bar-bg"><div class="crash-dist-bar-fill" style="width:${pct}%"></div></div><span class="crash-dist-count">${count} (${pct}%)</span></div>`;
    }
    return html;
}
//# sourceMappingURL=analysis-crash-detail.js.map