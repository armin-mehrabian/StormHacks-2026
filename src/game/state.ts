// Engine truth for one playthrough: which act the dream is in, inventory, which objects are
// open, answers to story locks, the timer (with penalties), and win/lose. Built from a
// validated blueprint; nothing here waits on the network.

import { BLUEPRINT_LIMITS, DOOR_ID, objectAct } from '../shared/blueprint.ts'
import type { BlueprintItem, BlueprintObject, Lock, RoomBlueprint } from '../shared/blueprint.ts'

/** Initial implementation choice: room for three acts of story. */
export const TIME_LIMIT_MS = 7 * 60 * 1000

export type GameStatus = 'playing' | 'escaped' | 'time_up'

/** Locks the player solves through a puzzle UI rather than by holding an item. */
export type AnswerLock = Extract<Lock, { type: 'code' | 'word' | 'choice' | 'melody' | 'identity' | 'fear' }>

/** What the player submits: text for code/word/melody, an index for choice/fear, one text per identity blank. */
export type Answer = string | number | string[]

export type InspectResult =
  /** First open of an unlocked object, or an unlock with a held item. */
  | { type: 'opened'; item?: BlueprintItem; usedItem?: BlueprintItem; actChanged?: number }
  /** Already opened (or nothing inside). */
  | { type: 'empty' }
  | { type: 'needs_item' }
  | { type: 'needs_answer'; lock: AnswerLock }
  /** Opens only after another step (e.g. the door after facing the fear). */
  | { type: 'waiting' }
  | { type: 'escaped'; usedItem?: BlueprintItem }

export type AnswerResult =
  | { type: 'wrong'; penaltyMs: number }
  | { type: 'opened'; item?: BlueprintItem; actChanged?: number }
  | { type: 'escaped' }

export class GameState {
  readonly blueprint: RoomBlueprint
  private readonly objects = new Map<string, BlueprintObject>()
  private readonly items = new Map<string, BlueprintItem>()
  private readonly inventory: BlueprintItem[] = []
  private readonly opened = new Set<string>()
  private readonly discovered = new Set<string>()
  private readonly connected = new Set<string>()
  private readonly maxAct: number
  private currentAct = 1
  private remainingMs = TIME_LIMIT_MS
  private currentStatus: GameStatus = 'playing'

  constructor(blueprint: RoomBlueprint) {
    this.blueprint = blueprint
    for (const object of blueprint.objects) this.objects.set(object.id, object)
    for (const item of blueprint.items) this.items.set(item.id, item)
    this.maxAct = Math.max(1, ...blueprint.objects.map(objectAct))
  }

  get status(): GameStatus {
    return this.currentStatus
  }

  get timeRemainingMs(): number {
    return this.remainingMs
  }

