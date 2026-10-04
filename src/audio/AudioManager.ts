// Client speech queue: lines play one at a time, never overlapping.
// Pure logic over an injectable playback so it can be verified without a browser.

export type SpeechPriority = 'low' | 'normal' | 'high'

export interface SpeechPlayback {
  /** Resolves when playback ends or is stopped; rejects if the audio cannot play. */
  play(volume: number): Promise<void>
  setVolume(volume: number): void
  stop(): void
}

export type PlaybackFactory = (audio: Blob) => SpeechPlayback

export interface AudioManagerOptions {
  volume?: number
  muted?: boolean
  /** Queued (not yet playing) lines kept at once. Initial implementation choice. */
  maxQueued?: number
  /** A queued low-priority line older than this is skipped instead of played. Initial implementation choice. */
  staleMs?: number
  createPlayback?: PlaybackFactory
  now?: () => number
}

interface QueuedSpeech {
  audio: Blob
  priority: SpeechPriority
  enqueuedAt: number
  onStart?: () => void
}

const PRIORITY_RANK: Record<SpeechPriority, number> = { low: 0, normal: 1, high: 2 }

function createHtmlPlayback(audio: Blob): SpeechPlayback {
  const url = URL.createObjectURL(audio)
  const element = new Audio(url)
  let finish: (() => void) | undefined
  return {
    play(volume) {
      element.volume = volume
      return new Promise<void>((resolve, reject) => {
        const done = () => {
          URL.revokeObjectURL(url)
          resolve()
        }
        finish = done
        element.onended = done
        element.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Audio playback failed'))
        }
        element.play().catch((err) => {
          URL.revokeObjectURL(url)
          reject(err)
        })
      })
    },
    setVolume(volume) {
      element.volume = volume
    },
    stop() {
      element.pause()
      finish?.()
    },
  }
}

export class AudioManager {
  private volume: number
  private muted: boolean
  private readonly maxQueued: number
  private readonly staleMs: number
  private readonly createPlayback: PlaybackFactory
  private readonly now: () => number
  private queue: QueuedSpeech[] = []
  private current: SpeechPlayback | undefined
  private pumping = false

  constructor(options: AudioManagerOptions = {}) {
    this.volume = clampVolume(options.volume ?? 1)
    this.muted = options.muted ?? false
    this.maxQueued = options.maxQueued ?? 3
    this.staleMs = options.staleMs ?? 8000
    this.createPlayback = options.createPlayback ?? createHtmlPlayback
    this.now = options.now ?? Date.now
  }

  /**
   * Queue a line of speech. Returns false when it was not queued (muted, or the
   * lowest-priority entry in a full queue). Subtitles are the caller's job and
   * must show regardless; onStart fires when this line begins playing, so a
   * subtitle can appear in sync with its voice.
   */
  enqueue(audio: Blob, priority: SpeechPriority = 'normal', onStart?: () => void): boolean {
    if (this.muted) return false
    const entry: QueuedSpeech = { audio, priority, enqueuedAt: this.now(), onStart }
    // After every queued line of equal or higher priority.
    let index = this.queue.length
    while (index > 0 && PRIORITY_RANK[this.queue[index - 1].priority] < PRIORITY_RANK[priority]) index--
    this.queue.splice(index, 0, entry)
    this.trim()
    const accepted = this.queue.includes(entry)
    void this.pump()
    return accepted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) this.clear()
  }

  isMuted(): boolean {
    return this.muted
  }

  /** Clamped to 0..1; non-finite values are ignored. Applies to the line already playing. */
  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return
    this.volume = clampVolume(volume)
    this.current?.setVolume(this.volume)
  }

  getVolume(): number {
    return this.volume
  }

  /** Drop every queued line and stop the one playing. */
  clear(): void {
    this.queue = []
    this.current?.stop()
  }

  isPlaying(): boolean {
    return this.current !== undefined
  }

  queuedCount(): number {
    return this.queue.length
  }

  // Over capacity: drop the lowest-priority line, oldest first. A new line is only
  // dropped when it is strictly the lowest priority, never merely because audio is playing.
  private trim(): void {
    while (this.queue.length > this.maxQueued) {
      let victim = 0
      for (let i = 1; i < this.queue.length; i++) {
        if (PRIORITY_RANK[this.queue[i].priority] < PRIORITY_RANK[this.queue[victim].priority]) victim = i
      }
      this.queue.splice(victim, 1)
    }
  }

  private takeNext(): QueuedSpeech | undefined {
    while (this.queue.length > 0) {
      const next = this.queue.shift()!
      const stale = next.priority === 'low' && this.now() - next.enqueuedAt > this.staleMs
      if (!stale) return next
    }
    return undefined
  }

  private async pump(): Promise<void> {
    if (this.pumping) return
    this.pumping = true
    try {
      for (let next = this.takeNext(); next; next = this.takeNext()) {
        const playback = this.createPlayback(next.audio)
        this.current = playback
        next.onStart?.()
        try {
          await playback.play(this.volume)
        } catch {
          // Autoplay blocked or bad audio: skip this line, keep the queue moving.
        } finally {
          this.current = undefined
        }
      }
    } finally {
      this.pumping = false
    }
  }
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume))
}
