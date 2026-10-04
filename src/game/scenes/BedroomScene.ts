import Phaser from 'phaser'
import { gameEvents } from '../events'
import { InspectionTracker, repeatedInspectionEvent } from '../inspection'
import {
  PLACEHOLDER_COLORS,
  PLAYER_SIZE,
  PLAYER_TEXTURE_KEY,
  createPlaceholderTextures,
  objectTextureKey,
} from '../placeholderArt'
import { BEDROOM } from '../rooms/bedroom'
import type { RoomData, RoomObjectData } from '../rooms/types'

/** Player speed in pixels per second. */
const PLAYER_SPEED = 140
/** Max gap in pixels between the player's centre and an object's edge for E to work. */
const INTERACT_RANGE = PLAYER_SIZE / 2 + 12
const INSPECT_MESSAGE_MS = 2000
const EVENT_MESSAGE_MS = 4000

const HUD_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#ffffff',
  backgroundColor: '#000000aa',
  padding: { x: 6, y: 3 },
}

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key[]
  down: Phaser.Input.Keyboard.Key[]
  left: Phaser.Input.Keyboard.Key[]
  right: Phaser.Input.Keyboard.Key[]
}

export class BedroomScene extends Phaser.Scene {
  static readonly KEY = 'BedroomScene'

  private readonly room: RoomData = BEDROOM
  private readonly inspections = new InspectionTracker()
  private interactables: RoomObjectData[] = []
  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
  private moveKeys!: MoveKeys
  private interactKey!: Phaser.Input.Keyboard.Key
  // Temporary HUD, to be replaced by the src/ui layer.
  private promptText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private messageTimer?: Phaser.Time.TimerEvent

  constructor() {
    super(BedroomScene.KEY)
  }

  create(): void {
    const { room } = this
    createPlaceholderTextures(this, room)

    this.add.rectangle(0, 0, room.width, room.height, PLACEHOLDER_COLORS.floor).setOrigin(0)
    this.physics.world.setBounds(0, 0, room.width, room.height)

    const solids = this.physics.add.staticGroup()
    for (const wall of room.walls) {
      const rect = this.add
        .rectangle(wall.x, wall.y, wall.width, wall.height, PLACEHOLDER_COLORS.wall)
        .setOrigin(0)
      solids.add(rect)
    }

    for (const object of room.objects) {
      const image = this.add.image(object.x, object.y, objectTextureKey(object.id)).setOrigin(0)
      image.setDisplaySize(object.width, object.height)
      if (object.solid) solids.add(image)
      if (object.interactable) this.interactables.push(object)
    }

    this.player = this.physics.add.image(room.playerSpawn.x, room.playerSpawn.y, PLAYER_TEXTURE_KEY)
    this.player.setCollideWorldBounds(true)
    this.physics.add.collider(this.player, solids)

    this.createInput()
    this.createHud()

    const unsubscribe = gameEvents.subscribe((event) => {
      this.showMessage(`GameEvent: ${event.type} (${event.objectId} x${event.count ?? '?'})`, EVENT_MESSAGE_MS)
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe)
  }

  update(): void {
    this.updateMovement()

    const target = this.findInteractTarget()
    if (target) {
      this.promptText.setText(`Press E to inspect ${target.label}`).setVisible(true)
    } else {
      this.promptText.setVisible(false)
    }

    if (target && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.inspect(target)
    }
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

  private createHud(): void {
    const { width, height } = this.room
    this.promptText = this.add.text(width / 2, height - 8, '', HUD_TEXT_STYLE).setOrigin(0.5, 1).setDepth(10)
    this.promptText.setVisible(false)
    this.messageText = this.add.text(width / 2, 8, '', HUD_TEXT_STYLE).setOrigin(0.5, 0).setDepth(10)
    this.messageText.setVisible(false)
  }

  private updateMovement(): void {
    const isDown = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((key) => key.isDown)
    const { up, down, left, right } = this.moveKeys
    let dx = Number(isDown(right)) - Number(isDown(left))
    let dy = Number(isDown(down)) - Number(isDown(up))
    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2
      dy *= Math.SQRT1_2
    }
    this.player.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED)
  }

  /** The closest interactable object within range of the player, if any. */
  private findInteractTarget(): RoomObjectData | null {
    const { x, y } = this.player
    let best: RoomObjectData | null = null
    let bestDistance = INTERACT_RANGE
    for (const object of this.interactables) {
      const nearestX = Phaser.Math.Clamp(x, object.x, object.x + object.width)
      const nearestY = Phaser.Math.Clamp(y, object.y, object.y + object.height)
      const distance = Phaser.Math.Distance.Between(x, y, nearestX, nearestY)
      if (distance <= bestDistance) {
        best = object
        bestDistance = distance
      }
    }
    return best
  }

  private inspect(object: RoomObjectData): void {
    const count = this.inspections.inspect(object.id)
    this.showMessage(`You inspect the ${object.label.toLowerCase()}. (${count})`, INSPECT_MESSAGE_MS)

    const event = repeatedInspectionEvent(this.room.id, object.id, count)
    if (event) gameEvents.emit(event)
  }

  private showMessage(text: string, durationMs: number): void {
    this.messageText.setText(text).setVisible(true)
    this.messageTimer?.remove()
    this.messageTimer = this.time.delayedCall(durationMs, () => this.messageText.setVisible(false))
  }
}
