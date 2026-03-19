# Plan: Noise Learning

**Feature:** Learn from user interactions (dismissals, filters) to suggest exclusion rules and reduce log noise over time.

**Context (Insights):** Investigations, Recurring errors, and cross-session data are unified in the **Insights panel** (lightbulb icon): Active Cases, Recurring errors, Frequently modified files, Environment, Performance. Suggestion UI (e.g. "Review filter suggestions") can live in the Insights panel (e.g. a collapsible "Filter suggestions" section or a prompt that opens the suggestions panel) or as a notification that opens the dedicated suggestions panel. Export summary and recurring triage already run from Insights.

**Depends on:** Cohesion features (Timeline, Insights panel including Cases and Recurring, Context Popover).

---

## What exists

- Exclusion rules: manual patterns to hide lines
- Filter presets: saved filter combinations
- "Add to Exclusions" context menu item
- App-only mode and category filters
- Framework line detection (fw flag)

## What's missing

1. **Interaction tracking**: Record when users dismiss/filter/skip lines
2. **Pattern extraction**: Identify common patterns in dismissed lines
3. **Rule suggestions**: Suggest exclusion rules based on patterns
4. **Learning storage**: Persist learning across sessions
5. **Feedback loop**: Let users accept/reject suggestions to improve accuracy

---

## Sub-features

### 1. Interaction Tracking

**Data structure:**

Create `src/modules/learning/interaction-types.ts`:

```typescript
interface UserInteraction {
    timestamp: number;
    type: InteractionType;
    lineText: string;
    lineLevel: string;
    context?: {
        sessionId: string;
        projectName: string;
        debugAdapter: string;
    };
}

type InteractionType =
    | 'dismiss'           // User collapsed/hid a line or group
    | 'filter-out'        // Used level filter to hide this type
    | 'add-exclusion'     // Explicitly added to exclusions
    | 'skip-scroll'       // Scrolled past quickly without stopping
    | 'never-click'       // Line visible but never interacted with
    | 'explicit-keep';    // User pinned or bookmarked (opposite signal)

interface InteractionBatch {
    interactions: UserInteraction[];
    sessionId: string;
    batchedAt: number;
}
```

**Tracking implementation:**

Create `src/modules/learning/interaction-tracker.ts`:

```typescript
class InteractionTracker {
    private buffer: UserInteraction[] = [];
    private readonly maxBuffer = 1000;
    
    /** Track a user interaction. */
    track(interaction: Omit<UserInteraction, 'timestamp'>): void {
        this.buffer.push({
            ...interaction,
            timestamp: Date.now()
        });
        
        if (this.buffer.length >= this.maxBuffer) {
            this.flush();
        }
    }
    
    /** Flush buffer to storage for pattern analysis. */
    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        
        const batch: InteractionBatch = {
            interactions: [...this.buffer],
            sessionId: getCurrentSessionId(),
            batchedAt: Date.now()
        };
        
        await learningStore.saveBatch(batch);
        this.buffer = [];
    }
    
    /** Track from viewer script via message. */
    handleViewerMessage(msg: { type: 'trackInteraction'; data: unknown }): void {
        // Parse and validate, then track
    }
}
```

**Viewer integration:**

Track interactions in webview script:

```javascript
// Track when user collapses a stack group
function onStackCollapse(groupId) {
    const lines = getGroupLines(groupId);
    lines.forEach(line => {
        vscodeApi.postMessage({
            type: 'trackInteraction',
            interactionType: 'dismiss',
            lineText: line.text,
            lineLevel: line.level
        });
    });
}

// Track scroll behavior (simplified)
let lastScrollTime = 0;
let lastScrollPosition = 0;
viewport.addEventListener('scroll', debounce(() => {
    const now = Date.now();
    const scrollSpeed = Math.abs(viewport.scrollTop - lastScrollPosition) / (now - lastScrollTime);
    
    if (scrollSpeed > FAST_SCROLL_THRESHOLD) {
        // User scrolling fast = skipping content
        const visibleLines = getVisibleLines();
        visibleLines.forEach(line => {
            vscodeApi.postMessage({
                type: 'trackInteraction',
                interactionType: 'skip-scroll',
                lineText: line.text.substring(0, 100),  // Truncate for privacy
                lineLevel: line.level
            });
        });
    }
    
    lastScrollTime = now;
    lastScrollPosition = viewport.scrollTop;
}, 500));
```

### 2. Pattern Extraction

**Implementation:**

Create `src/modules/learning/pattern-extractor.ts`:

