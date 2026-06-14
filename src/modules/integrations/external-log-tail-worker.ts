/**
 * Per-file tail worker for the External Logs integration. Watches one file,
 * appends newly-written lines to a shared buffer, and handles two advanced
 * cases the original single-file tailer could not:
 *  - late appearance (createIfMissing / glob not yet matched): watch the parent
 *    directory and attach once a target file exists.
 *  - rotation (followRotation): when the tailed file is recreated (inode change)
 *    or truncated, or a newer glob match appears, re-tail from the new start.
 *
 * `resolveLatest()` returns the path that should be tailed right now (the glob's
 * latest match, or the fixed path when it exists), decoupling this worker from
 * glob/fs-resolution specifics.
 */

import * as fs from 'node:fs';

/** Construction options for a {@link TailWorker}. */
export interface TailWorkerOptions {
    readonly buffer: string[];
    readonly maxLines: number;
    readonly followRotation: boolean;
    /** Watch the directory for a target appearing (createIfMissing or glob). */
    readonly watchForAppearance: boolean;
    readonly watchDir: string;
    /** Best path to tail now, or undefined if none exists yet. */
    readonly resolveLatest: () => string | undefined;
    readonly outputChannel: { appendLine(line: string): void };
    readonly onAttachedChange: () => void;
    readonly registerTimeout: (t: ReturnType<typeof setTimeout>) => void;
}

/** Tails a single file with rotation and late-appearance handling. */
export class TailWorker {
    private currentPath: string | undefined;
    private position = 0;
    private inode: number | undefined;
    private attached = false;
    private fileWatcher: fs.FSWatcher | undefined;
    private dirWatcher: fs.FSWatcher | undefined;
    private scheduled = false;

    constructor(private readonly opts: TailWorkerOptions) {}

    /** True when a real file is currently being tailed. */
    isAttached(): boolean { return this.attached; }

    /** Resolve and attach, or watch the directory until a target appears. */
    start(): void {
        const p = this.opts.resolveLatest();
        if (p) { this.attach(p); return; }
        if (this.opts.watchForAppearance) { this.watchDirectory(); return; }
        this.opts.outputChannel.appendLine('[externalLogs] External log not found (and createIfMissing off).');
    }

    /** Close both watchers. */
    close(): void {
        this.closeWatcher(this.fileWatcher); this.fileWatcher = undefined;
        this.closeWatcher(this.dirWatcher); this.dirWatcher = undefined;
    }

    private closeWatcher(w: fs.FSWatcher | undefined): void {
        try { w?.close(); } catch { /* ignore */ }
    }

    private attach(filePath: string): void {
        try {
            const st = fs.statSync(filePath);
            this.position = st.size;
            this.inode = st.ino;
        } catch { return; }
        this.currentPath = filePath;
        this.attached = true;
        this.startFileWatch();
        // A rotated/late file also needs a directory watch to re-resolve targets.
        if (this.opts.followRotation || this.opts.watchForAppearance) { this.watchDirectory(); }
        this.opts.onAttachedChange();
        this.schedule();
    }

    private startFileWatch(): void {
        this.closeWatcher(this.fileWatcher);
        if (!this.currentPath) { return; }
        try {
            this.fileWatcher = fs.watch(this.currentPath, { persistent: false }, () => this.schedule());
        } catch { /* watch may fail on some filesystems; dir watch still covers it */ }
    }

    private watchDirectory(): void {
        if (this.dirWatcher) { return; }
        try {
            this.dirWatcher = fs.watch(this.opts.watchDir, { persistent: false }, () => this.schedule());
        } catch { /* parent dir unwatchable */ }
    }

    /** Debounce fs.watch bursts into a single read after the burst settles. */
    private schedule(): void {
        if (this.scheduled) { return; }
        this.scheduled = true;
        const t = setTimeout(() => { this.scheduled = false; this.onChange(); }, 50);
        this.opts.registerTimeout(t);
    }

    private onChange(): void {
        if (!this.attached) {
            const p = this.opts.resolveLatest();
            if (p) { this.attach(p); }
            return;
        }
        // Rotation by new glob match (a newer file replaced the matched one).
        if (this.opts.followRotation) {
            const latest = this.opts.resolveLatest();
            if (latest && latest !== this.currentPath) { this.switchTo(latest); return; }
        }
        this.readAvailable();
    }

    private switchTo(filePath: string): void {
        this.currentPath = filePath;
        this.position = 0;
        try { this.inode = fs.statSync(filePath).ino; } catch { this.inode = undefined; }
        this.startFileWatch();
        this.readAvailable();
    }

    private readAvailable(): void {
        if (!this.currentPath) { return; }
        let st: fs.Stats;
        try { st = fs.statSync(this.currentPath); } catch { return; }
        // Same path, new inode = recreated (rotation in place); re-tail from start.
        if (this.opts.followRotation && this.inode !== undefined && st.ino !== this.inode) {
            this.position = 0;
            this.inode = st.ino;
        } else if (st.size < this.position) {
            // Truncation (e.g. log truncated/rotated in place).
            this.position = 0;
        }
        this.position = this.readNewBytes(this.position, st.size);
    }

    private readNewBytes(fromPos: number, size: number): number {
        if (size <= fromPos || !this.currentPath) { return fromPos; }
        const toRead = size - fromPos;
        let fd: number | undefined;
        try {
            fd = fs.openSync(this.currentPath, 'r');
            const buf = Buffer.alloc(toRead);
            fs.readSync(fd, buf, 0, toRead, fromPos);
            const chunk = buf.toString('utf-8').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
            const lines = chunk.split('\n');
            const complete = chunk.endsWith('\n') ? lines.slice(0, -1) : lines.slice(0, -1);
            for (const line of complete) { this.opts.buffer.push(line ?? ''); }
            this.cap();
            const consumed = complete.length === 0 ? 0 : Buffer.byteLength(complete.join('\n') + '\n', 'utf-8');
            return fromPos + Math.min(consumed, toRead);
        } catch {
            return fromPos;
        } finally {
            if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* ignore */ } }
        }
    }

    private cap(): void {
        while (this.opts.buffer.length > this.opts.maxLines) { this.opts.buffer.shift(); }
    }
}
