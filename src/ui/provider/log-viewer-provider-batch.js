"use strict";
/**
 * Live-line batching for LogViewerProvider.
 * Handles addLine processing, batch timer, and periodic flush.
 * Extracted to keep log-viewer-provider.ts under the line limit.
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
exports.addLineToBatch = addLineToBatch;
exports.startBatchTimer = startBatchTimer;
exports.stopBatchTimer = stopBatchTimer;
exports.flushPendingBatch = flushPendingBatch;
const ansi_1 = require("../../modules/capture/ansi");
const source_linker_1 = require("../../modules/source/source-linker");
const viewer_thread_grouping_1 = require("../viewer/viewer-thread-grouping");
const helpers = __importStar(require("./viewer-provider-helpers"));
const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;
/** Queue a live line for the next batch flush. */
function addLineToBatch(target, data) {
    if (!target.getView()?.visible) {
        return;
    }
    let html = data.isMarker ? (0, ansi_1.escapeHtml)(data.text) : (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.ansiToHtml)(data.text)));
    if (!data.isMarker) {
        html = helpers.tryFormatThreadHeader(data.text, html);
    }
    const fw = helpers.classifyFrame(data.text);
    const qualityPercent = data.isMarker ? undefined : helpers.lookupQuality(data.text, fw);
    const line = {
        text: html, isMarker: data.isMarker, lineCount: data.lineCount,
        category: data.category, timestamp: data.timestamp.getTime(),
        fw, sourcePath: data.sourcePath,
        ...(qualityPercent !== undefined ? { qualityPercent } : {}),
    };
    (0, viewer_thread_grouping_1.processLineForThreadDump)(target.threadDumpState, line, data.text, target.pendingLines);
}
/** Start the periodic batch flush timer. */
function startBatchTimer(target) {
    stopBatchTimer(target);
    scheduleNextBatch(target);
}
/** Stop the periodic batch flush timer. */
function stopBatchTimer(target) {
    if (target.batchTimer !== undefined) {
        clearTimeout(target.batchTimer);
        target.batchTimer = undefined;
    }
}
/** Flush pending lines and clear the thread-dump accumulator. */
function flushPendingBatch(target) {
    (0, viewer_thread_grouping_1.flushThreadDump)(target.threadDumpState, target.pendingLines);
    helpers.flushBatch(target.pendingLines, !!target.getView(), (msg) => target.postMessage(msg), (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), (msg) => target.postMessage(msg)));
}
function scheduleNextBatch(target) {
    if (!target.getView()) {
        return;
    }
    const delay = target.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
    target.batchTimer = setTimeout(() => {
        target.batchTimer = undefined;
        helpers.flushBatch(target.pendingLines, !!target.getView(), (msg) => target.postMessage(msg), (lines) => helpers.sendNewCategories(lines, target.getSeenCategories(), (msg) => target.postMessage(msg)));
        scheduleNextBatch(target);
    }, delay);
}
//# sourceMappingURL=log-viewer-provider-batch.js.map