```typescript
interface ExtractedPattern {
    pattern: string;           // Regex or glob pattern
    confidence: number;        // 0-1
    matchCount: number;        // How many dismissed lines it matches
    sampleLines: string[];     // Example lines (for user review)
    category: 'noise' | 'framework' | 'verbose' | 'repetitive';
}

async function extractPatterns(
    interactions: UserInteraction[],
    minConfidence: number = 0.7
): Promise<ExtractedPattern[]> {
    // 1. Group dismissed lines
    const dismissed = interactions.filter(i => 
        i.type === 'dismiss' || i.type === 'filter-out' || i.type === 'add-exclusion'
    );
    
    // 2. Extract common prefixes
    const prefixPatterns = extractCommonPrefixes(dismissed.map(d => d.lineText));
    
    // 3. Extract common substrings (for framework noise)
    const substringPatterns = extractCommonSubstrings(dismissed.map(d => d.lineText));
    
    // 4. Identify repetitive patterns (same line appearing multiple times)
    const repetitivePatterns = extractRepetitive(dismissed);
    
    // 5. Identify level-based patterns (e.g., always hide DEBUG)
    const levelPatterns = extractLevelPatterns(dismissed);
    
    // 6. Combine and deduplicate
    const allPatterns = [...prefixPatterns, ...substringPatterns, ...repetitivePatterns, ...levelPatterns];
    
    // 7. Filter by confidence
    return allPatterns.filter(p => p.confidence >= minConfidence);
}

function extractCommonPrefixes(lines: string[]): ExtractedPattern[] {
    // Use trie or suffix tree to find common prefixes
    // e.g., "[flutter] " appears in 80% of dismissed lines → suggest "^\\[flutter\\] "
}

function extractCommonSubstrings(lines: string[]): ExtractedPattern[] {
    // Find substrings that appear frequently
    // e.g., "at Object.<anonymous>" in stack traces
}

function extractRepetitive(interactions: UserInteraction[]): ExtractedPattern[] {
    // Find exact duplicates or near-duplicates
    // e.g., "Recompiling because main.dart has changed" appears 50 times
}
```

### 3. Rule Suggestions

**Implementation:**

Create `src/modules/learning/suggestion-engine.ts`:

```typescript
interface RuleSuggestion {
    id: string;
    pattern: string;
    description: string;
    impact: {
        linesAffected: number;
        percentageReduction: number;
    };
    confidence: number;
    status: 'pending' | 'accepted' | 'rejected';
}

class SuggestionEngine {
    /** Generate suggestions from patterns. */
    async generateSuggestions(): Promise<RuleSuggestion[]> {
        const batches = await learningStore.loadRecentBatches(30); // Last 30 days
        const interactions = batches.flatMap(b => b.interactions);
        
        const patterns = await extractPatterns(interactions);
        
        return patterns.map(p => ({
            id: generateId(),
            pattern: p.pattern,
            description: this.describePattern(p),
            impact: this.calculateImpact(p),
            confidence: p.confidence,
            status: 'pending'
        }));
    }
    
    private describePattern(p: ExtractedPattern): string {
        switch (p.category) {
            case 'framework':
                return `Hide framework/library messages matching "${p.pattern}"`;
            case 'verbose':
                return `Hide verbose logging matching "${p.pattern}"`;
            case 'repetitive':
                return `Hide repetitive messages like "${p.sampleLines[0]?.substring(0, 50)}..."`;
            default:
                return `Hide lines matching "${p.pattern}"`;
        }
    }
    
    private calculateImpact(p: ExtractedPattern): { linesAffected: number; percentageReduction: number } {
        // Estimate how many lines would be hidden
        // This requires scanning a sample of recent logs
    }
}
```

### 4. Suggestion UI

**Implementation:**

Add suggestion notification and panel:

```typescript
// Show suggestion notification when good suggestions available
async function checkAndShowSuggestions(): Promise<void> {
    const suggestions = await suggestionEngine.generateSuggestions();
    const pending = suggestions.filter(s => s.status === 'pending' && s.confidence > 0.8);
    
    if (pending.length > 0) {
        const result = await vscode.window.showInformationMessage(
            `Saropa has ${pending.length} filter suggestion(s) based on your usage.`,
            'Review',
            'Dismiss'
        );
        
        if (result === 'Review') {
            showSuggestionsPanel(pending);
        }
    }
}
```

**Suggestions panel:** (Can be a section within the Insights panel or a dedicated panel opened from Insights/notification.)

Create `src/ui/panels/suggestions-panel.ts` (or implement as an Insights panel section):

```
┌─────────────────────────────────────────────────────────────────┐
│ Filter Suggestions                                          [×] │
├─────────────────────────────────────────────────────────────────┤
│ Based on your usage, we suggest these filters:                  │
│                                                                 │
│ ☐ Hide Flutter framework messages                              │
│   Pattern: ^\[flutter\]                                        │
│   Would hide ~120 lines (15% reduction)                        │
│   Sample: "[flutter] Another exception was thrown..."          │
│   [Accept] [Reject] [Preview]                                   │
│                                                                 │
│ ☐ Hide repetitive recompile messages                           │
│   Pattern: Recompiling because.*has changed                    │
│   Would hide ~45 lines (5% reduction)                          │
│   Sample: "Recompiling because main.dart has changed"          │
│   [Accept] [Reject] [Preview]                                   │
├─────────────────────────────────────────────────────────────────┤
│ [Accept All] [Clear Suggestions]                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Learning Storage

**Implementation:**

Create `src/modules/learning/learning-store.ts`:

```typescript
class LearningStore {
    private readonly storageKey = 'saropaLogCapture.learning';
    
