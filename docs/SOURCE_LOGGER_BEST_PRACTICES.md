# Source Logger Best Practices

How to structure your app's debug logging for the best experience with
Saropa Log Capture.

---

## The pipeline

```
Your app  →  dart:developer log()  →  Debug adapter  →  DAP events  →  Saropa Log Capture
```

Each layer adds its own metadata:

| Layer | What it adds |
|-------|-------------|
| **Your app** | Message text, optional stack frames in text, ANSI colors |
| **Debug adapter** (e.g. Dart DA) | Bracket prefix (`[log]`), splits multi-line output into separate events |
| **Saropa Log Capture** (file) | `[HH:MM:SS.mmm] [category]` per event |
| **Saropa Log Capture** (viewer) | Line number, timestamp, severity bar, badges, filters |

**Key consequence:** every `\n` in your log message becomes a separate line in
the capture file, each with its own timestamp and category prefix.

---

## What Saropa Log Capture provides

The viewer already decorates each line with:

- **Sequential line counter** — configurable on/off
- **Wall-clock timestamp** — from the DAP event timestamp
- **Session elapsed time** — optional
- **Severity bar** — color-coded by log level
- **Category badge** — shows `console`, `stdout`, `stderr`, etc.
- **Source tag filter** — toggles `[log]`, `[SDA]`, and other bracket tags

Your app does not need to duplicate any of these in the message text.

---

## Recommendations

### Use `dart:developer` `log()` parameters

The `log()` function accepts structured metadata that Saropa Log Capture reads:

```dart
import 'dart:developer';

log(
  'Your message text',
  time: DateTime.now(),           // → viewer timestamp decoration
  sequenceNumber: counter,        // → viewer counter decoration
  level: 900,                     // → viewer severity classification
  stackTrace: trace,              // → collapsible stack group in viewer
  error: exception,               // → error metadata
);
```

Prefer these parameters over embedding the same information in the message string.

| Data | Put in message text? | Put in `log()` parameter? |
|------|:-------------------:|:------------------------:|
| Message content | Yes | — |
| Timestamp | No | `time:` |
| Counter/sequence | No | `sequenceNumber:` |
| Severity level | No | `level:` |
| Stack trace (errors) | 1-2 frames for context | Full trace via `stackTrace:` |
| Stack trace (info) | 0-1 frames | No |
| Source tag (e.g. `[MyLib]`) | Yes | — |

### Keep stack frames short for non-errors

Every stack frame line in the message text becomes a separate line in the
capture file. A 6-frame stack on every info log produces 7 lines per call.

Suggested frame counts by severity:

| Level | Frames in message text | `stackTrace:` parameter |
|-------|:---------------------:|:----------------------:|
| Error | 1-2 (quick context) | Full trace |
| Warning | 1-2 (quick context) | Full trace |
| Info | 1 | — |
| Debug/trace | 0-1 | — |

### Use bracket source tags for libraries

If your library logs via `dart:developer`, prefix messages with a short bracket
tag. Saropa Log Capture parses these as **source tags** and lets users filter
by them independently.

```dart
log('[MyLib] Connection established');
log('[DB] Query completed in 42ms');
```

Good tags are short (3-8 chars), consistent, and unique per library/subsystem.

### Avoid duplicating viewer decorations

Do not embed these in message text — the viewer provides them:

- Emoji severity indicators (the viewer has a color-coded severity bar)
- Timestamps (the viewer has configurable timestamp display)
- Counters (the viewer has sequential line numbering)
- Platform name (visible in the session header)

If your logger has toggle flags for these, keep them **off** when using
Saropa Log Capture.

### ANSI color codes

Saropa Log Capture preserves ANSI escape sequences in the log file but strips
them for display in the viewer. They are harmless but add byte overhead.
Consider disabling them if log file size is a concern.

---

## Stack frame format compatibility

Saropa Log Capture auto-detects stack frames and groups them with their parent
log line. The following formats are recognized:

| Format | Example | Detected? |
|--------|---------|:---------:|
| JS/Node | `    at Function.foo (file.js:1:2)` | Yes |
| Dart native | `#0  ClassName.method (file.dart:1:2)` | Yes |
| Python | `  File "foo.py", line 1` | Yes |
| Package path (start of line) | `package:foo/bar.dart:1:2` | Yes |
| Generic `member path:line` | `  pkg.Func:123` | Yes |
| Mid-line `package:` path | `⠀ » Foo.bar package:x/y.dart:1:2` | Yes |
| Mid-line `(./lib/)` path | `⠀ » Foo.bar (./lib/x.dart:1:2)` | Yes |

If your stack frames use a non-standard prefix, they may not be grouped.
Standard Dart `StackTrace.toString()` format and the `stack_trace` package's
`Trace` format are recommended.

---

## Multi-line messages

The debug adapter splits multi-line `log()` output at each `\n` into separate
DAP events. Each event gets its own timestamp and category in the capture file.
This means:

- A single `log('line1\nline2\nline3')` produces 3 independent lines
- Each line is classified separately (stack frame detection, severity, filters)
- Lines may not be visually grouped unless they match continuation heuristics

To keep multi-line output grouped:

1. Use the `stackTrace:` parameter for stack traces (structured, collapsible)
2. Minimize `\n` in message text — prefer single-line messages
3. If multi-line output is unavoidable, ensure lines share the same timestamp
   so continuation grouping can apply
