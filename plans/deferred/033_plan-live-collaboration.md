# Plan: Live collaboration

**Feature:** Share a session so others see the same log and scroll position in real time (multi-user viewing).

---

## What exists

- Share Investigation (Gist, .slc export, deep link import) for async sharing.
- Single-user viewer with scroll position and selection state.
- Session and log data model.

## What's missing

1. **Presence** — Show who else is viewing the same session (e.g. avatars or cursors).
2. **Sync state** — Scroll position, selected line, and optionally selected text synced across participants.
3. **Real-time transport** — Backend or P2P channel (e.g. WebSocket, VS Code Live Share, or existing collaboration API) to broadcast state.
4. **Invitation** — Way to invite others to join a "live" view (link or room id); they open and connect.

## Implementation

### 1. State to sync

- Minimal: scroll offset (or line index), session/log URI.
- Extended: selection (start/end line), follow mode (follow host’s scroll).

### 2. Transport options

- **VS Code Live Share** — If available, use Live Share’s shared services or follow-me; may limit to "follow host" only.
- **Custom backend** — Small service (e.g. WebSocket) that relays position/selection; requires auth and deployment.
- **P2P** — WebRTC or similar; complex; may not fit extension model.

### 3. UI

- "Start live view" / "Join live view" command; show list of participants and "Follow" toggle.
- Optional cursor/position indicators in margin (e.g. colored line or avatar at other users’ scroll position).

### 4. Scope

- MVP: same-workspace only (e.g. Live Share) so no backend; "follow host" scroll sync. Later: multi-workspace with backend.

## Files to create/modify

| File | Change |
|------|--------|
| New: collaboration state manager | Track local + remote scroll/selection; emit/receive updates |
| New: transport adapter (Live Share or WebSocket client) | Send/receive state |
| Viewer | Subscribe to state; update scroll/selection; optional presence UI |
| Commands | Start/join live view; invite link |

## Considerations

- Latency: scroll sync should feel smooth; throttle updates and interpolate if needed.
- Privacy: shared log content may be sensitive; document and optional opt-in.
- Dependency: Live Share is optional; extension should degrade if not installed.

## Effort

**10–14 days** with custom backend; **5–8 days** if Live Share–only MVP.
