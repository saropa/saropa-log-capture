# Rename: Investigation → Collection

## Terminology Dictionary

| Old Term | New Term | Scope |
|----------|----------|-------|
| `Investigation` | `Collection` | types, classes, interfaces |
| `investigation` | `collection` | variables, params, properties |
| `investigations` | `collections` | plurals everywhere |
| `InvestigationStore` | `CollectionStore` | class name |
| `investigationStore` | `collectionStore` | variable name |
| `InvestigationSource` | `CollectionSource` | interface |
| `InvestigationsFile` | `CollectionsFile` | interface |
| `CreateInvestigationInput` | `CreateCollectionInput` | interface |
| `InvestigationSearchResult` | `CollectionSearchResult` | interface |
| `SourceSearchResult` | `SourceSearchResult` | unchanged |
| `SearchOptions` | `SearchOptions` | unchanged |
| `SearchMatch` | `SearchMatch` | unchanged |
| `Your cases` | `Collections` | UI heading |
| `cases` (in element IDs) | `collections` | HTML IDs |
| `Create Investigation` | `Create Collection` | button text |
| `Add to Investigation` | `Add to Collection` | command title |

## Command ID Renames (package.json)

| Old Command ID | New Command ID |
|----------------|----------------|
| `saropaLogCapture.createInvestigation` | `saropaLogCapture.createCollection` |
| `saropaLogCapture.openInvestigation` | `saropaLogCapture.openCollection` |
| `saropaLogCapture.closeInvestigation` | `saropaLogCapture.closeCollection` |
| `saropaLogCapture.switchInvestigation` | `saropaLogCapture.switchCollection` |
| `saropaLogCapture.addToInvestigation` | `saropaLogCapture.addToCollection` |
| `saropaLogCapture.removeFromInvestigation` | `saropaLogCapture.removeFromCollection` |
| `saropaLogCapture.exportInvestigation` | `saropaLogCapture.exportCollection` |
| `saropaLogCapture.shareInvestigation` | `saropaLogCapture.shareCollection` |
| `saropaLogCapture.deleteInvestigation` | `saropaLogCapture.deleteCollection` |
| `saropaLogCapture.newInvestigationFromSessions` | `saropaLogCapture.newCollectionFromSessions` |

## File Renames

### modules/investigation/ → modules/collection/
| Old | New |
|-----|-----|
| `investigation-types.ts` | `collection-types.ts` |
| `investigation-store.ts` | `collection-store.ts` |
| `investigation-store-io.ts` | `collection-store-io.ts` |
| `investigation-store-workspace.ts` | `collection-store-workspace.ts` |
| `investigation-search.ts` | `collection-search.ts` |
| `investigation-search-file.ts` | `collection-search-file.ts` |

### ui/investigation/ → ui/collection/
| Old | New |
|-----|-----|
| `investigation-panel.ts` | `collection-panel.ts` |
| `investigation-panel-html.ts` | `collection-panel-html.ts` |
| `investigation-panel-script.ts` | `collection-panel-script.ts` |
| `investigation-panel-styles.ts` | `collection-panel-styles.ts` |
| `investigation-panel-handlers.ts` | `collection-panel-handlers.ts` |

### Root src/
| Old | New |
|-----|-----|
| `commands-investigation.ts` | `commands-collection.ts` |
| `commands-investigation-lints.ts` | `commands-collection-lints.ts` |
| `investigation-commands-helpers.ts` | `collection-commands-helpers.ts` |
| `investigation-commands-export.ts` | `collection-commands-export.ts` |
| `investigation-commands-share.ts` | `collection-commands-share.ts` |

### Other
| Old | New |
|-----|-----|
| `viewer-message-handler-investigation.ts` | `viewer-message-handler-collection.ts` |
| `viewer-session-panel-investigations.ts` | `viewer-session-panel-collections.ts` |
| `slc-investigation.ts` | `slc-collection.ts` |

## L10n Key Renames

All keys containing `investigation` or `Investigation` rename to `collection`/`Collection`.
All keys containing `cases`/`yourCases` rename to `collections`.

## UI Changes

1. Remove "Your cases" section from signal panel entirely
2. Create standalone Collections webview panel (icon bar access)
3. Add "Add to Collection" context menu in session list
4. Auto-generate collection name from filename
5. Support renaming collections
6. Support merging two collections
7. Add explanatory help text in collections panel
