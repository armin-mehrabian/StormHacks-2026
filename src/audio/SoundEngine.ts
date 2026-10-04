// Web Audio mixer for everything the game plays: the narrator's voice, ambience loops,
// sound effects, and (later) music. Music and ambience duck automatically while the
// narrator speaks, so lines are always heard clearly.

import { MUSIC, MUSIC_KEYS, musicUrl } from '../shared/music.ts'
import type { MusicKey } from '../shared/music.ts'
import { SFX_KEYS, sfxUrl } from '../shared/sfx.ts'
import type { SfxKey } from '../shared/sfx.ts'
import type { PlaybackFactory, SpeechPlayback } from './AudioManager.ts'

export type Bus = 'voice' | 'music' | 'ambience' | 'sfx'
/** How a voice clip sounds: through a phone, a radio, or plainly in the room. */
export type VoiceEffect = 'phone' | 'radio' | 'room'
export type SoundKey = SfxKey | MusicKey

/** Initial mix levels (0-1). */
const BUS_LEVELS: Record<Bus, number> = { voice: 1, music: 0.55, ambience: 0.7, sfx: 0.8 }
/** Music and ambience level while the narrator speaks. */
const DUCK_LEVEL = 0.3
const DUCK_ATTACK_S = 0.15
const DUCK_RELEASE_S = 0.8
/** The inner voice gets a soft, dreamy room around it. */
const VOICE_REVERB_SECONDS = 2.2
const VOICE_REVERB_MIX = 0.22

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
  private readonly buffers = new Map<SoundKey, AudioBuffer>()
  private speaking = 0
  private readonly effects = new WeakMap<Blob, VoiceEffect>()
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

    // Voice reverb: a wet copy of the voice bus through a synthetic dreamy room.
    const reverb = this.ctx.createConvolver()
    reverb.buffer = this.impulse(VOICE_REVERB_SECONDS)
    const wet = this.ctx.createGain()
    wet.gain.value = VOICE_REVERB_MIX
    this.buses.voice.connect(reverb).connect(wet).connect(this.master)
  }

  /** Must be called from a user gesture (e.g. the Start button) before sound can play. */
  async unlock(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  /** Fetches and decodes the SFX library and soundtrack. Missing files are skipped silently. */
  async preload(keys: readonly SoundKey[] = [...SFX_KEYS, ...MUSIC_KEYS]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        if (this.buffers.has(key)) return
        try {
          const response = await fetch(key in MUSIC ? musicUrl(key as MusicKey) : sfxUrl(key as SfxKey))
          if (!response.ok) return
          this.buffers.set(key, await this.ctx.decodeAudioData(await response.arrayBuffer()))
        } catch {
          // A missing or broken sound must never break the game.
        }
      }),
    )
  }

  /** Plays a one-shot sound. Returns a function that stops it early. */
  play(key: SoundKey, options: PlayOptions = {}): () => void {
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
  loop(key: SoundKey, options: PlayOptions = {}): LoopHandle {
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

  /** Marks a voice clip to be played through a phone or radio filter by voicePlayback. */
  tagEffect(audio: Blob, effect: VoiceEffect): void {
    this.effects.set(audio, effect)
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
        const effect = this.effects.get(audio) ?? 'room'
        const stopStatic = this.applyEffect(source, effect, gain)
        gain.connect(this.buses.voice)
        this.startSpeaking()
        await new Promise<void>((resolve) => {
          source!.onended = () => resolve()
          source!.start()
        })
        stopStatic()
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

  /**
   * Connects source to output through the effect's filters. Radio also adds a quiet bed of
   * static for the clip's duration; the returned function stops it.
   */
  private applyEffect(source: AudioBufferSourceNode, effect: VoiceEffect, output: AudioNode): () => void {
    if (effect === 'room') {
      source.connect(output)
      return () => {}
    }
    const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
      const node = this.ctx.createBiquadFilter()
      node.type = type
      node.frequency.value = frequency
      node.Q.value = q
      return node
    }
    if (effect === 'phone') {
      // Narrow, slightly crunchy band like a cassette answering machine.
      const shaper = this.ctx.createWaveShaper()
      shaper.curve = softClipCurve(3)
      source.connect(filter('highpass', 450)).connect(filter('lowpass', 3200)).connect(shaper).connect(output)
      return () => {}
    }
    // Radio: band-limited voice plus a bed of static.
    source.connect(filter('highpass', 300)).connect(filter('peaking', 1800, 1)).connect(filter('lowpass', 4200)).connect(output)
    const noise = this.ctx.createBufferSource()
    noise.buffer = this.noiseBuffer()
    noise.loop = true
    const noiseGain = this.ctx.createGain()
    noiseGain.gain.value = 0.035
    noise.connect(filter('bandpass', 2500, 0.5)).connect(noiseGain).connect(output)
    noise.start()
    return () => {
      try {
        noise.stop()
      } catch {
        // Already stopped.
      }
    }
  }

  private noise: AudioBuffer | undefined
  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const length = this.ctx.sampleRate * 2
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    }
    return this.noise
  }

  /** Stereo noise with an exponential tail: a cheap, smooth reverb impulse. */
  private impulse(seconds: number): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
    }
    return buffer
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

function softClipCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(256)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount)
  }
  return curve
}
