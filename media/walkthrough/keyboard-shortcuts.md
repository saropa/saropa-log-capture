# Keyboard Shortcuts

Master these shortcuts to work faster with your logs.

## Navigation

| Key | Action |
|-----|--------|
| **Space** | Pause/resume capture |
| **Home** | Jump to start |
| **End** | Jump to end |

## Search

| Key | Action |
|-----|--------|
| **Ctrl+F** | Open search bar |
| **F3** | Next match |
| **Shift+F3** | Previous match |
| **Escape** | Close search |

## Actions

<!-- Kept in sync with the shipped defaults in src/ui/viewer/viewer-keybindings.ts and the
     F1 shortcuts panel (src/ui/viewer-panels/viewer-keyboard-shortcuts-html.ts). "A" used to
     read "Toggle app-only stack frames" — that action was replaced by the three-way device
     log cycle; verify against those files before editing this table again. -->
| Key | Action |
|-----|--------|
| **M** | Insert timestamp marker |
| **P** | Pin/unpin current line |
| **N** | Add note to current line |
| **Ctrl+B** | Bookmark current line |
| **W** | Toggle word wrap |
| **A** | Cycle device logs (None / Warn+ / All) |

## Copy

| Key | Action |
|-----|--------|
| **Shift+Click** | Select multiple lines |
| **Shift+Down / Shift+Up** | Extend selection ±1 line (crosses the anchor to invert direction) |
| **Shift+PageDown / Shift+PageUp** | Extend selection by one viewport |
| **Ctrl+Shift+End / Ctrl+Shift+Home** | Extend selection to the last / first line |
| **Ctrl+C** | Copy as JSON |
| **Ctrl+Shift+C** | Copy as markdown |

See **F1** in the Log Viewer for the complete, always-current shortcut reference.