  get act(): number {
    return this.currentAct
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

  /** Objects from later acts stay hidden until the dream shifts. The door is always there. */
  isVisible(objectId: string): boolean {
    return objectId === DOOR_ID || objectAct(this.objects.get(objectId)) <= this.currentAct
  }

  object(objectId: string): BlueprintObject | undefined {
    return this.objects.get(objectId)
  }

  displayName(objectId: string): string {
    return objectId === DOOR_ID ? 'Door' : this.objects.get(objectId)?.name ?? objectId
  }

  /** True if the object's text is a clue for some lock, not just flavour. */
  isClue(objectId: string): boolean {
    const { blueprint } = this
    const locks = [blueprint.door.lock, ...blueprint.objects.map((o) => o.lock)]
    return (
      locks.some((lock) => lock !== undefined && clueIdsOf(lock).includes(objectId)) ||
      blueprint.items.some((item) => item.shiftClueId === objectId)
    )
  }

  description(objectId: string): string {
    return objectId === DOOR_ID ? this.blueprint.door.description : this.objects.get(objectId)?.description ?? ''
  }

  inspect(objectId: string): InspectResult {
    if (this.currentStatus !== 'playing' || !this.isVisible(objectId)) return { type: 'empty' }
    this.discovered.add(objectId)
    if (this.opened.has(objectId)) return { type: 'empty' }

    const lock = this.lockOf(objectId)
    let usedItem: BlueprintItem | undefined
    switch (lock?.type) {
      case 'item':
        usedItem = this.inventory.find((item) => item.id === lock.itemId)
        if (!usedItem) return { type: 'needs_item' }
        break
      case 'step':
        if (!this.opened.has(lock.stepId)) return { type: 'waiting' }
        break
      case undefined:
        break
      default:
        return { type: 'needs_answer', lock: lock as AnswerLock }
    }

    if (objectId === DOOR_ID) {
      this.currentStatus = 'escaped'
      return { type: 'escaped', usedItem }
    }
    const { item, actChanged } = this.open(objectId)
    return { type: 'opened', item, usedItem, actChanged }
  }

  /** Checks a story-lock answer. Wrong answers cost time: the dream shudders. */
  answer(objectId: string, answer: Answer): AnswerResult {
    const lock = this.lockOf(objectId)
    if (this.currentStatus !== 'playing' || !lock || this.opened.has(objectId) || !isCorrect(lock, answer)) {
      const penaltyMs = Math.min(BLUEPRINT_LIMITS.penaltyMs, Math.max(0, this.remainingMs - 1000))
      this.remainingMs -= penaltyMs
      return { type: 'wrong', penaltyMs }
    }
    if (objectId === DOOR_ID) {
      this.currentStatus = 'escaped'
      return { type: 'escaped' }
    }
    return { type: 'opened', ...this.open(objectId) }
  }

  /** Records that the player has read an item (pages count as clues once found). */
  markDiscovered(id: string): void {
    this.discovered.add(id)
  }

  /**
   * Locks whose every clue has now been discovered, reported once each: the moment the
   * dreamer can connect the dots out loud.
   */
  newlyConnected(): string[] {
    const result: string[] = []
    const owners: [string, Lock | undefined][] = [
      [DOOR_ID, this.blueprint.door.lock],
      ...this.blueprint.objects.map((o): [string, Lock | undefined] => [o.id, o.lock]),
    ]
    for (const [ownerId, lock] of owners) {
      if (!lock || this.connected.has(ownerId) || this.opened.has(ownerId) || !this.isVisible(ownerId)) continue
      const clues = clueIdsOf(lock)
      if (clues.length < 2 || !clues.every((id) => this.discovered.has(id))) continue
      this.connected.add(ownerId)
      result.push(ownerId)
    }
    return result
  }

  /** The next intended step the player has not completed, for hints. */
  nextStepId(): string | undefined {
    return this.blueprint.solutionOrder.find((id) => !this.opened.has(id))
  }

  private lockOf(objectId: string): Lock | undefined {
    return objectId === DOOR_ID ? this.blueprint.door.lock : this.objects.get(objectId)?.lock
  }

  private open(objectId: string): { item?: BlueprintItem; actChanged?: number } {
    this.opened.add(objectId)
    const itemId = this.objects.get(objectId)?.contains
    const item = itemId ? this.items.get(itemId) : undefined
    if (item) {
      this.inventory.push(item)
      this.discovered.add(item.id)
    }
    // The dream shifts once every solution step of the current act is done.
    const before = this.currentAct
    const order = this.blueprint.solutionOrder
    while (
      this.currentAct < this.maxAct &&
      order.every((id) => id === DOOR_ID || objectAct(this.objects.get(id)) !== this.currentAct || this.opened.has(id))
    ) {
      this.currentAct++
    }
    return { item, actChanged: this.currentAct !== before ? this.currentAct : undefined }
  }
}

/** Every object or page a lock's answer is drawn from. */
export function clueIdsOf(lock: Lock): string[] {
  switch (lock.type) {
    case 'code':
    case 'word':
    case 'choice':
      return lock.clueIds
    case 'identity':
      return [...new Set(lock.questions.flatMap((q) => q.clueIds))]
    case 'fear':
      return lock.supportIds
    case 'melody':
      return [lock.sourceId]
    default:
      return []
  }
}

function isCorrect(lock: Lock, answer: Answer): boolean {
  const same = (a: unknown, b: string) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()
  switch (lock.type) {
    case 'code':
      return answer === lock.code
    case 'word':
      return same(answer, lock.word)
    case 'melody':
      return same(answer, lock.notes)
    case 'choice':
    case 'fear':
      return answer === lock.answer
    case 'identity':
      return Array.isArray(answer) && lock.questions.every((q, i) => same(answer[i], q.answer))
    default:
      return false
  }
}
