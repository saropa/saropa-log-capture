# Plan: AI "Explain this error"

**Feature:** Right-click any error line → "Explain with AI" → get contextual explanation using VS Code Language Model API.

**Depends on:** Context Popover (Task 100) for gathering surrounding context.

---

## What exists

- VS Code Language Model API (`vscode.lm`) available since VS Code 1.90
- Context Popover gathers integration data around a timestamp
- Error classification identifies critical/transient/bug errors
- Copy with source includes surrounding log lines

## What's missing

1. **AI prompt construction**: Build effective prompt from log context
2. **Context gathering**: Collect relevant data (log lines, stack traces, integration data)
3. **UI integration**: Context menu item, response display
4. **Model selection**: Allow user to choose AI model (Copilot, Claude, etc.)
5. **Response caching**: Avoid repeated API calls for same error

---

## Sub-features

### 1. Context Gathering

**Implementation:**

Create `src/modules/ai/ai-context-builder.ts`:

```typescript
interface AIContext {
    errorLine: string;
    lineIndex: number;
    surroundingLines: string[];   // ±10 lines
    stackTrace?: string;          // Extracted if present
    integrationData?: {
        performance?: { memory: string; cpu: string };
        http?: { url: string; status: number; duration: number }[];
        terminal?: string[];
    };
    sessionInfo: {
        debugAdapter: string;
        project: string;
        timestamp: string;
    };
}

async function buildAIContext(
    logUri: vscode.Uri,
    lineIndex: number,
    lineText: string
): Promise<AIContext> {
    // 1. Read surrounding lines (±10)
    // 2. Extract stack trace if present (look for indented lines, "at " prefix)
    // 3. Load integration data using context-loader (from Context Popover)
    // 4. Load session metadata
    return context;
}
```

### 2. Prompt Construction

**Implementation:**

Create `src/modules/ai/ai-prompt.ts`:

```typescript
function buildExplainErrorPrompt(context: AIContext): string {
    return `You are a debugging assistant. Analyze this error and provide:
1. A brief explanation of what went wrong
2. Likely root cause
3. Suggested fix or next debugging step

Error occurred in ${context.sessionInfo.debugAdapter} project "${context.sessionInfo.project}".

Error line:
${context.errorLine}

${context.stackTrace ? `Stack trace:\n${context.stackTrace}\n` : ''}

Surrounding log context:
${context.surroundingLines.join('\n')}

${context.integrationData ? formatIntegrationData(context.integrationData) : ''}

Provide a concise, actionable response.`;
}

function formatIntegrationData(data: AIContext['integrationData']): string {
    const parts: string[] = [];
    if (data?.performance) {
        parts.push(`System state: Memory ${data.performance.memory}, CPU ${data.performance.cpu}`);
    }
    if (data?.http?.length) {
        parts.push(`Recent HTTP: ${data.http.map(h => `${h.url} → ${h.status}`).join(', ')}`);
    }
    if (data?.terminal?.length) {
        parts.push(`Terminal output: ${data.terminal.join(' | ')}`);
    }
    return parts.length ? `Additional context:\n${parts.join('\n')}` : '';
}
```

### 3. AI Model Integration

**Implementation:**

Create `src/modules/ai/ai-explain.ts`:

```typescript
interface ExplainResult {
    explanation: string;
    model: string;
    tokensUsed?: number;
    cached: boolean;
}

async function explainError(context: AIContext): Promise<ExplainResult> {
    // 1. Check cache first
    const cacheKey = hashContext(context);
    const cached = explanationCache.get(cacheKey);
    if (cached) {
        return { ...cached, cached: true };
    }

    // 2. Get available models
    const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',  // Or allow user preference
        family: 'gpt-4'     // Prefer capable model
    });
    
    if (models.length === 0) {
        throw new Error('No AI model available. Install GitHub Copilot or another LM extension.');
    }
    
    const model = models[0];
    
    // 3. Build and send request
    const prompt = buildExplainErrorPrompt(context);
    const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
    ];
    
    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
    
    // 4. Collect response
    let explanation = '';
    for await (const chunk of response.text) {
        explanation += chunk;
    }
    
    // 5. Cache and return
    const result = { explanation, model: model.name, cached: false };
    explanationCache.set(cacheKey, result);
    return result;
}
```

