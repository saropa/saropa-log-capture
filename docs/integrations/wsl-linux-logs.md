# Integration: WSL and Linux Logs

## Problem and Goal

When debugging **WSL-based** or **remote Linux** targets (e.g. Node/Python in WSL, or attach to process on Linux), system-level context that might explain failures (OOM killer, driver issues, filesystem errors) lives in **Linux logs**: `dmesg`, `journalctl`, or `/var/log/syslog`. Developers on Windows rarely open WSL and run `journalctl -b` to correlate. This integration optionally captures **WSL/Linux system log excerpts** for the session time range and attaches them to the session (header summary or sidecar) so that "what Linux said" is available alongside the debug log without leaving VS Code.

**Goal:** When the debug session is running in **WSL** or against a **remote Linux** host (detected from launch config or VS Code remote name), optionally run **Linux log queries** (e.g. `dmesg -T`, `journalctl -b --since ... --until ...`) in that environment and attach the output to the session—as a sidecar file or a short summary in the header—so that kernel and system messages are correlated with the debug timeline.

---

## Data Sources

| Source | Content | How to get it |
|--------|---------|---------------|
| **dmesg** | Kernel ring buffer (hardware, drivers, OOM) | Run `dmesg -T` (human-readable timestamps) in WSL/Linux |
| **journalctl** | Systemd journal (services, auth, kernel) | `journalctl -b --since "<start>" --until "<end>" -o short-precise` |
| **syslog** | Traditional syslog (if no systemd) | Read `/var/log/syslog` or `/var/log/messages` for time range (grep or tail) |
| **WSL** | Same as above, inside WSL | Run via `wsl -e dmesg -T` (from Windows host) or from extension in WSL context |

**Challenge:** The extension usually runs in the **VS Code host** (Windows). To get WSL/Linux logs we must **run commands inside WSL or on the remote**. Options: (1) **WSL:** From Windows, run `wsl -e bash -c "dmesg -T"` (or `wsl -d Ubuntu -e ...`). (2) **Remote - WSL / Remote - SSH:** When the workspace is in WSL or SSH, the extension runs in that context, so Node’s `child_process` would run `dmesg` directly on that Linux. So: when `vscode.env.remoteName === 'wsl'` or `'ssh-remote'`, we’re already on Linux—just run `dmesg` and `journalctl`. When we’re on Windows and the **debuggee** is in WSL, we need to run `wsl -e ...` to get WSL’s dmesg.

---

## Integration Approach

### 1. When to collect

- **Session end (or on demand):** When session ends (or user runs "Attach WSL/Linux logs"), compute time range (session start–end with optional lead/lag). Then:
  - **If extension host is WSL/SSH:** Run `dmesg -T` and `journalctl -b --since <start> --until <end> --no-pager -o short-precise` in the same environment (same shell). Capture stdout; write to sidecar.
  - **If extension host is Windows and we know target is WSL:** Run `wsl -e bash -c "dmesg -T; echo '---'; journalctl -b --since '<start>' --until '<end>' --no-pager -o short-precise"` (with proper escaping). Capture stdout; write to sidecar.
- **Session start:** Optionally record "Target: WSL" or "Target: Linux (remote)" in header so we know we’re in a context where Linux logs are relevant.

### 2. Where to store and display

- **Sidecar:** `basename.linux.log` or `basename.wsl.log` containing dmesg + journalctl (with a separator). Or two files: `basename.dmesg.log`, `basename.journal.log`.
- **Header:** One line: `Linux logs: see basename.linux.log` (or "WSL logs" when from Windows→WSL).
- **Viewer:** "System (Linux)" tab when sidecar exists; show content (same as Windows events or Terminal tab).

### 3. Detection

