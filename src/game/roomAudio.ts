// The room's soundscape: footsteps, ambience loops placed in the room (louder and panned
// as the player moves), random thunder with lightning, last-minute tension, and the
// one-shot sounds for interactions.

import type { SoundEngine, LoopHandle } from '../audio/SoundEngine.ts'
import { SOUNDTRACK } from '../shared/music.ts'
import type { SfxKey } from '../shared/sfx.ts'
import type { DecorPlan } from './decor.ts'
import type { RoomData, RoomObjectData } from './rooms/types'

/** Initial implementation choices for the mix. */
const STEP_INTERVAL_MS = 330
const STEP_KEYS: SfxKey[] = ['step-1', 'step-2', 'step-3', 'step-4']
const THUNDER_MIN_MS = 22_000
const THUNDER_MAX_MS = 45_000
/** Lightning flashes first; the thunder arrives a moment later. */
const THUNDER_DELAY_MS = 450
const TENSION_MS = 60_000
const MUSIC_LEVEL = 0.8
const MUSIC_FADE_IN_S = 5

const SEARCH_SOUND: Record<RoomObjectData['kind'], SfxKey> = {
  bed: 'search-bed',
  desk: 'search-desk',
  bookshelf: 'search-bookshelf',
  dresser: 'search-dresser',
  wardrobe: 'search-wardrobe',
  nightstand: 'search-nightstand',
  lamp: 'search-lamp',
  rug: 'search-rug',
  plant: 'search-plant',
  painting: 'search-painting',
  clock: 'search-clock',
  trash_can: 'search-trash',
  lockbox: 'search-lockbox',
  answering_machine: 'search-answering_machine',
  radio: 'search-radio',
  music_box: 'search-music_box',
  mirror: 'search-mirror',
  toy_piano: 'search-toy_piano',
  fear: 'search-fear',
  record_player: 'search-record_player',
  guitar: 'search-guitar',
  easel: 'search-easel',
  aquarium: 'search-aquarium',
  globe: 'search-globe',
  typewriter: 'search-typewriter',
  teddy_bear: 'search-teddy_bear',
  toy_chest: 'search-toy_chest',
  computer: 'search-computer',
  telescope: 'search-telescope',
  coat_rack: 'search-coat_rack',
  trophy_shelf: 'search-trophy_shelf',
  door: 'locked-rattle',
}

/** Loops placed in the room (3D: direction and distance come from SoundEngine). */
interface PlacedLoop {
  handle: LoopHandle
}

export class RoomAudio {
  private readonly sound: SoundEngine
  private readonly room: RoomData
  private readonly decor: DecorPlan
  private readonly onLightning: () => void
  private readonly placed: PlacedLoop[] = []
  private house: LoopHandle | undefined
  private calmMusic: LoopHandle | undefined
  private tenseMusic: LoopHandle | undefined
  private clock: LoopHandle | undefined
  private heartbeat: LoopHandle | undefined
  /** Act 3 (facing the fear) keeps some tension in the music regardless of the clock. */
  private actTension = 0
  private stepTimer = 0
  private lastStep = -1
  private untilThunder = randomBetween(THUNDER_MIN_MS / 2, THUNDER_MAX_MS / 2)
  private thunderPending = -1

  constructor(sound: SoundEngine, room: RoomData, decor: DecorPlan, onLightning: () => void) {
    this.sound = sound
    this.room = room
    this.decor = decor
    this.onLightning = onLightning
  }

  start(): void {
    const { sound } = this
    this.house = sound.loop('amb-house', { volume: 0.45 })

    // The storm is everywhere (a quiet bed), and loudest at each window.
    this.place('amb-rain', null, 0.25)
    for (const w of this.decor.windows) this.place('amb-rain', { x: w.x + w.width / 2, y: 40 }, 0.7, 0.9)

    const clock = this.room.objects.find((o) => o.kind === 'clock')
    // Every room ticks; with no clock object, the ticking comes from behind the door.
    this.clock = this.place('clock-tick', clock ? centre(clock) : { x: this.room.width / 2, y: 0 }, 0.6, 1)

    for (const lamp of this.room.objects.filter((o) => o.kind === 'lamp')) this.place('lamp-hum', centre(lamp), 0.45, 2.2)

    this.heartbeat = sound.loop('heartbeat', { volume: 0, bus: 'sfx' })

    this.calmMusic = sound.loop(SOUNDTRACK.calm, { volume: 0, bus: 'music' })
    this.calmMusic.setVolume(MUSIC_LEVEL, MUSIC_FADE_IN_S)
    this.tenseMusic = sound.loop(SOUNDTRACK.tense, { volume: 0, bus: 'music' })
  }

