// Client narrator orchestration: decides which GameEvents deserve narration, enforces a
// cooldown, then asks the server for a line, shows the subtitle, and queues the voice.
// Everything here is fire-and-forget; gameplay never waits on it.

import { API_PATHS, INITIAL_TIMEOUTS_MS, isNarratorEmotion } from '../shared/contract.ts'
import type { GameEvent, NarratorEmotion, NarratorResponse } from '../shared/contract.ts'
import type { GameEventEmitter } from '../game/events.ts'
import type { AudioManager, SpeechPriority } from '../audio/AudioManager.ts'
import { requestVoice } from '../audio/requestVoice.ts'

/** Initial implementation choice: minimum gap between narrated events. */
export const NARRATION_COOLDOWN_MS = 8000

// Used when the server cannot be reached at all; the server has its own fallback set.
const CLIENT_FALLBACK: NarratorResponse = {
  line: 'Noted.',
  emotion: 'neutral',
  shouldSpeak: true,
}

export interface SubtitleView {
  show(line: string, emotion: NarratorEmotion): void
}

/** Trigger rules. Initial implementation choice: only repeated actions are narrated. */
function shouldNarrate(event: Readonly<GameEvent>): boolean {
  return event.type === 'repeated_action'
}

function priorityFor(_event: Readonly<GameEvent>): SpeechPriority {
  return 'normal'
}

export class NarratorManager {
  private readonly events: GameEventEmitter
  private readonly audio: AudioManager
  private readonly subtitles: SubtitleView
  private readonly now: () => number
  private lastNarratedAt = Number.NEGATIVE_INFINITY
  private busy = false

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

  private async handle(event: Readonly<GameEvent>): Promise<void> {
    if (!shouldNarrate(event)) return
    if (this.busy || this.now() - this.lastNarratedAt < NARRATION_COOLDOWN_MS) return
    this.busy = true
    this.lastNarratedAt = this.now()

    try {
      const narration = await fetchNarration(event)
      if (!narration.shouldSpeak) return

      this.subtitles.show(narration.line, narration.emotion)

      // Muted: subtitle only, and skip the voice request to save credits.
      if (this.audio.isMuted()) return
      const voice = await requestVoice({ line: narration.line, emotion: narration.emotion })
      if (voice) this.audio.enqueue(voice, priorityFor(event))
    } finally {
      this.busy = false
    }
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
    if (!response.ok) return CLIENT_FALLBACK
    const body: unknown = await response.json()
    return isNarratorResponse(body) ? body : CLIENT_FALLBACK
  } catch {
    return CLIENT_FALLBACK
  }
}

function isNarratorResponse(value: unknown): value is NarratorResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.line === 'string' && isNarratorEmotion(v.emotion) && typeof v.shouldSpeak === 'boolean'
}