- **Target is WSL:** From launch config: e.g. `"useWSL": true` or runtime is `wsl` or program path starts with `\\wsl$\`. Or from debug adapter type (e.g. `node` with `runtimeExecutable` in WSL). Set flag "targetIsWsl".
- **Extension in WSL:** `vscode.env.remoteName === 'wsl'` → we’re already in WSL; run local commands.
- **Extension on Windows, target WSL:** Run `wsl -e ...`. Optionally allow user to set `wsl.distro` (e.g. Ubuntu) for `wsl -d Ubuntu -e ...`.

---

## User Experience

### Settings (under `saropaLogCapture.linuxLogs.*` or `wsl.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable WSL/Linux log capture |
| `when` | `"wsl"` \| `"remote"` \| `"always"` | `"wsl"` | Capture when target is WSL, or when in remote (SSH/WSL), or always if on Linux |
| `sources` | string[] | `["dmesg", "journalctl"]` | Which to run: dmesg, journalctl |
| `leadMinutes` | number | `2` | Minutes before session start |
| `lagMinutes` | number | `5` | Minutes after session end |
| `maxLines` | number | `1000` | Cap total lines (trim from start) |
| `wslDistro` | string | `""` | WSL distribution (e.g. Ubuntu) when running from Windows; empty = default |
| `output` | `"sidecar"` \| `"header"` \| `"both"` | `"sidecar"` | Same as Windows events |

### Commands

- **"Saropa Log Capture: Attach WSL/Linux logs to current session"** — Run dmesg/journalctl for session time range and write sidecar.
- **"Saropa Log Capture: Open Linux logs for this session"** — Open sidecar in viewer or editor.

### UI

- **Header:** `Linux logs: see basename.linux.log` when sidecar exists.
- **Viewer:** "Linux" or "System (Linux)" tab with sidecar content.

---

## Implementation Outline

### Components

1. **Target detection**
   - From `SessionContext.configuration`: check for `useWSL`, `runtimeExecutable` (path containing `wsl`), or adapter-specific props. Set `targetIsWsl: boolean`. When `vscode.env.remoteName === 'wsl'`, we’re in WSL; when it’s `ssh-remote`, we’re on remote Linux.
   - Helper: `isTargetWsl(context): boolean` and `isExtensionOnLinux(): boolean`.

2. **Command runner**
   - **In WSL/SSH (extension on Linux):** `child_process.spawn('dmesg', ['-T'], { shell: false })`; then `journalctl -b --since ... --until ...`. Combine output; write to sidecar.
   - **On Windows, target WSL:** `child_process.spawn('wsl', ['-e', 'bash', '-c', 'dmesg -T; echo "---"; journalctl ...']`. Or `wsl -d <distro> -e ...` if wslDistro set. Capture stdout/stderr; parse and trim to maxLines.
   - **Time format:** Use ISO 8601 for --since/--until (journalctl accepts it). Session start/end from SessionContext.date and session end time.

3. **Session end hook**
   - When session ends, if `linuxLogs.enabled` and (targetIsWsl or extension on Linux), run command runner; write to `basename.linux.log` in session folder. Non-blocking; do not fail session on error (e.g. permission denied for journalctl).

4. **Viewer**
   - Same as Windows events: when `basename.linux.log` exists, show "Open Linux logs" and optional "Linux" tab with content.

### Permissions

- `dmesg` may require root on some systems (kernel.dmesg_restrict). Document: "If dmesg fails, run with sudo or add user to appropriate group."
- `journalctl` for full journal may require root; user can restrict to `--user` or current user’s logs if available. Document.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.linuxLogs.*` or `saropaLogCapture.wsl.*` as above.
- **Remote:** When using Remote - SSH, extension runs on Linux; no WSL involved.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| dmesg/journalctl permission | Log and continue; document |
| WSL not installed (Windows) | Check `wsl` in PATH; skip and log |
| Wrong distro | Let user set wslDistro |
| Large output | maxLines; use --since/--until strictly |

**Alternatives:**

- **Only when in WSL:** Don’t support SSH remote; only "Windows host + WSL target" and "WSL host." Simplifies detection.
- **Single file:** One sidecar with both dmesg and journalctl, separated by "---" for clarity.

---

## References

- journalctl: [Filtering by time](https://www.freedesktop.org/software/systemd/man/journalctl.html)
- dmesg: [dmesg(1)](https://man7.org/linux/man-pages/man1/dmesg.1.html)
- Existing: Windows Event Log integration (sidecar, viewer tab pattern).
