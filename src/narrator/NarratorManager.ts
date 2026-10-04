// Client narrator orchestration: decides which GameEvents deserve narration, rate-limits
// them by importance, then asks the server for a line, queues the voice, and shows the
// subtitle when that voice starts. Everything here is fire-and-forget; gameplay never waits.

import { API_PATHS, EVENT_TEXT_LIMITS, INITIAL_TIMEOUTS_MS, isNarratorEmotion, stripAudioTags } from '../shared/contract.ts'
import type { GameEvent, GameEventType, NarratorEmotion, NarratorResponse } from '../shared/contract.ts'
import type { Dreamer, Memory } from '../shared/blueprint.ts'
import type { GameEventEmitter } from '../game/events.ts'
import type { AudioManager, SpeechPriority } from '../audio/AudioManager.ts'
import { requestVoice } from '../audio/requestVoice.ts'

/**
 * Importance per event (initial implementation choices). High always speaks; normal and
 * low wait out their cooldown and are skipped while another line is being prepared.
 */
const EVENT_PRIORITY: Record<GameEventType, SpeechPriority> = {
  game_start: 'high',
  escaped: 'high',
  time_up: 'high',
  item_found: 'normal',
  cipher_found: 'normal',
  unlocked: 'normal',
  near_solution: 'normal',
  stuck: 'normal',
  time_warning: 'normal',
  memory_heard: 'normal',
  act_changed: 'high',
  clues_connected: 'high',
  identity_solved: 'high',
  fear_faced: 'high',
  wrong_answer: 'normal',
  repeated_action: 'low',
  nothing_found: 'low',
  locked: 'low',
  wrong_code: 'low',
}

/** Memory clips are long and prefetched in the background, so they get a longer timeout. */
const MEMORY_TIMEOUT_MS = 20_000

/** Minimum gap since the last narrated event, per priority. Initial implementation choices. */
const COOLDOWN_MS: Record<SpeechPriority, number> = { high: 0, normal: 3000, low: 7000 }

// Used when the server cannot be reached at all; the server has its own fallback set.
const CLIENT_FALLBACK: NarratorResponse = { line: 'Hmm...', emotion: 'neutral', shouldSpeak: true }

export interface SubtitleView {
  show(line: string, emotion: NarratorEmotion): void
}

export class NarratorManager {
  private readonly events: GameEventEmitter
  private readonly audio: AudioManager
  private readonly subtitles: SubtitleView
  private readonly now: () => number
  private readonly recentLines: string[] = []
  private lastNarratedAt = Number.NEGATIVE_INFINITY
  private inFlight = 0
  private dreamer: Dreamer | undefined
  private readonly memoryClips = new Map<string, Promise<Blob | null>>()

  constructor(events: GameEventEmitter, audio: AudioManager, subtitles: SubtitleView, now: () => number = Date.now) {
    this.events = events
    this.audio = audio
    this.subtitles = subtitles
    this.now = now
  }

  /** Starts listening for game events. Returns a function that stops it. */
  start(): () => void {
    return this.events.subscribe((event) => {
      void this.handle(event)
    })
  }

  /** Sets whose dream this is: their inner voice speaks every line, in character. */
  setDreamer(dreamer: Dreamer): void {
    this.dreamer = dreamer
  }

  /**
   * Starts generating memory clips in the background so they play instantly later.
   * Keyed by the object that holds the memory.
   */
  prefetchMemories(memories: { objectId: string; memory: Memory }[]): void {
    for (const { objectId, memory } of memories) {
      if (this.memoryClips.has(objectId)) continue
      this.memoryClips.set(
        objectId,
        requestVoice({ line: memory.text, emotion: 'neutral', speaker: memory.speaker }, MEMORY_TIMEOUT_MS),
      )
    }
  }

