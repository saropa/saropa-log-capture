# Examples (manual / QA)

This folder holds **sample inputs** for manual verification. The Saropa Log Capture extension is a **VS Code** TypeScript project — there is no Dart `pubspec` or `analysis_options.yaml` here.

## Drift N+1 detector (`DB_07`)

Paste lines from `drift-n-plus-one-sample-lines.txt` into a capture or open them in the log viewer to exercise the heuristic (burst of `Drift: Sent … with args …` with varying IDs).

## Slow query burst markers (`DB_08`)

Paste lines from `drift-slow-burst-sample-lines.txt` (with `[+Nms]` elapsed on each `database` line) to exercise the slow-burst marker and click-to-scroll anchor. Lines that stay under the configured slow threshold must **not** produce a burst.

## Root-cause hypotheses strip (`DB_14`)

See `root-cause-hypotheses-sample.txt` for expected UI behavior, false-negative/weak-session checks, and pointers to unit tests. There is no `analysis_options_template.yaml` in this repository (VS Code / TypeScript project).
