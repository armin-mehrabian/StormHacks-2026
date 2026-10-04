import Phaser from 'phaser'
import { DOOR_ID, ROOM_COLS, ROOM_ROWS, memoryEffect, pageDisplayText } from '../../shared/blueprint.ts'
import type { BlueprintItem, Memory } from '../../shared/blueprint.ts'
import type { GameEvent, RunStats } from '../../shared/contract.ts'
import type { SoundEngine } from '../../audio/SoundEngine.ts'
import type { CodeLock } from '../../ui/CodeLock.ts'
import type { Notebook } from '../../ui/Notebook.ts'
import type { ChoicePuzzle, IdentityBoard, PianoPuzzle } from '../../ui/StoryPuzzles.ts'
import type { EndScreen } from '../../ui/EndScreen.ts'
import type { Hud } from '../../ui/Hud.ts'
import { modalBlocksInput } from '../../ui/modal.ts'
import type { Notice } from '../../ui/Notice.ts'
import type { PageOverlay } from '../../ui/PageOverlay.ts'
import {
  ART_SCALE,
  DUST_KEY,
  FLOOR_KEY,
  KEYCAP_KEY,
  PLAYER_FRAME_H,
  PLAYER_KEY,
  SPARK_KEY,
  WALL_FACE_KEY,
  createRoomArt,
  furnitureKey,
  playerFrame,
} from '../art.ts'
import type { PlayerDirection } from '../art.ts'
import { planDecor } from '../decor.ts'
import type { DecorPlan } from '../decor.ts'
import { gameEvents } from '../events'
import { InspectionTracker, repeatedInspectionEvent } from '../inspection'
import { Lighting } from '../lighting.ts'
import type { LightSource } from '../lighting.ts'
import { layoutRoom } from '../rooms/layout.ts'
import type { RoomData, RoomObjectData } from '../rooms/types'
import { TIME_LIMIT_MS } from '../state.ts'
import type { Answer, AnswerLock, AnswerResult, GameState } from '../state.ts'
import { RoomAudio } from '../roomAudio.ts'
import { PlayerWatcher } from '../watcher.ts'
import type { WatcherEvent } from '../watcher.ts'

/** Player speed in pixels per second. */
const PLAYER_SPEED = 130
/** Max gap in pixels between the player's feet and an object's edge for E to work. */
const INTERACT_RANGE = 26
const CAMERA_ZOOM = 2
const STEP_MS = 160
const LOW_TIME_MS = 60_000
/** The dream visibly glitches in its final seconds. */
const COLLAPSE_MS = 20_000

// Feet hitbox: the sprite is drawn above it, so the player can stand "in front" of things.
const FEET_W = 14
const FEET_H = 8

/** Draw order. Objects and the player are y-sorted between WORLD and DUST. */
const DEPTH = {
  FLOOR: 0,
  RUG: 2,
  WALLS: 3,
  SHADOW: 4,
  WORLD: 100,
  DUST: 4000,
  DARKNESS: 5000,
  HIGHLIGHT: 5100,
  KEYCAP: 5101,
  SPARKS: 5102,
} as const

/** How dark the unlit room is in each act: the dream opens up as it is understood. */
const ACT_DARKNESS: Record<number, number> = { 1: 0.92, 2: 0.84, 3: 0.88 }
const FADE_IN_MS = 1400

const WALL_TOP_COLOR = 0x17121f
const WALL_EDGE_COLOR = 0x2b2238

export interface BedroomUi {
  hud: Hud
  pages: PageOverlay
  codeLock: CodeLock
  endScreen: EndScreen
  notice: Notice
  choice: ChoicePuzzle
  identity: IdentityBoard
  piano: PianoPuzzle
  notebook: Notebook
}

