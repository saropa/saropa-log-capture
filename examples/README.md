# Examples (manual / QA)

This folder holds **sample inputs** for manual verification. The Saropa Log Capture extension is a **VS Code** TypeScript project — there is no Dart `pubspec` or `analysis_options.yaml` here.

## Drift N+1 detector (`DB_07`)

Paste lines from `drift-n-plus-one-sample-lines.txt` into a capture or open them in the log viewer to exercise the heuristic (burst of `Drift: Sent … with args …` with varying IDs).