  /** Call every frame with the player's feet position. */
  update(deltaMs: number, x: number, y: number, moving: boolean, timeRemainingMs: number): void {
    // Everything placed in the room is heard from where the player stands.
    this.sound.setListener({ x, y })

    if (moving) {
      this.stepTimer += deltaMs
      if (this.stepTimer >= STEP_INTERVAL_MS) {
        this.stepTimer = 0
        this.footstep()
      }
    } else {
      this.stepTimer = STEP_INTERVAL_MS * 0.7
    }

    this.untilThunder -= deltaMs
    if (this.untilThunder <= 0) {
      this.untilThunder = randomBetween(THUNDER_MIN_MS, THUNDER_MAX_MS)
      this.onLightning()
      this.thunderPending = THUNDER_DELAY_MS
    }
    if (this.thunderPending >= 0) {
      this.thunderPending -= deltaMs
      if (this.thunderPending < 0) this.sound.play('thunder', { volume: 0.7, bus: 'ambience', pan: randomBetween(-0.4, 0.4) })
    }

    // Last minute: a heartbeat fades in and the clock races.
    const tension = timeRemainingMs <= TENSION_MS ? 1 - timeRemainingMs / TENSION_MS : 0
    this.heartbeat?.setVolume(tension > 0 ? 0.2 + 0.6 * tension : 0, 1)
    this.clock?.setRate(1 + 0.5 * tension)
    // The soundtrack crossfades from calm to tense as the dream fades (or the fear appears).
    const musicTension = Math.max(tension, this.actTension)
    if (musicTension > 0) {
      this.calmMusic?.setVolume(MUSIC_LEVEL * (1 - musicTension), 1)
      this.tenseMusic?.setVolume(MUSIC_LEVEL * Math.min(1, musicTension * 1.5), 1)
    }
  }

  /** The dream moved to a new act. */
  setAct(act: number): void {
    this.actTension = act >= 3 ? 0.5 : 0
  }

  search(kind: RoomObjectData['kind']): void {
    this.sound.play(SEARCH_SOUND[kind], { volume: 0.9, rate: randomBetween(0.95, 1.05) })
  }

  locked(): void {
    this.sound.play('locked-rattle', { volume: 0.9 })
  }

  keyUsed(): void {
    this.sound.play('unlock-key')
  }

  found(item: 'key' | 'page'): void {
    this.sound.play(item === 'key' ? 'key-pickup' : 'page-unfold')
    this.sound.play('item-found', { volume: 0.45 })
  }

  codeWrong(): void {
    this.sound.play('wrong-buzz', { volume: 0.8 })
  }

  codeRight(): void {
    this.sound.play('code-correct')
  }

  /** Ends the run: stops loops and plays the ending sting. */
  finish(escaped: boolean): void {
    for (const loop of this.placed) loop.handle.stop(1.5)
    this.house?.stop(2.5)
    this.calmMusic?.stop(2)
    this.tenseMusic?.stop(2)
    this.heartbeat?.stop(0.5)
    if (escaped) {
      this.sound.play('door-open')
      this.sound.play('victory', { volume: 0.8 })
    } else {
      this.sound.play('time-up')
    }
  }

  private footstep(): void {
    // Never the same take twice in a row.
    let index = Math.floor(Math.random() * STEP_KEYS.length)
    if (index === this.lastStep) index = (index + 1) % STEP_KEYS.length
    this.lastStep = index
    this.sound.play(STEP_KEYS[index] ?? 'step-1', { volume: 0.32, rate: randomBetween(0.92, 1.08) })
  }

  /** Starts an ambience loop, placed at a point (3D) or everywhere (null). */
  private place(key: SfxKey, at: { x: number; y: number } | null, volume: number, rolloff?: number): LoopHandle {
    const handle = this.sound.loop(key, at ? { volume, at, rolloff } : { volume })
    this.placed.push({ handle })
    return handle
  }
}

function centre(object: RoomObjectData): { x: number; y: number } {
  return { x: object.x + object.width / 2, y: object.y + object.height / 2 }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