  /**
   * Plays a memory clip (prefetched if possible). onStart fires when it begins, so the
   * transcript can appear in sync. Resolves false if there is no audio (muted or failed).
   */
  async playMemory(objectId: string, memory: Memory, tagEffect: (clip: Blob) => void, onStart: () => void): Promise<boolean> {
    if (this.audio.isMuted()) return false
    let clip = this.memoryClips.get(objectId)
    if (!clip) {
      clip = requestVoice({ line: memory.text, emotion: 'neutral', speaker: memory.speaker }, MEMORY_TIMEOUT_MS)
      this.memoryClips.set(objectId, clip)
    }
    const audio = await clip
    if (!audio) {
      // Let a later inspect retry instead of caching the failure.
      this.memoryClips.delete(objectId)
      return false
    }
    tagEffect(audio)
    return this.audio.enqueue(audio, 'high', onStart)
  }

  /** Speaks text verbatim in the dreamer's voice, e.g. a page. No subtitle: the text is on screen. */
  async readAloud(text: string): Promise<void> {
    if (this.audio.isMuted()) return
    const voice = await requestVoice({ line: text, emotion: 'neutral', speaker: this.dreamer?.voice })
    if (voice) this.audio.enqueue(voice, 'high')
  }

  private async handle(event: Readonly<GameEvent>): Promise<void> {
    const priority = EVENT_PRIORITY[event.type]
    if (priority !== 'high') {
      if (this.inFlight > 0) return
      if (this.now() - this.lastNarratedAt < COOLDOWN_MS[priority]) return
    }
    this.lastNarratedAt = this.now()
    this.inFlight++

    try {
      const narration = await fetchNarration({ ...event, ...this.dreamerContext(), recentLines: [...this.recentLines] })
      if (!narration.shouldSpeak) return
      // Audio tags like [sighs] are acted by the voice, never shown. They stay in the
      // remembered lines so Gemini can vary them.
      const text = stripAudioTags(narration.line)
      this.remember(narration.line)

      const show = () => this.subtitles.show(text, narration.emotion)
      // Muted: subtitle only, and skip the voice request to save credits.
      if (this.audio.isMuted()) {
        show()
        return
      }
      const voice = await requestVoice({ line: narration.line, emotion: narration.emotion, speaker: this.dreamer?.voice })
      if (!voice) {
        show()
        return
      }
      // The subtitle appears when its voice starts, so text and speech stay in sync.
      this.audio.enqueue(voice, priority, show)
    } finally {
      this.inFlight--
    }
  }

  /** Who the inner voice belongs to; the secret (name, situation) is only spoken on waking. */
  private dreamerContext(): Pick<GameEvent, 'dreamerPersona' | 'dreamerSecret'> {
    const d = this.dreamer
    if (!d) return {}
    return {
      dreamerPersona: `${d.age} years old. ${d.personality}`.slice(0, EVENT_TEXT_LIMITS.field),
      dreamerSecret: `My name is ${d.name}. ${d.situation}`.slice(0, EVENT_TEXT_LIMITS.field),
    }
  }

  private remember(line: string): void {
    this.recentLines.push(line.slice(0, EVENT_TEXT_LIMITS.field))
    if (this.recentLines.length > EVENT_TEXT_LIMITS.recentLines) this.recentLines.shift()
  }
}

/** POST /api/narrator. Never throws: any failure or timeout yields the client fallback. */
async function fetchNarration(event: Readonly<GameEvent>): Promise<NarratorResponse> {
  try {
    const response = await fetch(API_PATHS.narrator, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(INITIAL_TIMEOUTS_MS.narrator),
    })
    if (!response.ok) return event.hint ? hintFallback(event.hint) : CLIENT_FALLBACK
    const body: unknown = await response.json()
    return isNarratorResponse(body) ? body : CLIENT_FALLBACK
  } catch {
    // Hints must reach the player even when the server is down.
    return event.hint ? hintFallback(event.hint) : CLIENT_FALLBACK
  }
}

function hintFallback(hint: string): NarratorResponse {
  return { line: hint, emotion: 'hint', shouldSpeak: true }
}

function isNarratorResponse(value: unknown): value is NarratorResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.line === 'string' && isNarratorEmotion(v.emotion) && typeof v.shouldSpeak === 'boolean'
}
