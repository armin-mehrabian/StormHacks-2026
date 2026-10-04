// Shared client/server contract for EscapeRoom A.
// See docs/INTEGRATION_CONTRACT.md. Change types here, never in a local copy.
// This file must stay free of DOM and Node APIs: both tsconfigs compile it.

export const API_PATHS = {
  narrator: '/api/narrator',
  voice: '/api/voice',
} as const

// Initial implementation choice, not a settled product decision.
// Add new event types here as gameplay features land.
export const GAME_EVENT_TYPES = [
  /** Run begins. */
  'game_start',
  /** Same object inspected again and again. */
  'repeated_action',
  /** Opened something with nothing useful inside. */
  'nothing_found',
  'item_found',
  /** A cipher page was opened; plain pages are read aloud instead. */
  'cipher_found',
  /** Tried a lock without the key. */
  'locked',
  'wrong_code',
  'unlocked',
  /** Engine-chosen hint: player lingers near the next step. */
  'near_solution',
  /** Engine-chosen hint: player has done nothing useful for a while. */
  'stuck',
  'time_warning',
  'escaped',
  'time_up',
] as const
export type GameEventType = (typeof GAME_EVENT_TYPES)[number]

/** Text limits for event context sent to the server. */
export const EVENT_TEXT_LIMITS = {
  field: 200,
  recentLines: 5,
} as const

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
  /** Stable object ID shared by the blueprint, gameplay, and narration, e.g. "drawer". */
  objectId?: string
  /** Display name of the object, e.g. "Dresser". */
  objectName?: string
  /** Display name of the item involved, e.g. "Brass key". */
  itemName?: string
  /** Room title, for flavour. */
  roomTitle?: string
  count?: number
  timeRemainingSeconds?: number
  /** Engine-chosen hint text from the blueprint. The narrator may reword it but adds no facts. */
  hint?: string
  /** 0-based position on the hint ladder; higher is more explicit. */
  hintLevel?: number
  /** Small extra fact, e.g. the wrong code entered. */
  detail?: string
  /** The narrator's last few lines, so it can avoid repeating itself. */
  recentLines?: string[]
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
  const optionalText = (field: unknown) =>
    field === undefined || (typeof field === 'string' && field.length <= EVENT_TEXT_LIMITS.field)
  const optionalNumber = (field: unknown) => field === undefined || (typeof field === 'number' && Number.isFinite(field))
  return (
    typeof v.type === 'string' &&
    (GAME_EVENT_TYPES as readonly string[]).includes(v.type) &&
    typeof v.roomId === 'string' &&
    optionalText(v.objectId) &&
    optionalText(v.objectName) &&
    optionalText(v.itemName) &&
    optionalText(v.roomTitle) &&
    optionalText(v.hint) &&
    optionalText(v.detail) &&
    optionalNumber(v.count) &&
    optionalNumber(v.timeRemainingSeconds) &&
    optionalNumber(v.hintLevel) &&
    (v.recentLines === undefined ||
      (Array.isArray(v.recentLines) &&
        v.recentLines.length <= EVENT_TEXT_LIMITS.recentLines &&
        v.recentLines.every((line) => typeof line === 'string' && line.length <= EVENT_TEXT_LIMITS.field)))
  )
}

export function isVoiceRequest(value: unknown): value is VoiceRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.line === 'string' && v.line.length > 0 && isNarratorEmotion(v.emotion)
}