    async saveBatch(batch: InteractionBatch): Promise<void> {
        const data = await this.loadAll();
        data.batches.push(batch);
        
        // Keep only last 90 days
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        data.batches = data.batches.filter(b => b.batchedAt > cutoff);
        
        await this.saveAll(data);
    }
    
    async loadRecentBatches(days: number): Promise<InteractionBatch[]> {
        const data = await this.loadAll();
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return data.batches.filter(b => b.batchedAt > cutoff);
    }
    
    async saveSuggestionFeedback(
        suggestionId: string, 
        accepted: boolean
    ): Promise<void> {
        const data = await this.loadAll();
        data.feedback[suggestionId] = { accepted, timestamp: Date.now() };
        await this.saveAll(data);
    }
    
    private async loadAll(): Promise<LearningData> {
        // Use globalState for persistence across workspaces
        // Or .saropa/learning.json for workspace-specific
    }
}
```

### 6. Configuration

**Settings:**

```json
{
    "saropaLogCapture.learning.enabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable noise learning from your interactions"
    },
    "saropaLogCapture.learning.trackScrollBehavior": {
        "type": "boolean",
        "default": false,
        "description": "Track fast scrolling as a dismissal signal (more learning, more tracking)"
    },
    "saropaLogCapture.learning.suggestionFrequency": {
        "type": "string",
        "enum": ["never", "weekly", "daily"],
        "default": "weekly",
        "description": "How often to show filter suggestions"
    },
    "saropaLogCapture.learning.minConfidence": {
        "type": "number",
        "default": 0.8,
        "minimum": 0.5,
        "maximum": 1.0,
        "description": "Minimum confidence for suggestions"
    }
}
```

### 7. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/learning/interaction-types.ts` | New: data model |
| `src/modules/learning/interaction-tracker.ts` | New: track interactions |
| `src/modules/learning/pattern-extractor.ts` | New: extract patterns |
| `src/modules/learning/suggestion-engine.ts` | New: generate suggestions |
| `src/modules/learning/learning-store.ts` | New: persist learning data |
| `src/ui/panels/suggestions-panel.ts` | New: suggestions UI |
| `src/ui/viewer/viewer-script.ts` | Track scroll/dismiss interactions |
| `src/ui/provider/viewer-message-handler.ts` | Handle tracking messages |
| `package.json` | Add settings |
| `l10n.ts` + bundles | Add localization strings |

---

## Phases

### Phase 1: Interaction tracking
- Track explicit actions (add exclusion, filter level)
- Store in learning store
- Basic analytics (count by type)

### Phase 2: Pattern extraction
- Common prefix extraction
- Repetitive line detection
- Framework noise detection

### Phase 3: Suggestions
- Generate suggestions from patterns
- Suggestion notification
- Accept/reject feedback

### Phase 4: Advanced learning
- Scroll behavior tracking (opt-in)
- Confidence adjustment from feedback
- Project-specific vs. global patterns

---

## Considerations

- **Privacy**: Only store pattern summaries, not full line content. Make tracking opt-out.
- **Storage**: Learning data can grow. Implement retention (90 days) and compression.
- **False positives**: Start conservative. High confidence threshold (0.8) initially.
- **User control**: Easy to disable, clear data, and review what's tracked.
- **Cross-project**: Some patterns are universal (framework noise), some are project-specific.
- **Performance**: Pattern extraction is CPU-intensive. Run in background, throttle.

---

## Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 2-3 days | None |
| Phase 2 | 3-4 days | Phase 1 |
| Phase 3 | 2-3 days | Phase 2 |
| Phase 4 | 3-4 days | Phase 3 + usage data |
| **Total** | **10-14 days** | |

---

## Context from Cohesion Index (019)

### Problems this solves

| # | Problem | Current State |
|---|---------|---------------|
| 1 | **No Unified Timeline** | Debug Console, terminal, integrations viewed separately |
| 4 | **Search Is Siloed** | Find-in-files only searches logs, not sidecars |

### Shared infrastructure

| Component | Used by | Location |
|-----------|---------|----------|
| Interaction tracker | Noise Learning | `src/modules/learning/interaction-tracker.ts` |

### Recommended order

This is Phase 6 of the intelligence tier, after Auto-Correlation (Phase 5). Requires Tier 6 (Cohesion) as foundation. The unified Insights panel (Plan 041) is in place: Cases, Recurring, Hot files, Environment, and Performance live in one panel; filter suggestions can integrate there (e.g. section or entry point) or via a dedicated suggestions panel opened from a notification.

### Target metrics

| Metric | Target |
|--------|--------|
| Suggested filters accepted | 60%+ acceptance rate |

### Completed sibling plans

| # | Plan | Status |
|---|------|--------|
| [023](history/20260313/023_plan-ai-explain-error.md) | AI Explain Error | Complete |
| [024](history/20260312/024_plan-auto-correlation.md) | Auto-Correlation | Complete |
| [026](history/20260313/026_plan-share-investigation.md) | Share Investigation | Complete |

---

## Success Criteria

1. User dismisses Flutter framework lines multiple times
2. After a week, suggestion appears: "Hide Flutter framework messages"
3. User accepts → pattern added to exclusions
4. Future sessions have less noise automatically
5. User can review and clear learning data