### 4. UI Integration

**Context menu:**

Add to `viewer-context-menu-html.ts`:

```html
<div class="context-menu-item" data-action="explain-with-ai" data-line-action>
    <span class="codicon codicon-sparkle"></span> Explain with AI
</div>
```

**Response display:**

Options:
- **A: Side panel** — Open a panel showing the explanation
- **B: Inline expansion** — Expand below the error line
- **C: Notification with details** — Quick notification + "Show Details"

Recommended: **A (Side panel)** for full explanation with formatting.

Create `src/ui/panels/ai-explain-panel.ts`:

```typescript
async function showAIExplanation(
    context: AIContext,
    result: ExplainResult
): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'saropaAIExplain',
        'AI Explanation',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    
    panel.webview.html = buildExplanationHtml(context, result);
}
```

### 5. Configuration

**Settings:**

```json
{
    "saropaLogCapture.ai.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable AI-powered error explanation"
    },
    "saropaLogCapture.ai.contextLines": {
        "type": "number",
        "default": 10,
        "description": "Number of surrounding lines to include in AI context"
    },
    "saropaLogCapture.ai.includeIntegrationData": {
        "type": "boolean",
        "default": true,
        "description": "Include performance/HTTP/terminal data in AI context"
    },
    "saropaLogCapture.ai.cacheExplanations": {
        "type": "boolean",
        "default": true,
        "description": "Cache AI explanations to avoid repeated API calls"
    }
}
```

### 6. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/ai/ai-context-builder.ts` | New: gather context for AI |
| `src/modules/ai/ai-prompt.ts` | New: construct prompts |
| `src/modules/ai/ai-explain.ts` | New: call VS Code LM API |
| `src/modules/ai/ai-cache.ts` | New: explanation caching |
| `src/ui/panels/ai-explain-panel.ts` | New: display panel |
| `src/ui/viewer-context-menu/viewer-context-menu-html.ts` | Add menu item |
| `src/ui/viewer-context-menu/viewer-context-menu-actions.ts` | Add action handler |
| `src/ui/provider/viewer-message-handler.ts` | Handle message |
| `package.json` | Add settings, command |
| `l10n.ts` + bundles | Add localization strings |

---

## Phases

### Phase 1: Core integration (MVP)
- Context gathering (error line + surrounding lines)
- Basic prompt construction
- VS Code LM API integration
- Simple notification with response

### Phase 2: Rich context
- Include stack trace extraction
- Add integration data (perf, HTTP)
- Dedicated explanation panel with formatting

### Phase 3: Polish
- Response caching
- Model selection preference
- "Explain selection" for multiple lines
- Copy/share explanation

---

## Considerations

- **Model availability**: User must have Copilot or another LM extension installed. Show helpful message if none available.
- **Cost**: AI calls have cost (tokens). Caching reduces repeated calls.
- **Privacy**: Log content is sent to AI provider. Add opt-out and privacy note.
- **Quality**: Prompt engineering matters. May need iteration based on feedback.
- **Rate limits**: VS Code LM API may have rate limits. Handle gracefully.
- **Offline**: Feature unavailable offline. Indicate clearly.

---

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 2-3 days | Context Popover (for integration data loading) |
| Phase 2 | 2-3 days | Phase 1 |
| Phase 3 | 1-2 days | Phase 2 |
| **Total** | **5-8 days** | |

---

## Success Criteria

1. User right-clicks an error → "Explain with AI" → gets useful explanation
2. Explanation includes root cause and suggested fix
3. Works with Copilot, Claude, and other LM extensions
4. Cached explanations return instantly
5. Graceful handling when no AI model available
