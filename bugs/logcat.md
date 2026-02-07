# Android Logcat Log Levels

## Overview

Android's logging system (`android.util.Log`) defines six priority levels.
Each logcat line begins with a single-letter tag indicating its level.

## Log Levels

| Level | Letter | Constant         | Description                                                                 |
|-------|--------|------------------|-----------------------------------------------------------------------------|
| Verbose | `V`  | `Log.v()`        | Most granular output. Typically used during active development only.         |
| Debug   | `D`  | `Log.d()`        | Diagnostic information useful during debugging. Not present in release apps. |
| Info    | `I`  | `Log.i()`        | General operational messages confirming things are working as expected.      |
| Warn    | `W`  | `Log.w()`        | Potentially harmful situations that haven't caused failure yet.             |
| Error   | `E`  | `Log.e()`        | Error events that may still allow the app to continue running.              |
| Fatal   | `F`  | `Log.wtf()`      | Severe errors expected to lead to process termination. "What a Terrible Failure." |

## Logcat Line Format

<level>/<tag>(<pid>): <message>



Example:
E/aropamobile.app(31888): Failed to query component interface for required system resources: 6
│ │                │       └── message
│ │                └── process ID
│ └── tag (set by the code doing the logging, NOT necessarily your app)
└── log level



## Important: The Tag Is Not Always Your App

The **tag** is chosen by whatever code calls `Log.e(...)` — including:
- Android OS frameworks (e.g., `CCodec`, `MediaCodecList`, `scudo`)
- Native libraries linked into your process
- Third-party SDKs (Firebase, AdMob, etc.)

Even when the **PID** matches your app, the message may originate from
system code running inside your process space. The tag tells you who
is actually logging.

## Filtering by Level

Each level includes all levels above it:

| Filter   | Shows                          |
|----------|--------------------------------|
| `*:V`    | Verbose + Debug + Info + Warn + Error + Fatal |
| `*:D`    | Debug + Info + Warn + Error + Fatal            |
| `*:I`    | Info + Warn + Error + Fatal                    |
| `*:W`    | Warn + Error + Fatal                           |
| `*:E`    | Error + Fatal                                  |
| `*:F`    | Fatal only                                     |
| `*:S`    | Silent — suppresses all output for that tag    |

Usage with adb:
adb logcat *:W          # only warnings and above
adb logcat flutter:V *:S  # only Flutter tag, all levels



## Sources

- Android Log class reference:
  https://developer.android.com/reference/android/util/Log

- Logcat command-line tool documentation:
  https://developer.android.com/tools/logcat

- Log.wtf() ("What a Terrible Failure") documentation:
  https://developer.android.com/reference/android/util/Log#wtf(java.lang.String,java.lang.String)