# Plan: Voice / TTS (read selected lines or errors)

**Feature:** Read selected log lines or error text aloud using text-to-speech (TTS).

---

## What exists

- Viewer with selection; context menu and commands.
- Audio used elsewhere (e.g. sounds for errors) if applicable.
- VS Code / extension host environment (Node or webview).

## What's missing

1. **TTS API** — Use browser/VS Code TTS: in webview, `speechSynthesis`; in extension host, use Node or invoke webview to speak. VS Code does not expose a built-in TTS API; webview or system TTS required.
2. **Trigger** — Context menu: "Read selection" or "Read with voice"; optional command "Read current line" / "Read error at cursor."
3. **Control** — Stop speaking; optional rate/volume (if API supports); optional "Read from here" (current line to end of selection or next N lines).

## Implementation

### 1. Webview TTS

- In viewer webview, add message handler for "readAloud" with text payload. In webview script, use `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`. Queue or cancel on "stopReading."
- Long text: chunk into sentences or by length to avoid timeouts; optional pause between chunks.

### 2. Context menu and commands

- "Read selection" — get selected text from viewer; post to webview to speak.
- "Read current line" — get line at cursor; post to webview to speak.
- "Stop reading" — cancel speech in webview.

### 3. Settings

- Optional: `saropaLogCapture.tts.enabled` (default true); `saropaLogCapture.tts.rate` (if supported); `saropaLogCapture.tts.volume`.

## Files to create/modify

| File | Change |
|------|--------|
| Viewer webview script | Handle readAloud/stopReading; call speechSynthesis |
| Viewer message handler | Handle "Read selection" / "Read line"; pass text to webview |
| Context menu HTML/actions | Add "Read selection" / "Read with voice"; "Stop reading" |
| `package.json` / settings | Optional TTS settings |
| l10n | Strings for menu and commands |

## Considerations

- Accessibility: TTS helps users who prefer or need spoken output.
- Log content may be noisy (stack traces, tokens); optional filter (e.g. strip URLs, truncate) before speaking.
- Browser/OS may limit or throttle TTS; handle "not supported" gracefully.

## Effort

**2–4 days** for MVP (read selection + stop).
