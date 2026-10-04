// Engine truth for one playthrough: inventory, which objects are open, the timer, and
// win/lose. Built from a validated blueprint; nothing here waits on the network.

import { DOOR_ID } from '../shared/blueprint.ts'
import type { BlueprintItem, BlueprintObject, Lock, RoomBlueprint } from '../shared/blueprint.ts'

/** Initial implementation choice. */
export const TIME_LIMIT_MS = 5 * 60 * 1000

export type GameStatus = 'playing' | 'escaped' | 'time_up'

export type InspectResult =
  /** First open of an unlocked object, or an unlock with a held key. */
  | { type: 'opened'; item?: BlueprintItem; usedKey?: BlueprintItem }
  /** Already opened (or nothing inside). */
  | { type: 'empty' }
  | { type: 'needs_key' }
  | { type: 'needs_code'; digits: number }
  | { type: 'escaped'; usedKey?: BlueprintItem }

export type CodeResult = { type: 'wrong' } | { type: 'opened'; item?: BlueprintItem } | { type: 'escaped' }

export class GameState {
  readonly blueprint: RoomBlueprint
  private readonly objects = new Map<string, BlueprintObject>()
  private readonly items = new Map<string, BlueprintItem>()
  private readonly inventory: BlueprintItem[] = []
  private readonly opened = new Set<string>()
  private remainingMs = TIME_LIMIT_MS
  private currentStatus: GameStatus = 'playing'

  constructor(blueprint: RoomBlueprint) {
    this.blueprint = blueprint
    for (const object of blueprint.objects) this.objects.set(object.id, object)
    for (const item of blueprint.items) this.items.set(item.id, item)
  }

  get status(): GameStatus {
    return this.currentStatus
  }

  get timeRemainingMs(): number {
    return this.remainingMs
  }

  /** Advances the timer. Returns true on the tick that runs out of time. */
  tick(deltaMs: number): boolean {
    if (this.currentStatus !== 'playing') return false
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs)
    if (this.remainingMs > 0) return false
    this.currentStatus = 'time_up'
    return true
  }

  inventoryItems(): readonly BlueprintItem[] {
    return this.inventory
  }

  isOpened(objectId: string): boolean {
    return this.opened.has(objectId)
  }

  object(objectId: string): BlueprintObject | undefined {
    return this.objects.get(objectId)
  }

  displayName(objectId: string): string {
    return objectId === DOOR_ID ? 'Door' : this.objects.get(objectId)?.name ?? objectId
  }

  /** True if the object's text is a clue (a code digit or cipher shift), not just flavour. */
  isClue(objectId: string): boolean {
    const { blueprint } = this
    const locks = [blueprint.door.lock, ...blueprint.objects.map((o) => o.lock)]
    return (
      locks.some((lock) => lock?.type === 'code' && lock.clueIds.includes(objectId)) ||
      blueprint.items.some((item) => item.shiftClueId === objectId)
    )
  }

  description(objectId: string): string {
    return objectId === DOOR_ID ? this.blueprint.door.description : this.objects.get(objectId)?.description ?? ''
  }

  inspect(objectId: string): InspectResult {
    if (this.currentStatus !== 'playing') return { type: 'empty' }
    if (this.opened.has(objectId)) return { type: 'empty' }

    const lock = this.lockOf(objectId)
    if (lock?.type === 'code') return { type: 'needs_code', digits: lock.code.length }

    let usedKey: BlueprintItem | undefined
    if (lock?.type === 'key') {
      usedKey = this.inventory.find((item) => item.id === lock.keyId)
      if (!usedKey) return { type: 'needs_key' }
    }

    if (objectId === DOOR_ID) {
      this.currentStatus = 'escaped'
      return { type: 'escaped', usedKey }
    }
    return { type: 'opened', item: this.open(objectId), usedKey }
  }

  enterCode(objectId: string, code: string): CodeResult {
    const lock = this.lockOf(objectId)
    if (this.currentStatus !== 'playing' || lock?.type !== 'code' || this.opened.has(objectId)) return { type: 'wrong' }
    if (code !== lock.code) return { type: 'wrong' }
    if (objectId === DOOR_ID) {
      this.currentStatus = 'escaped'
      return { type: 'escaped' }
    }
    return { type: 'opened', item: this.open(objectId) }
  }

  /** The next intended step the player has not completed, for hints. */
  nextStepId(): string | undefined {
    return this.blueprint.solutionOrder.find((id) => !this.opened.has(id))
  }

  private lockOf(objectId: string): Lock | undefined {
    return objectId === DOOR_ID ? this.blueprint.door.lock : this.objects.get(objectId)?.lock
  }

  private open(objectId: string): BlueprintItem | undefined {
    this.opened.add(objectId)
    const itemId = this.objects.get(objectId)?.contains
    const item = itemId ? this.items.get(itemId) : undefined
    if (item) this.inventory.push(item)
    return item
  }
}
