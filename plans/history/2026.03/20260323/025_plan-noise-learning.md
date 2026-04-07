# Plan: Noise Learning

**Status: IMPLEMENTED (2026-03-23).** MVP shipped: `src/modules/learning/` (store, tracker, pattern extract, suggestion engine), webview `trackInteraction` + `setLearningOptions`, commands and `saropaLogCapture.learning.*` settings, QuickPick review, deferred notification with frequency cooldown. Follow-up: Insights panel section, richer filter-out tracking, optional global aggregates (Phase 4). Developer overview: `src/modules/learning/README.md`. QA: `examples/noise-learning-sample-interactions.txt`.

---

**Feature:** Learn from user interactions (dismissals, filters) to suggest exclusion rules and reduce log noise over time.

**Context (Insights):** Investigations, Recurring errors, and cross-session data are unified in the **Insights panel** (lightbulb icon): Active Cases, Recurring errors, Frequently modified files, Environment, Performance. Suggestion UI (e.g. "Review filter suggestions") can live in the Insights panel (e.g. a collapsible "Filter suggestions" section or a prompt that opens the suggestions panel) or as a notification that opens the dedicated suggestions panel. Export summary and recurring triage already run from Insights.

**Depends on:** Cohesion features (Timeline, Insights panel including Cases and Recurring, Context Popover).

---

## What exists

- Exclusion rules: manual patterns to hide lines
- Filter presets: saved filter combinations
- "Add to Exclusions" context menu item
- App-only mode and category filters
- Framework line detection (`fw` on stack lines, plus optional visual deemphasis via framework levels — separate from **text** exclusions)
- Exclusion engine: `src/modules/features/exclusion-matcher.ts` — plain string (case-insensitive substring) or `/regex/flags`; patterns must parse with `parseExclusionPattern`
- Webview already posts `addToExclusion` with `text` (see `viewer-context-menu-actions.ts`); extension handles it in `viewer-message-handler-actions.ts`

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
    /** Raw log line text (local-only persistence). Truncate at ingest if `maxStoredLineLength` is set. */
    lineText: string;
    lineLevel: string;
    context?: {
        sessionId: string;
        projectName: string;
        debugAdapter: string;
    };
}

/** Webview postMessage ↔ extension handler contract (export from this module). */
export type TrackInteractionMessage = {
    type: 'trackInteraction';
    interactionType: InteractionType;
    lineText: string;
    lineLevel: string;
    context?: UserInteraction['context'];
};

type InteractionType =
    | 'dismiss'           // User collapsed/hid a line or group
    | 'filter-out'        // Used level filter to hide this type
    | 'add-exclusion'     // Explicitly added to exclusions (correlate with addToExclusion / settings)
    | 'skip-scroll'       // Opt-in: fast scroll treated as low-confidence negative signal
    | 'explicit-keep';    // User pinned / bookmarked a line (opposite signal; wire when pin events exist)

/** Deferred / research only — not in v1: inferring noise from absence of clicks is too noisy. */
type _FutureInteractionType = 'never-click';

interface InteractionBatch {
    interactions: UserInteraction[];
    sessionId: string;
    batchedAt: number;
}
```

**Tracking implementation:**

Create `src/modules/learning/interaction-tracker.ts`:

```typescript
import type { InteractionBatch, TrackInteractionMessage, UserInteraction } from './interaction-types';

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
    
    /** Track from webview: validate against TrackInteractionMessage (interaction-types.ts). */
    handleViewerMessage(msg: TrackInteractionMessage): void {
        if (msg.type !== 'trackInteraction') return;
        const { interactionType, lineText, lineLevel, context } = msg;
        // Validate interactionType, non-empty lineText, optional max length (Privacy)
        this.track({ type: interactionType, lineText, lineLevel, context });
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
        // Shape must match TrackInteractionMessage (see interaction-types.ts)
    });
}