export interface BedroomSceneData {
  state: GameState
  ui: BedroomUi
  /** Narration hooks the scene drives directly. Fire-and-forget. */
  voice: {
    readAloud(text: string): void
    prefetchMemories(memories: { objectId: string; memory: Memory }[]): void
    playMemory(objectId: string, memory: Memory): void
  }
  sound: SoundEngine
  /** Called once when the run ends, with what happened. */
  onEnd: (stats: RunStats) => void
}

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key[]
  down: Phaser.Input.Keyboard.Key[]
  left: Phaser.Input.Keyboard.Key[]
  right: Phaser.Input.Keyboard.Key[]
}

export class BedroomScene extends Phaser.Scene {
  static readonly KEY = 'BedroomScene'

  private state!: GameState
  private ui!: BedroomUi
  private voice!: BedroomSceneData['voice']
  private readonly heardMemories = new Set<string>()
  private onEnd!: (stats: RunStats) => void
  private wrongCodes = 0
  private hintsGiven = 0
  private soundEngine!: SoundEngine
  private audio!: RoomAudio
  private watcher!: PlayerWatcher
  private room!: RoomData
  private readonly inspections = new InspectionTracker()
  private interactables: RoomObjectData[] = []
  private feet!: Phaser.GameObjects.Rectangle
  private body_!: Phaser.Physics.Arcade.Body
  private sprite!: Phaser.GameObjects.Sprite
  private direction: PlayerDirection = 'up'
  private stepTimer = 0
  private step = 0
  private moveKeys!: MoveKeys
  private interactKey!: Phaser.Input.Keyboard.Key
  private lighting!: Lighting
  private playerLight!: LightSource
  private highlight!: Phaser.GameObjects.Graphics
  private keycap!: Phaser.GameObjects.Image
  /** Sprites (image, shadow) per object, so later-act objects can fade in. */
  private readonly objectViews = new Map<string, { image: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Rectangle }>()

  constructor() {
    super(BedroomScene.KEY)
  }

  init(data: BedroomSceneData): void {
    this.state = data.state
    this.ui = data.ui
    this.voice = data.voice
    this.onEnd = data.onEnd
    this.soundEngine = data.sound
    this.room = layoutRoom(data.state.blueprint)
    this.interactables = []
    this.watcher = new PlayerWatcher(this.state, (event) => this.emit(event))
  }

  create(): void {
    const { room } = this
    createRoomArt(this, ROOM_COLS, ROOM_ROWS, room.objects)
    this.physics.world.setBounds(0, 0, room.width, room.height)

    this.add.image(0, 0, FLOOR_KEY).setOrigin(0).setScale(ART_SCALE).setDepth(DEPTH.FLOOR)
    const solids = this.physics.add.staticGroup()
    this.createWalls(solids)
    const decor = planDecor(this.room, this.state.blueprint.title)
    this.createDecor(decor)
    this.createObjects(solids)
    this.createPlayer(solids)
    this.createLighting(decor)
    this.createEffects()
    this.audio = new RoomAudio(this.soundEngine, room, decor, () => this.lightning())
    this.audio.start()
    // Generate memory voices now so they play instantly when found.
    this.voice.prefetchMemories(
      this.state.blueprint.objects.flatMap((o) => (o.memory ? [{ objectId: o.id, memory: o.memory }] : [])),
    )
    this.createInput()

    const camera = this.cameras.main
    camera.setBounds(0, 0, room.width, room.height)
    camera.setZoom(CAMERA_ZOOM)
    camera.setRoundPixels(true)
    camera.startFollow(this.sprite, true, 0.12, 0.12)
    camera.fadeIn(1200, 0, 0, 0)
    document.body.dataset.mood = this.state.blueprint.dreamer.mood

    this.ui.hud.setInventory(this.state.inventoryItems())
    this.ui.hud.setTime(this.state.timeRemainingMs)
    this.ui.notice.show(this.state.blueprint.title, 3500)
    this.emit({ type: 'game_start' })
  }

