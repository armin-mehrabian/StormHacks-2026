// Web Audio mixer for everything the game plays: the narrator's voice, ambience loops,
// sound effects, and (later) music. Music and ambience duck automatically while the
// narrator speaks, so lines are always heard clearly.

import { SFX_KEYS, sfxUrl } from '../shared/sfx.ts'
import type { SfxKey } from '../shared/sfx.ts'
import type { PlaybackFactory, SpeechPlayback } from './AudioManager.ts'

export type Bus = 'voice' | 'music' | 'ambience' | 'sfx'

/** Initial mix levels (0-1). */
const BUS_LEVELS: Record<Bus, number> = { voice: 1, music: 0.55, ambience: 0.7, sfx: 0.8 }
/** Music and ambience level while the narrator speaks. */
const DUCK_LEVEL = 0.3
const DUCK_ATTACK_S = 0.15
const DUCK_RELEASE_S = 0.8

export interface PlayOptions {
  bus?: Bus
  volume?: number
  /** Playback speed; also shifts pitch. */
  rate?: number
  /** -1 (left) to 1 (right). */
  pan?: number
}

export interface LoopHandle {
  setVolume(volume: number, rampSeconds?: number): void
  setPan(pan: number): void
  setRate(rate: number): void
  stop(fadeSeconds?: number): void
}

export class SoundEngine {
  private readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly duck: GainNode
  private readonly buses: Record<Bus, GainNode>
  private readonly buffers = new Map<SfxKey, AudioBuffer>()
  private speaking = 0
  private muted = false

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)
    this.duck = this.ctx.createGain()
    this.duck.connect(this.master)

    const bus = (name: Bus, output: AudioNode) => {
      const gain = this.ctx.createGain()
      gain.gain.value = BUS_LEVELS[name]
      gain.connect(output)
      return gain
    }
    this.buses = {
      voice: bus('voice', this.master),
      sfx: bus('sfx', this.master),
      music: bus('music', this.duck),
      ambience: bus('ambience', this.duck),
    }
  }

  /** Must be called from a user gesture (e.g. the Start button) before sound can play. */
  async unlock(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  /** Fetches and decodes the SFX library. Missing files are skipped silently. */
  async preload(keys: readonly SfxKey[] = SFX_KEYS): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        if (this.buffers.has(key)) return
        try {
          const response = await fetch(sfxUrl(key))
          if (!response.ok) return
          this.buffers.set(key, await this.ctx.decodeAudioData(await response.arrayBuffer()))
        } catch {
          // A missing or broken sound must never break the game.
        }
      }),
    )
  }

  /** Plays a one-shot sound. Returns a function that stops it early. */
  play(key: SfxKey, options: PlayOptions = {}): () => void {
    const buffer = this.buffers.get(key)
    if (!buffer) return () => {}
    const { source, gain } = this.chain(buffer, options)
    gain.connect(this.buses[options.bus ?? 'sfx'])
    source.start()
    return () => {
      try {
        source.stop()
      } catch {
        // Already stopped.
      }
    }
  }

  /** Starts a seamless loop. Starts silent if volume is 0, so callers can fade it in. */
  loop(key: SfxKey, options: PlayOptions = {}): LoopHandle {
    const buffer = this.buffers.get(key)
    if (!buffer) return { setVolume() {}, setPan() {}, setRate() {}, stop() {} }
    const { source, gain, panner } = this.chain(buffer, options)
    source.loop = true
    gain.connect(this.buses[options.bus ?? 'ambience'])
    // Random start point so several loops never phase in sync.
    source.start(0, Math.random() * buffer.duration)
    const now = () => this.ctx.currentTime
    return {
      setVolume: (volume, rampSeconds = 0.15) => {
        gain.gain.cancelScheduledValues(now())
        gain.gain.setTargetAtTime(volume, now(), rampSeconds / 3)
      },
      setPan: (pan) => panner.pan.setTargetAtTime(clamp(pan, -1, 1), now(), 0.05),
      setRate: (rate) => source.playbackRate.setTargetAtTime(rate, now(), 0.2),
      stop: (fadeSeconds = 0.5) => {
        gain.gain.cancelScheduledValues(now())
        gain.gain.setTargetAtTime(0, now(), fadeSeconds / 3)
        try {
          source.stop(now() + fadeSeconds + 0.1)
        } catch {
          // Already stopped.
        }
      },
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05)
  }

  isMuted(): boolean {
    return this.muted
  }

  setBusVolume(bus: Bus, volume: number): void {
    this.buses[bus].gain.setTargetAtTime(clamp(volume, 0, 1), this.ctx.currentTime, 0.05)
  }

  /** Narrator playback through the voice bus, ducking music and ambience while it plays. */
  readonly voicePlayback: PlaybackFactory = (audio: Blob): SpeechPlayback => {
    let source: AudioBufferSourceNode | undefined
    let gain: GainNode | undefined
    return {
      play: async (volume) => {
        const buffer = await this.ctx.decodeAudioData(await audio.arrayBuffer())
        gain = this.ctx.createGain()
        gain.gain.value = volume
        source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.connect(gain).connect(this.buses.voice)
        this.startSpeaking()
        await new Promise<void>((resolve) => {
          source!.onended = () => resolve()
          source!.start()
        })
        this.stopSpeaking()
      },
      setVolume: (volume) => {
        if (gain) gain.gain.value = volume
      },
      stop: () => {
        try {
          source?.stop()
        } catch {
          // Not started yet or already stopped.
        }
      },
    }
  }

  private chain(buffer: AudioBuffer, options: PlayOptions) {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = options.rate ?? 1
    const panner = this.ctx.createStereoPanner()
    panner.pan.value = clamp(options.pan ?? 0, -1, 1)
    const gain = this.ctx.createGain()
    gain.gain.value = options.volume ?? 1
    source.connect(panner).connect(gain)
    return { source, gain, panner }
  }

  private startSpeaking(): void {
    this.speaking++
    this.duck.gain.setTargetAtTime(DUCK_LEVEL, this.ctx.currentTime, DUCK_ATTACK_S / 3)
  }

  private stopSpeaking(): void {
    this.speaking = Math.max(0, this.speaking - 1)
    if (this.speaking === 0) this.duck.gain.setTargetAtTime(1, this.ctx.currentTime, DUCK_RELEASE_S / 3)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
