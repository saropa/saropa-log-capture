"use strict";
/**
 * Bug report file creation orchestrator.
 *
 * Collects analysis data, extracts keywords, formats the report,
 * writes the file to the configured folder, and opens it in the editor.
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
exports.createBugReportFile = createBugReportFile;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const config_1 = require("../config/config");
const bug_report_collector_1 = require("./bug-report-collector");
const report_file_keywords_1 = require("./report-file-keywords");
const report_file_formatter_1 = require("./report-file-formatter");
/** Create a bug report file and open it in the editor. */
async function createBugReportFile(params) {
    const data = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Creating Bug Report File', cancellable: false }, async (progress) => {
        progress.report({ message: 'Collecting error context...' });
        return (0, bug_report_collector_1.collectBugReportData)(params.errorText, params.lineIndex, params.fileUri, params.extensionContext);
    });
    const reportData = {
        selectedText: params.selectedText,
        selectedLineStart: params.selectedLineStart,
        selectedLineEnd: params.selectedLineEnd,
        sessionInfo: params.sessionInfo,
        fullOutput: params.fullDecoratedOutput,
        fullOutputLineCount: params.fullOutputLineCount,
        bugReportData: data,
        extensionVersion: getExtensionVersion(params.extensionContext),
        vsCodeVersion: vscode.version,
        os: `${process.platform} ${process.arch}`,
    };
    const markdown = (0, report_file_formatter_1.formatReportFile)(reportData);
    const keywords = (0, report_file_keywords_1.extractKeywords)(params.selectedText || params.errorText);
    const filename = buildFilename(keywords);
    const folderUri = (0, config_1.getReportFolderUri)(vscode.workspace.workspaceFolders?.[0]);
    await vscode.workspace.fs.createDirectory(folderUri);
    const fileUri = vscode.Uri.joinPath(folderUri, filename);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(markdown, 'utf-8'));
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.reportFileCreated', filename));
}
function buildFilename(keywords) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const kw = keywords.length > 0 ? '_' + keywords.join('_') : '';
    return `${ts}_saropa_log_capture_report${kw}.md`;
}
function getExtensionVersion(ctx) {
    if (ctx?.extension?.packageJSON?.version) {
        return `v${ctx.extension.packageJSON.version}`;
    }
    const ext = vscode.extensions.getExtension('Saropa.saropa-log-capture');
    return ext?.packageJSON?.version ? `v${ext.packageJSON.version}` : 'unknown';
}
//# sourceMappingURL=report-file-writer.js.map