  update(time: number, delta: number): void {
    this.lighting.update(time)
    if (this.state.status !== 'playing') return

    if (this.state.tick(delta)) {
      this.endGame()
      return
    }
    this.updateClock()

    const moving = this.body_.velocity.lengthSq() > 1
    this.audio.update(delta, this.feet.x, this.feet.y, moving, this.state.timeRemainingMs)

    // Always consume E so a press that closed an overlay can't re-trigger an inspect.
    const interactPressed = Phaser.Input.Keyboard.JustDown(this.interactKey)
    if (modalBlocksInput()) {
      this.body_.setVelocity(0, 0)
      this.syncSprite(delta)
      this.showTarget(null, time)
      this.ui.notice.setPrompt(null)
      return
    }

    this.updateMovement()
    this.syncSprite(delta)
    this.watcher.update(delta, this.distanceToNextStep())

    const target = this.findInteractTarget()
    this.showTarget(target, time)
    this.ui.notice.setPrompt(target ? `Inspect ${target.label}` : null)
    if (target && interactPressed) this.inspect(target)
  }

  // -------------------------------------------------------------------------------------
  // Scene construction
  // -------------------------------------------------------------------------------------

  private createWalls(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const { room } = this
    // The top wall shows its papered face; the others are seen from above.
    this.add.image(0, 0, WALL_FACE_KEY).setOrigin(0).setScale(ART_SCALE).setDepth(DEPTH.WALLS)
    for (const wall of room.walls) {
      const isTop = wall.y === 0 && wall.width === room.width
      const block = this.add.rectangle(wall.x, wall.y, wall.width, wall.height, WALL_TOP_COLOR).setOrigin(0)
      block.setDepth(DEPTH.WALLS).setVisible(!isTop)
      solids.add(block)
    }
    // A thin lit edge where the side and bottom walls meet the floor.
    const edge = this.add.graphics().setDepth(DEPTH.WALLS)
    edge.lineStyle(2, WALL_EDGE_COLOR)
    edge.strokeRect(32, 32, room.width - 64, room.height - 64)
  }

  private createDecor(decor: DecorPlan): void {
    for (const piece of decor.pieces) {
      this.add
        .image(piece.x, piece.y, piece.key)
        .setOrigin(0)
        .setScale(ART_SCALE)
        .setFlipX(piece.flipX ?? false)
        .setDepth(piece.layer === 'wall' ? DEPTH.WALLS + 0.5 : DEPTH.RUG + 0.5)
    }
    // Faint moonlight shafts falling from the windows, visible through the darkness.
    const shafts = this.add.graphics().setDepth(DEPTH.HIGHLIGHT - 1).setBlendMode(Phaser.BlendModes.ADD)
    shafts.fillStyle(0x8fa8ff, 0.07)
    for (const window of decor.windows) {
      shafts.fillPoints(
        [
          new Phaser.Math.Vector2(window.x, 28),
          new Phaser.Math.Vector2(window.x + window.width, 28),
          new Phaser.Math.Vector2(window.x + window.width + 46, 150),
          new Phaser.Math.Vector2(window.x + 18, 150),
        ],
        true,
      )
    }
  }

