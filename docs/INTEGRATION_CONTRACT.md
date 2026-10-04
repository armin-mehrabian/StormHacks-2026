# EscapeRoom A — Integration Contract

> **Status: proposed.** All endpoint names, field names, and TypeScript interfaces below are **provisional**. Agree on them before implementation, then update this file.

## First End-to-End Flow

```
player inspects drawer
→ game emits a structured event
→ narrator trigger rules decide whether to react
→ server sends context to Gemini
→ Gemini returns a short line and emotion
→ server sends line to ElevenLabs
→ client displays subtitle and plays audio
```

## Proposed JSON Contract (provisional)

### Game event

```json
{
  "type": "repeated_action",
  "roomId": "bedroom",
  "objectId": "drawer",
  "count": 3,
  "timeRemainingSeconds": 120
}
```

### Narrator response

```json
{
  "line": "I promise the key didn't respawn in there.",
  "emotion": "sarcastic",
  "shouldSpeak": true
}
```

Provisional TypeScript shape (to be agreed):

```ts
interface GameEvent {
  type: string; // e.g. "repeated_action"
  roomId: string;
  objectId: string;
  count?: number;
  timeRemainingSeconds: number;
}

interface NarratorResponse {
  line: string;
  emotion: string; // e.g. "sarcastic"
  shouldSpeak: boolean;
}
```

Provisional endpoints (names not final): one for narrator text from an event, one for speech audio from a line. Do not hardcode these in more than one place.

## Rules

### IDs
- Stable object IDs are required across room data, gameplay, and narration (e.g. `drawer`). Never rename an ID in one place only.

### Narration
- Lines are short, ideally one sentence.
- Narration has a cooldown, and audio must not overlap (skip or queue; never play two lines at once).
- Subtitles always appear, even when audio is muted.
- Narrator trigger rules live in the game/client side and decide *whether* to call the server. Avoid calling Gemini on every movement frame or every click; only meaningful events (e.g. the third drawer inspection) qualify.

### Security
- API keys stay on the server. Never use `VITE_` variables for secrets and never commit `.env`.

### Failure handling
- If Gemini fails or is slow, use a safe fallback line (and keep the subtitle).
- If ElevenLabs fails or is slow, show the subtitle and continue without audio.
- Neither failure may block movement or puzzle progress.

## Open Items
- Final endpoint names and TypeScript interfaces
- Full list of event types and emotions
- Cooldown duration
- Fallback line set
