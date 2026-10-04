# EscapeRoom A — Integration Contract

> **Status: agreed for the first slice.** Endpoint names, interfaces, and ownership below are agreed. Values marked *initial implementation choice* are starting points that may change; they are not settled product decisions.
>
> The source of truth for types is `src/shared/contract.ts`. Change the types there and update this file; never keep a local copy.

## First End-to-End Flow

```
player inspects drawer (third time)
→ game emits a GameEvent
→ client NarratorManager applies trigger rules and cooldown
→ POST /api/narrator   (server asks Gemini for a short line + emotion)
→ NarratorResponse; if shouldSpeak is false, stop here
→ client shows the subtitle
→ POST /api/voice      (server asks ElevenLabs for speech)
→ client AudioManager queues and plays the audio
```

Text and voice are separate requests so the subtitle can appear before audio is ready, and a voice failure never hides the subtitle.

## Endpoints

| Endpoint | Request body | Success | Failure |
|---|---|---|---|
| `POST /api/narrator` | `GameEvent` | `200` `NarratorResponse` JSON | `400` invalid event; other errors `ApiError` JSON |
| `POST /api/voice` | `VoiceRequest` | `200` `audio/mpeg` bytes | `400` invalid request; other errors `ApiError` JSON |

`GET /api/health` returns `{ "ok": true }` for local checks. Paths are exported as `API_PATHS`; do not hardcode them elsewhere.

In development, Vite proxies `/api` to the Express server (default port 3001, override with `PORT`).

## JSON Contract

### GameEvent

```json
{
  "type": "repeated_action",
  "roomId": "bedroom",
  "objectId": "drawer",
  "count": 3,
  "timeRemainingSeconds": 120
}
```

- `timeRemainingSeconds` is optional until the timer exists.
- `count` is optional; use it for repeated actions.

### NarratorResponse

```json
{
  "line": "I promise the key didn't respawn in there.",
  "emotion": "sarcastic",
  "shouldSpeak": true
}
```

- `shouldSpeak: false` means **no subtitle and no voice request**.

### VoiceRequest

```json
{
  "line": "I promise the key didn't respawn in there.",
  "emotion": "sarcastic"
}
```

### ApiError

```json
{ "error": "Invalid game event" }
```

### Enumerated values (*initial implementation choices*)

- Event types: `repeated_action`. Add more as gameplay features land.
- Emotions: `sarcastic`, `hint`, `warning`, `praise`, `neutral`.

## Ownership

| Component | Owner | Responsibility |
|---|---|---|
| Game events | Game agent | Emits `GameEvent`s at meaningful moments. Owns room data, object IDs, and puzzle truth. Does **not** decide whether the narrator speaks. |
| Client NarratorManager | Integration (later) | Trigger rules, cooldown, and orchestration: calls `/api/narrator`, shows the subtitle, requests voice, and hands audio to the AudioManager. Not part of the skeleton. |
| `/api/narrator` | Gemini agent | Gemini generation, prompt, fallback lines. Replaces the placeholder in `server/routes/narrator.ts`. |
| `/api/voice` | ElevenLabs agent | ElevenLabs speech. Replaces the placeholder in `server/routes/voice.ts`. |
| Client AudioManager | ElevenLabs agent | Speech queue, mute, volume. |
| Subtitle and HUD UI | Design agent | Renders what the NarratorManager tells it to. Owns no game state. |
| Shared files | Project owner / integration | `src/shared/contract.ts`, `server/index.ts`, `server/env.ts`, `package.json`, `tsconfig*.json`, `vite.config.ts` |

Agents that need a change to a shared file should report it instead of making it.

## Rules

### IDs
- Stable object IDs are required across room data, gameplay, and narration (e.g. `drawer`). Never rename an ID in one place only.

### Narration
- Lines are short, ideally one sentence.
- Do not call `/api/narrator` on movement frames or ordinary clicks; only meaningful events qualify (e.g. the third drawer inspection). The NarratorManager enforces this along with a cooldown.
- Subtitles always appear when `shouldSpeak` is true, even when audio is muted.

### Audio
- The AudioManager queues speech so lines never overlap.
- It may discard stale, low-priority queued lines, but it must not drop every new line just because audio is playing.

### Security
- API keys stay on the server. Never use `VITE_` variables for secrets and never commit `.env`.

### Failure handling

Timeouts (*initial implementation choices*, exported as `INITIAL_TIMEOUTS_MS`):
- `/api/narrator`: 3000 ms, then use a safe fallback line and keep the subtitle.
- `/api/voice`: 5000 ms, then continue with the subtitle and no audio.

Neither failure may block movement or puzzle progress.

### Demo requirement
- When API keys are available, the first complete demo must use real Gemini text and real ElevenLabs speech. Fallbacks exist for resilience, not as the demo path.

## Open Items
- Cooldown duration
- Fallback line set
- Priority rules for the AudioManager queue
- Further event types and emotions
