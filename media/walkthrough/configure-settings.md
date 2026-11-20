# Customize Settings

Fine-tune the extension to match your workflow.

## Key Settings

### Watch Patterns
```json
"saropaCapture.watchPatterns": [
  { "keyword": "error", "alert": "flash" },
  { "keyword": "/api.*failed/i", "alert": "badge" }
]
```

### Highlight Rules
```json
"saropaCapture.highlightRules": [
  { "pattern": "/TODO/i", "color": "#ffcc00", "bold": true }
]
```

### Exclusions
```json
"saropaCapture.exclusions": [
  "verbose:",
  "/^\\[DEBUG\\]/i"
]
```

### Auto-Split Rules
```json
"saropaCapture.splitRules": {
  "maxLines": 50000,
  "maxSizeKB": 5000,
  "keywords": ["HOT RESTART"]
}
```

## More Options

- `logDirectory` - Change output folder
- `maxLogFiles` - Retention limit
- `showElapsedTime` - Show timing between lines
- `autoTagRules` - Auto-tag logs by content
