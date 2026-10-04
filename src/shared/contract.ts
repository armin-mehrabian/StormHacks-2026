// Shared client/server contract for EscapeRoom A.
// See docs/INTEGRATION_CONTRACT.md. Change types here, never in a local copy.
// This file must stay free of DOM and Node APIs: both tsconfigs compile it.

import type { Dreamer, RoomBlueprint } from './blueprint.ts'

export const API_PATHS = {
  narrator: '/api/narrator',
  voice: '/api/voice',
  dream: '/api/dream',
  journal: '/api/journal',
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
  /** A memory (voicemail, radio, music box) just finished playing. */
  'memory_heard',
  /** The dream shifted to a new act; new things appeared. */
  'act_changed',
  /** Every clue for a lock is now known: the dreamer connects the dots. */
  'clues_connected',
  /** A wrong answer on a story lock; the dream shudders and time is lost. */
  'wrong_answer',
  /** The dreamer remembered who they are (the mirror). */
  'identity_solved',
  /** The dreamer faced their fear. */
  'fear_faced',
  'escaped',
  'time_up',
] as const
export type GameEventType = (typeof GAME_EVENT_TYPES)[number]

/** Text limits for event context sent to the server. */
export const EVENT_TEXT_LIMITS = {
  field: 300,
  recentLines: 5,
} as const

/**
 * Voices that can speak: the dreamer's inner voice (self_*) and the people in their
 * memories. The server maps each role to an ElevenLabs voice. Initial implementation choice.
 */
export const CAST_ROLES = [
  'self_f',
  'self_m',
  'mom',
  'dad',
  'friend_f',
  'friend_m',
  'grandma',
  'grandpa',
  'radio_host',
  'teacher',
  'stranger',
] as const
export type CastRole = (typeof CAST_ROLES)[number]

export function isCastRole(value: unknown): value is CastRole {
  return typeof value === 'string' && (CAST_ROLES as readonly string[]).includes(value)
}

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
  /** Who the dreamer is: personality and feelings, for the inner voice. */
  dreamerPersona?: string
  /** The dreamer's name and situation. The inner voice may only say it on 'escaped'. */
  dreamerSecret?: string
  /**
   * Client only, never sent to the server: where in the room the line should come from
   * (hints are whispered from the direction of the answer).
   */
  position?: { x: number; y: number }
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
  /** Who speaks; defaults to the configured narrator voice. */
  speaker?: CastRole
}

/** POST /api/dream: no body. The blueprint is always valid; source says where it came from. */
export interface DreamResponse {
  blueprint: RoomBlueprint
  source: 'gemini' | 'fallback'
}

/** What happened in a run, for the dream journal. */
export interface RunStats {
  escaped: boolean
  secondsUsed: number
  secondsLeft: number
  /** The object inspected most, and how often. */
  mostInspected?: { name: string; count: number }
  wrongCodes: number
  hintsGiven: number
  memoriesHeard: number
  itemsFound: number
}

/** POST /api/journal */
export interface JournalRequest {
  dreamer: Dreamer
  title: string
  stats: RunStats
}

export interface JournalResponse {
  /** A short diary entry, in the dreamer's words, written the morning after. */
  entry: string
}

/** Dream generation can take a while; the title screen covers it. Initial choice. */
export const DREAM_TIMEOUT_MS = 40_000

export interface ApiError {
  error: string
}

/**
 * Performance cues Gemini may add for ElevenLabs v3, e.g. "[sighs]". They are spoken as
 * acting, never shown: subtitles use stripAudioTags. Initial implementation choice.
 */
export const AUDIO_TAGS = ['[nervous laugh]', '[sighs]', '[whispers]', '[gasps]', '[laughs]', '[gulps]', '[mumbles]', '[excited]'] as const

/** Removes [bracketed] performance cues, for subtitles and word counts. */
export function stripAudioTags(line: string): string {
  return line.replace(/\[[^\]]{1,30}\]\s*/g, '').replace(/\s{2,}/g, ' ').trim()
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
    optionalText(v.dreamerPersona) &&
    optionalText(v.dreamerSecret) &&
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
  return (
    typeof v.line === 'string' &&
    v.line.length > 0 &&
    isNarratorEmotion(v.emotion) &&
    (v.speaker === undefined || isCastRole(v.speaker))
  )
}
