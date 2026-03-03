/**
 * File splitting logic called by LogSession when split rules fire (lines, bytes, time).
 * Closes the current log stream, opens the next part file, writes a continuation header.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SplitReason, formatSplitReason } from '../misc/file-splitter';
import { SessionContext, generateContinuationHeader } from './log-session-helpers';

/** State needed to perform a file split. */
export interface SplitContext {
    readonly writeStream: fs.WriteStream;
    readonly logDirPath: string;
    readonly baseFileName: string;
    readonly partNumber: number;
    readonly context: SessionContext;
}

/** Result of a successful file split. */
export interface SplitResult {
    readonly newStream: fs.WriteStream;
    readonly newFileUri: vscode.Uri;
    readonly newPartNumber: number;
    readonly headerBytes: number;
}

/** Get the filename for a given part number. */
export function getPartFileName(baseFileName: string, partNumber: number): string {
    if (partNumber === 0) {
        return `${baseFileName}.log`;
    }
    const partSuffix = String(partNumber + 1).padStart(3, '0');
    return `${baseFileName}_${partSuffix}.log`;
}

/** Close current file, open new part, write continuation header. */
export async function performFileSplit(
    ctx: SplitContext,
    reason: SplitReason,
): Promise<SplitResult> {
    const nextPart = ctx.partNumber + 1;

    const splitMarker = `\n=== SPLIT: ${formatSplitReason(reason)} — Continued in part ${nextPart + 1} ===\n`;
    ctx.writeStream.write(splitMarker);

    await new Promise<void>((resolve, reject) => {
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
    const header = generateContinuationHeader(ctx.context, nextPart, reason, ctx.baseFileName);
    newStream.write(header);

    return {
        newStream,
        newFileUri,
        newPartNumber: nextPart,
        headerBytes: Buffer.byteLength(header, 'utf-8'),
    };
}
