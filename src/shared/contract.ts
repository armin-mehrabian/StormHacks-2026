// Shared client/server contract for EscapeRoom A.
// See docs/INTEGRATION_CONTRACT.md. Change types here, never in a local copy.
// This file must stay free of DOM and Node APIs: both tsconfigs compile it.

export const API_PATHS = {
  narrator: '/api/narrator',
  voice: '/api/voice',
} as const

// Initial implementation choice, not a settled product decision.
// Add new event types here as gameplay features land.
export const GAME_EVENT_TYPES = ['repeated_action'] as const
export type GameEventType = (typeof GAME_EVENT_TYPES)[number]

// Initial implementation choice, not a settled product decision.
export const NARRATOR_EMOTIONS = ['sarcastic', 'hint', 'warning', 'praise', 'neutral'] as const
export type NarratorEmotion = (typeof NARRATOR_EMOTIONS)[number]

// Initial implementation choices, not settled product decisions.
// Past these limits the client uses a fallback line (narrator) or continues without audio (voice).
export const INITIAL_TIMEOUTS_MS = {
  narrator: 3000,
  voice: 5000,
} as const

/** Emitted by the game. The client NarratorManager decides whether to send it to the server. */
export interface GameEvent {
  type: GameEventType
  roomId: string
  /** Stable object ID shared by room data, gameplay, and narration, e.g. "drawer". */
  objectId: string
  count?: number
  /** Optional until the timer exists. */
  timeRemainingSeconds?: number
}

/** POST /api/narrator: request body is a GameEvent. */
export interface NarratorResponse {
  line: string
  emotion: NarratorEmotion
  /** false: show no subtitle and make no voice request. */
  shouldSpeak: boolean
}

/** POST /api/voice: success responds with audio/mpeg bytes, failure with ApiError JSON. */
export interface VoiceRequest {
  line: string
  emotion: NarratorEmotion
}

export interface ApiError {
  error: string
}

export function isNarratorEmotion(value: unknown): value is NarratorEmotion {
  return typeof value === 'string' && (NARRATOR_EMOTIONS as readonly string[]).includes(value)
}

export function isGameEvent(value: unknown): value is GameEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    (GAME_EVENT_TYPES as readonly string[]).includes(v.type) &&
    typeof v.roomId === 'string' &&
    typeof v.objectId === 'string' &&
    (v.count === undefined || typeof v.count === 'number') &&
    (v.timeRemainingSeconds === undefined || typeof v.timeRemainingSeconds === 'number')
  )
}

export function isVoiceRequest(value: unknown): value is VoiceRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.line === 'string' && v.line.length > 0 && isNarratorEmotion(v.emotion)
}
