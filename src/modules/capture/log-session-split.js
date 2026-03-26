"use strict";
/**
 * File splitting logic called by LogSession when split rules fire (lines, bytes, time).
 * Closes the current log stream, opens the next part file, writes a continuation header.
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
exports.getPartFileName = getPartFileName;
exports.performFileSplit = performFileSplit;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const file_splitter_1 = require("../misc/file-splitter");
const log_session_helpers_1 = require("./log-session-helpers");
/** Get the filename for a given part number. */
function getPartFileName(baseFileName, partNumber) {
    if (partNumber === 0) {
        return `${baseFileName}.log`;
    }
    const partSuffix = String(partNumber + 1).padStart(3, '0');
    return `${baseFileName}_${partSuffix}.log`;
}
/** Close current file, open new part, write continuation header. */
async function performFileSplit(ctx, reason) {
    const nextPart = ctx.partNumber + 1;
    const splitMarker = `\n=== SPLIT: ${(0, file_splitter_1.formatSplitReason)(reason)} — Continued in part ${nextPart + 1} ===\n`;
    ctx.writeStream.write(splitMarker);
    await new Promise((resolve, reject) => {
        ctx.writeStream.end(() => resolve());
        ctx.writeStream.on('error', reject);
    });
    const newFileName = getPartFileName(ctx.baseFileName, nextPart);
    const newFilePath = path.join(ctx.logDirPath, newFileName);
    const newFileUri = vscode.Uri.file(newFilePath);
    const newStream = fs.createWriteStream(newFilePath, {
        flags: 'a',
        encoding: 'utf-8',
    });
    // Write continuation header
    const header = (0, log_session_helpers_1.generateContinuationHeader)(ctx.context, nextPart, reason, ctx.baseFileName);
    newStream.write(header);
    return {
        newStream,
        newFileUri,
        newPartNumber: nextPart,
        headerBytes: Buffer.byteLength(header, 'utf-8'),
    };
}
//# sourceMappingURL=log-session-split.js.map