  private createObjects(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const object of this.room.objects) {
      const image = this.add.image(object.x, object.y, furnitureKey(object.kind)).setOrigin(0)
      image.setDisplaySize(object.width, object.height)
      let shadow: Phaser.GameObjects.Rectangle | undefined
      if (object.kind === 'rug' || object.kind === 'fear') {
        image.setDepth(DEPTH.RUG)
      } else if (object.kind === 'door' || object.hangs) {
        image.setDepth(DEPTH.WALLS + 0.6)
      } else {
        image.setDepth(DEPTH.WORLD + object.y + object.height)
        shadow = this.add
          .rectangle(object.x + 2, object.y + object.height - 3, object.width - 2, 6, 0x000000, 0.35)
          .setOrigin(0)
          .setDepth(DEPTH.SHADOW)
      }
      if (object.solid) solids.add(image)
      this.objectViews.set(object.id, { image, shadow })
      if (this.state.isVisible(object.id)) {
        if (object.interactable) this.interactables.push(object)
      } else {
        // Later acts: invisible and intangible until the dream shifts.
        image.setAlpha(0)
        shadow?.setAlpha(0)
        if (image.body) (image.body as Phaser.Physics.Arcade.StaticBody).enable = false
      }
    }
  }

  /** The dream shifts: the room brightens, the next act's objects fade in. */
  private shiftAct(act: number): void {
    this.soundEngine.play('act-shift', { volume: 0.9 })
    this.cameras.main.flash(600, 180, 150, 255)
    this.lighting.setDarkness(ACT_DARKNESS[act] ?? 0.88)
    this.audio.setAct(act)
    const appeared: string[] = []
    for (const object of this.room.objects) {
      const view = this.objectViews.get(object.id)
      if (!view || !this.state.isVisible(object.id) || this.interactables.includes(object)) continue
      this.tweens.add({ targets: [view.image, view.shadow].filter(Boolean), alpha: 1, duration: FADE_IN_MS })
      if (view.image.body) (view.image.body as Phaser.Physics.Arcade.StaticBody).enable = true
      if (object.interactable) this.interactables.push(object)
      this.addObjectLight(object)
      appeared.push(object.label)
    }
    this.ui.notice.show(act === 3 ? 'Something is waiting for me...' : 'The dream shifts...', 3000)
    this.emit({ type: 'act_changed', detail: `act ${act}; appeared: ${appeared.join(', ')}`.slice(0, 300) })
  }

  private createPlayer(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const { x, y } = this.room.playerSpawn
    this.feet = this.add.rectangle(x, y, FEET_W, FEET_H).setVisible(false)
    this.physics.add.existing(this.feet)
    this.body_ = this.feet.body as Phaser.Physics.Arcade.Body
    this.body_.setCollideWorldBounds(true)
    this.physics.add.collider(this.feet, solids)

    this.sprite = this.add.sprite(x, y, PLAYER_KEY, playerFrame('up', 0))
    this.sprite.setOrigin(0.5, 1).setScale(ART_SCALE)
  }

  private createLighting(decor: DecorPlan): void {
    this.lighting = new Lighting(this, this.room.width, this.room.height, DEPTH.DARKNESS)
    this.playerLight = this.lighting.add({ x: 0, y: 0, radius: 105, tint: 0xffb46b, glowAlpha: 0.16 })
    for (const light of decor.lights) {
      if (light.kind === 'moon') {
        this.lighting.add({ x: light.x, y: light.y, radius: 70, tint: 0x7f9cff, glowAlpha: 0.14 })
      } else {
        this.lighting.add({ x: light.x, y: light.y, radius: 52, tint: 0xffa040, glowAlpha: 0.3, flicker: 0.14 })
      }
    }
    this.lighting.setDarkness(ACT_DARKNESS[this.state.act] ?? 0.9)
    for (const object of this.room.objects) if (this.state.isVisible(object.id)) this.addObjectLight(object)
  }

  private addObjectLight(object: RoomObjectData): void {
    const cx = object.x + object.width / 2
    if (object.kind === 'lamp') {
      this.lighting.add({ x: cx, y: object.y + 8, radius: 150, tint: 0xffd27a, glowAlpha: 0.32, flicker: 0.06 })
    } else if (object.kind === 'door') {
      // Light leaking under the door hints at the way out.
      this.lighting.add({ x: cx, y: object.y + object.height + 2, radius: 34, tint: 0xfff0c0, glowAlpha: 0.3, flicker: 0.12 })
    } else if (object.kind === 'fear') {
      // The fear burns in a harsh, uneasy spotlight.
      this.lighting.add({ x: cx, y: object.y + object.height / 2, radius: 110, tint: 0xff6b8a, glowAlpha: 0.35, flicker: 0.1 })
    } else if (object.kind === 'mirror') {
      this.lighting.add({ x: cx, y: object.y + 16, radius: 40, tint: 0xb9d4ff, glowAlpha: 0.25, flicker: 0.04 })
    }
  }

  private createEffects(): void {
    const { room } = this
    this.add
      .particles(0, 0, DUST_KEY, {
        x: { min: 32, max: room.width - 32 },
        y: { min: 32, max: room.height - 32 },
        lifespan: 7000,
        speedX: { min: -5, max: 5 },
        speedY: { min: -7, max: 2 },
        scale: ART_SCALE,
        alpha: { start: 0.5, end: 0 },
        frequency: 140,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.DUST)

    this.highlight = this.add.graphics().setDepth(DEPTH.HIGHLIGHT)
    this.keycap = this.add.image(0, 0, KEYCAP_KEY).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.KEYCAP)
    this.keycap.setVisible(false)
  }

  private createInput(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) throw new Error('Keyboard input is unavailable')
    const { KeyCodes } = Phaser.Input.Keyboard
    const keys = (...codes: number[]) => codes.map((code) => keyboard.addKey(code))
    this.moveKeys = {
      up: keys(KeyCodes.W, KeyCodes.UP),
      down: keys(KeyCodes.S, KeyCodes.DOWN),
      left: keys(KeyCodes.A, KeyCodes.LEFT),
      right: keys(KeyCodes.D, KeyCodes.RIGHT),
    }
    this.interactKey = keyboard.addKey(KeyCodes.E)
  }

  // -------------------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------------------

  private updateMovement(): void {
    const isDown = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((key) => key.isDown)
    const { up, down, left, right } = this.moveKeys
    let dx = Number(isDown(right)) - Number(isDown(left))
    let dy = Number(isDown(down)) - Number(isDown(up))
    if (dx !== 0) this.direction = dx < 0 ? 'left' : 'right'
    else if (dy !== 0) this.direction = dy < 0 ? 'up' : 'down'
    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2
      dy *= Math.SQRT1_2
    }
    this.body_.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED)
  }

  /** Puts the sprite on its feet, animates the walk, y-sorts it, and moves its light. */
  private syncSprite(delta: number): void {
    const { x, y } = this.feet
    const moving = this.body_.velocity.lengthSq() > 1
    if (moving) {
      this.stepTimer += delta
      if (this.stepTimer >= STEP_MS) {
        this.stepTimer = 0
        this.step = 1 - this.step
      }
    } else {
      this.step = 0
      this.stepTimer = 0
    }
    // A tiny bob while walking.
    const bob = moving && this.step ? -1 : 0
    this.sprite.setPosition(Math.round(x), Math.round(y + FEET_H / 2 + bob))
    this.sprite.setFrame(playerFrame(this.direction, this.step))
    this.sprite.setDepth(DEPTH.WORLD + y + FEET_H / 2)
    this.playerLight.x = x
    this.playerLight.y = y - (PLAYER_FRAME_H * ART_SCALE) / 2
  }

  private updateClock(): void {
    const remaining = this.state.timeRemainingMs
    this.ui.hud.setTime(remaining)
    const low = remaining <= LOW_TIME_MS
    document.body.classList.toggle('time-low', low)
    document.body.classList.toggle('dream-collapse', remaining <= COLLAPSE_MS)
    this.lighting.setDread(low ? 1 - remaining / LOW_TIME_MS : 0)
  }

  /** Outlines the object the player can inspect and floats an E keycap above it. */
  private showTarget(target: RoomObjectData | null, time: number): void {
    this.highlight.clear()
    if (!target) {
      this.keycap.setVisible(false)
      return
    }
    const pulse = 0.55 + 0.45 * Math.sin(time / 180)
    this.highlight.lineStyle(2, 0xffe7a3, pulse)
    this.highlight.strokeRect(target.x - 2, target.y - 2, target.width + 4, target.height + 4)
    const bob = Math.round(Math.sin(time / 220) * 2)
    this.keycap.setPosition(target.x + target.width / 2, Math.max(14, target.y - 4 + bob)).setVisible(true)
  }

  /** The closest interactable object within range of the player's feet, if any. */
  private findInteractTarget(): RoomObjectData | null {
    const { x, y } = this.feet
    let best: RoomObjectData | null = null
    let bestDistance = INTERACT_RANGE
    for (const object of this.interactables) {
      const distance = distanceToRect(x, y, object)
      if (distance <= bestDistance) {
        best = object
        bestDistance = distance
      }
    }
    return best
  }

  /** Distance in pixels from the player to the next intended step's object. */
  private distanceToNextStep(): number | undefined {
    const nextId = this.state.nextStepId()
    const object = this.room.objects.find((o) => o.id === nextId)
    return object ? distanceToRect(this.feet.x, this.feet.y, object) : undefined
  }

  // -------------------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------------------

  private inspect(object: RoomObjectData): void {
    const count = this.inspections.inspect(object.id)
    const repeated = repeatedInspectionEvent(this.room.id, object.id, count)
    if (repeated) this.emit({ ...repeated, objectName: object.label })

    const description = this.state.description(object.id)
    const result = this.state.inspect(object.id)
    this.noteClue(object.id, object.label, description)
    const blueprintObject = this.state.object(object.id)
    const memory = blueprintObject?.memory

    if (result.type === 'needs_item' || result.type === 'waiting') this.audio.locked()
    else if (result.type !== 'escaped') this.audio.search(object.kind)
    if ((result.type === 'opened' || result.type === 'escaped') && result.usedItem) this.audio.keyUsed()

    switch (result.type) {
      case 'opened':
      case 'empty': {
        const usedNote = result.type === 'opened' && result.usedItem ? `I used the ${result.usedItem.name}. ` : ''
        if (memory) {
          this.ui.notice.show(`${usedNote}${description}`)
          if (blueprintObject?.melody) this.soundEngine.playMelody(blueprintObject.melody)
          this.playMemory(object, memory)
        } else if (result.type === 'opened' && result.item) {
          this.ui.notice.show(`${usedNote}I found: ${result.item.name}`)
          this.collect(object, result.item)
        } else {
          this.ui.notice.show(`${usedNote}${description}`)
          if (result.type === 'opened' && result.usedItem) {
            this.watcher.noteProgress()
            this.celebrate(object)
            this.emit({ type: 'unlocked', objectId: object.id, objectName: object.label })
          } else if (result.type === 'opened' && !this.state.isClue(object.id) && !repeated) {
            // Clue objects stay quiet so the player can read; empty decoys get teased.
            this.emit({ type: 'nothing_found', objectId: object.id, objectName: object.label })
          }
        }
        if (result.type === 'opened' && result.actChanged) this.shiftAct(result.actChanged)
        break
      }
      case 'needs_item':
        this.ui.notice.show(`${description} It needs something.`)
        this.cameras.main.shake(120, 0.003)
        if (!repeated) this.emit({ type: 'locked', objectId: object.id, objectName: object.label })
        break
      case 'waiting':
        this.ui.notice.show(description)
        break
      case 'needs_answer':
        this.ui.notice.show(description)
        this.openPuzzle(object, result.lock)
        break
      case 'escaped':
        this.endGame()
        break
    }
    this.checkConnections()
  }

  /** Opens the right puzzle screen for a story lock. */
  private openPuzzle(object: RoomObjectData, lock: AnswerLock): void {
    const submit = (answer: Answer) => this.submitAnswer(object, lock, answer)
    switch (lock.type) {
      case 'code':
        this.ui.codeLock.show(object.label, lock.code.length, submit)
        break
      case 'word':
        this.ui.codeLock.show(object.label, lock.word.length, submit, true)
        break
      case 'choice':
        this.ui.choice.show(object.label, lock.question, lock.options, submit)
        break
      case 'fear':
        this.soundEngine.play('search-fear', { volume: 0.8 })
        this.ui.choice.show(object.label, lock.prompt, lock.options, submit, true)
        break
      case 'identity':
        this.ui.identity.show(lock.questions, submit)
        break
      case 'melody':
        this.ui.piano.show(lock.notes.length, submit)
        break
    }
  }

  /** Returns true when the answer opened the lock. */
  private submitAnswer(object: RoomObjectData, lock: AnswerLock, answer: Answer): boolean {
    const result: AnswerResult = this.state.answer(object.id, answer)
    if (result.type === 'wrong') {
      this.wrongCodes++
      this.audio.codeWrong()
      this.cameras.main.shake(260, 0.008)
      this.cameras.main.flash(200, 90, 10, 10)
      if (result.penaltyMs) this.ui.notice.show(`The dream shudders. -${Math.round(result.penaltyMs / 1000)}s`, 2000)
      const detail = typeof answer === 'string' ? `tried ${answer}` : undefined
      this.emit({ type: lock.type === 'code' ? 'wrong_code' : 'wrong_answer', objectId: object.id, objectName: object.label, detail })
      return false
    }
    if (result.type === 'escaped') {
      this.endGame()
      return true
    }
    this.audio.codeRight()
    this.watcher.noteProgress()
    this.celebrate(object)
    if (lock.type === 'identity') {
      this.ui.notice.show('The reflection sharpens. I know that face.', 3500)
      for (const q of lock.questions) this.ui.notebook.add(`identity-${q.prompt}`, 'Who I am', `${q.prompt} ${q.answer}`)
      this.emit({ type: 'identity_solved', objectId: object.id, objectName: object.label })
    } else if (lock.type === 'fear') {
      const said = lock.options[lock.answer] ?? ''
      this.ui.notice.show(`"${said}"`, 4000)
      this.cameras.main.flash(900, 255, 240, 210)
      this.emit({ type: 'fear_faced', objectId: object.id, objectName: object.label, detail: `I told myself: ${said}` })
    } else if (result.item) {
      this.ui.notice.show(`The ${object.label.toLowerCase()} opens. I found: ${result.item.name}`)
      this.collect(object, result.item)
    } else {
      this.ui.notice.show(`The ${object.label.toLowerCase()} opens.`)
      this.emit({ type: 'unlocked', objectId: object.id, objectName: object.label })
    }
    if (result.actChanged) this.time.delayedCall(900, () => this.shiftAct(result.actChanged ?? this.state.act))
    this.checkConnections()
    return true
  }

  /** Writes a clue into the notebook, if it is one. */
  private noteClue(id: string, title: string, text: string): void {
    if (id === DOOR_ID || !this.state.isClue(id)) return
    if (this.ui.notebook.add(id, title, text)) this.ui.hud.setNotebookCount(this.ui.notebook.count)
  }

  /** When every clue for a lock is known, the dreamer connects the dots out loud. */
  private checkConnections(): void {
    for (const ownerId of this.state.newlyConnected()) {
      const ladder = this.state.blueprint.hints.find((h) => h.targetId === ownerId)
      // The middle of the ladder: a nudge that links the clues without giving it all away.
      const hint = ladder?.lines[Math.max(0, Math.min(1, ladder.lines.length - 2))]
      this.emit({ type: 'clues_connected', objectId: ownerId, objectName: this.state.displayName(ownerId), hint })
    }
  }

  private collect(object: RoomObjectData, item: BlueprintItem): void {
    this.watcher.noteProgress()
    this.celebrate(object)
    this.ui.hud.setInventory(this.state.inventoryItems())
    this.audio.found(item.kind === 'page' ? 'page' : 'key')
    if (item.kind === 'page') {
      if (this.ui.notebook.add(item.id, item.name, pageDisplayText(item))) this.ui.hud.setNotebookCount(this.ui.notebook.count)
    }
    if (item.kind !== 'page') {
      this.emit({ type: 'item_found', objectId: object.id, objectName: object.label, itemName: item.name })
      return
    }
    this.ui.pages.show(item)
    if (item.cipherShift) {
      this.emit({ type: 'cipher_found', objectId: object.id, objectName: object.label, itemName: item.name })
    } else if (item.text) {
      // The narrator reads plain pages aloud while they are on screen.
      this.voice.readAloud(item.text)
    }
  }

  /** Plays a voice from the dreamer's life, with its transcript on screen. */
  private playMemory(object: RoomObjectData, memory: Memory): void {
    const effect = object.kind !== 'door' ? memoryEffect(object.kind) : undefined
    const source = effect === 'phone' ? 'Voicemail' : effect === 'radio' ? 'Radio' : 'Memory'
    this.ui.pages.showTranscript(`${source} · ${memory.speakerName}`, memory.text)
    this.voice.playMemory(object.id, memory)
    if (this.ui.notebook.add(`${object.id}-memory`, `${source} · ${memory.speakerName}`, memory.text)) {
      this.ui.hud.setNotebookCount(this.ui.notebook.count)
    }
    if (this.heardMemories.has(object.id)) return
    this.heardMemories.add(object.id)
    this.watcher.noteProgress()
    this.emit({
      type: 'memory_heard',
      objectId: object.id,
      objectName: object.label,
      detail: `${memory.speakerName} said: ${memory.text}`.slice(0, 300),
    })
  }

  /** A burst of sparks and a warm flash for progress. */
  private celebrate(object: RoomObjectData): void {
    const emitter = this.add
      .particles(object.x + object.width / 2, object.y + object.height / 2, SPARK_KEY, {
        speed: { min: 40, max: 110 },
        lifespan: 700,
        gravityY: 120,
        scale: { start: 1.5, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.SPARKS)
    emitter.explode(18)
    this.time.delayedCall(1000, () => emitter.destroy())
    this.cameras.main.flash(180, 60, 45, 15)
  }

  private endGame(): void {
    const escaped = this.state.status === 'escaped'
    this.body_.setVelocity(0, 0)
    this.showTarget(null, 0)
    this.ui.notice.setPrompt(null)
    this.ui.codeLock.close()
    this.ui.pages.close()
    this.ui.hud.setTime(this.state.timeRemainingMs)
    document.body.classList.remove('time-low', 'dream-collapse')
    this.audio.finish(escaped)
    this.emit({ type: escaped ? 'escaped' : 'time_up' })
    if (escaped) this.cameras.main.fadeOut(1600, 255, 236, 200)
    else this.cameras.main.fadeOut(1600, 60, 0, 0)
    this.ui.endScreen.show(escaped, this.state.timeRemainingMs, this.state.blueprint.dreamer)
    const most = this.inspections.mostInspected()
    this.onEnd({
      escaped,
      secondsLeft: Math.ceil(this.state.timeRemainingMs / 1000),
      secondsUsed: Math.round((TIME_LIMIT_MS - this.state.timeRemainingMs) / 1000),
      mostInspected: most && most.count > 1 ? { name: this.state.displayName(most.objectId), count: most.count } : undefined,
      wrongCodes: this.wrongCodes,
      hintsGiven: this.hintsGiven,
      memoriesHeard: this.heardMemories.size,
      itemsFound: this.state.inventoryItems().length,
    })
  }

  /** A lightning flash through the windows; the thunder follows from RoomAudio. */
  private lightning(): void {
    this.cameras.main.flash(140, 110, 130, 190)
  }

  /** Emits a GameEvent with the room context every event carries. */
  private emit(event: WatcherEvent | GameEvent): void {
    if (event.type === 'near_solution' || event.type === 'stuck') this.hintsGiven++
    gameEvents.emit({
      ...event,
      roomId: this.room.id,
      roomTitle: this.state.blueprint.title,
      timeRemainingSeconds: Math.ceil(this.state.timeRemainingMs / 1000),
    })
  }
}

function distanceToRect(x: number, y: number, rect: RoomObjectData): number {
  const nearestX = Phaser.Math.Clamp(x, rect.x, rect.x + rect.width)
  const nearestY = Phaser.Math.Clamp(y, rect.y, rect.y + rect.height)
  return Phaser.Math.Distance.Between(x, y, nearestX, nearestY)
}