// Track scroll behavior (simplified) — only when saropaLogCapture.learning.trackScrollBehavior is true
let lastScrollTime = 0;
let lastScrollPosition = 0;
viewport.addEventListener('scroll', debounce(() => {
    const now = Date.now();
    const scrollSpeed = Math.abs(viewport.scrollTop - lastScrollPosition) / (now - lastScrollTime);
    
    if (scrollSpeed > FAST_SCROLL_THRESHOLD) {
        // User scrolling fast = weak "skip" signal — must not flood the buffer:
        // dedupe by line index per scroll burst, cap messages per second, cooldown between bursts.
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
    /** Must be a valid `saropaLogCapture.exclusions` entry: plain substring or `/regex/flags` per `parseExclusionPattern`. */
    pattern: string;
    confidence: number;        // 0-1
    matchCount: number;        // How many dismissed lines it matches
    sampleLines: string[];     // Example lines (for user review)
    category: 'noise' | 'framework' | 'verbose' | 'repetitive';
}

async function extractPatterns(
    interactions: UserInteraction[],
    minConfidence: number = 0.7
): Promise<ExtractedPattern[]> {
    // import { parseExclusionPattern } from '../features/exclusion-matcher';

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
    
    // 7. Drop patterns that do not parse as exclusion rules
    const valid = allPatterns.filter(p => parseExclusionPattern(p.pattern));

    // 8. Filter by confidence
    return valid.filter(p => p.confidence >= minConfidence);
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
        // Bounded scan of lines already held for the active viewer session in the extension host
        // (same logical buffer used when applying exclusions — no arbitrary disk reads).
        // Cap work: e.g. last N lines (tune N) or current session only; run async/off the UI thread if needed.
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

**Persistence note:** `generateSuggestions()` always returns `status: 'pending'` in the sketch above. For real UX, persist suggestion rows (id, pattern, status, confidence) in `LearningData` so accept/reject survives reloads and the notification path does not re-prompt for the same pattern every time.

**Suggestions panel:** (Can be a section within the Insights panel or a dedicated panel opened from Insights/notification.)

Create `src/ui/panels/suggestions-panel.ts` (or implement as an Insights panel section):

```
┌─────────────────────────────────────────────────────────────────┐
│ Filter Suggestions                                          [×] │
├─────────────────────────────────────────────────────────────────┤
│ Based on your usage, we suggest these filters:                  │
│                                                                 │
│ ☐ Hide Flutter framework messages                              │
│   Pattern: /^\[flutter\]/                                      │
│   Would hide ~120 lines (15% reduction)                        │
│   Sample: "[flutter] Another exception was thrown..."          │
│   [Accept] [Reject] [Preview]                                   │
│                                                                 │
│ ☐ Hide repetitive recompile messages                           │
│   Pattern: /Recompiling because.*has changed/                  │
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
        // Default: VS Code workspaceState (key `saropaLogCapture.learning`) — learning stays with the repo / sensitive logs.
        // Phase 4 (optional): merge or promote only high-confidence, non-sensitive pattern aggregates via globalState
        // for cross-workspace framework-style noise (explicit user opt-in).
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
    },
    "saropaLogCapture.learning.maxStoredLineLength": {
        "type": "number",
        "default": 2000,
        "minimum": 80,
        "maximum": 10000,
        "description": "Max characters of each log line stored for learning (local only)"
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
| `src/ui/viewer/viewer-script.ts` (and other embedded viewer scripts as needed) | Track scroll/dismiss; post `trackInteraction` |
| `src/ui/provider/viewer-message-handler-actions.ts` (+ `viewer-handler-wiring.ts` if new case) | Dispatch `trackInteraction` to `InteractionTracker` |
| `src/ui/viewer-context-menu/viewer-context-menu-actions.ts` (or exclusion handler) | On `addToExclusion`, also record `add-exclusion` learning event in extension host |
| `package.json` | Add settings |
| `l10n.ts` + bundles | Add localization strings |

---

## Phases

### Phase 1: Interaction tracking
- Track explicit actions: level/filter changes, stack/group dismiss, and **`addToExclusion` in the extension** (same path as `viewer-message-handler-actions.ts`, not only webview messages)
- Store batches in `workspaceState` via learning store
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
- Scroll behavior tracking (opt-in), with dedupe/caps as specified above
- Confidence adjustment from accept/reject feedback
- Optional global aggregates (opt-in) vs. default workspace-scoped storage

---

## Considerations

- **Privacy**: Learning is **local-only** (VS Code storage); nothing is uploaded by this feature. Persisted batches contain **line text** (truncated by `maxStoredLineLength`) because pattern extraction needs samples — do not claim “summaries only.” Mitigations: users can turn off `saropaLogCapture.learning.enabled`, run **clear learning data**, and read Settings copy that states what is stored. Suggestion UI may show shorter previews than stored length.
- **Storage**: Batches can get large (especially before scroll deduping). Retention: 90 days; cap batch size or interaction count per flush; optional compression of cold batches if needed.
- **False positives**: Start conservative; default `minConfidence` 0.8; weight `skip-scroll` lower than explicit dismiss / add-exclusion.
- **User control**: Disable learning, clear data, review pending suggestions before any exclusion is applied.
- **Cross-project**: Default **workspace-scoped** storage. Optional Phase 4: opt-in global aggregates for generic framework noise only.
- **Performance**: Pattern extraction is CPU-heavy — run when idle, on a schedule aligned with `suggestionFrequency`, or after flush; never block the UI thread.
- **Overlap with `fw` / framework UI**: Stack `fw` tagging and framework level deemphasis stay as-is; learning proposes **exclusion patterns on line text**, not replacements for stack classification.

## Testing and observability

- Unit tests: prefix/substring/repetition extractors, `parseExclusionPattern` rejection of bad suggestions, confidence thresholds.
- Integration: accept suggestion → `saropaLogCapture.exclusions` updated and lines hidden in viewer.
- Optional internal counters: suggestions shown / accepted / rejected (local only) to validate the 60%+ acceptance target.

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
