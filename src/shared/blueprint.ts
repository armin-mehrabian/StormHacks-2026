// Room blueprint: the single source of truth for one playthrough. Gemini writes it by
// choosing from the catalog and slots below; validateBlueprint() proves it is solvable
// before anyone plays it. The engine then owns all truth; the narrator only words things.
// Must stay free of DOM and Node APIs: both tsconfigs compile it.

// ---------------------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------------------

export const OBJECT_KINDS = [
  'bed',
  'desk',
  'bookshelf',
  'dresser',
  'wardrobe',
  'nightstand',
  'lamp',
  'rug',
  'plant',
  'painting',
  'clock',
  'trash_can',
  'lockbox',
] as const
export type ObjectKind = (typeof OBJECT_KINDS)[number]

/** 'top' = back wall only (the wall the player faces); 'wall' = any wall. */
export type Placement = 'top' | 'wall' | 'floor' | 'any'

export interface KindSpec {
  /** Footprint in tiles; always fits inside a 3x3 slot. */
  width: number
  height: number
  placement: Placement
  /** Blocks player movement. */
  solid: boolean
  /** Can hold a lock (key or code). */
  lockable: boolean
  /** Hangs on the back wall's face instead of standing on the floor. */
  hangs?: boolean
}

export const KIND_SPECS: Record<ObjectKind, KindSpec> = {
  bed: { width: 2, height: 3, placement: 'any', solid: true, lockable: false },
  desk: { width: 3, height: 2, placement: 'any', solid: true, lockable: true },
  bookshelf: { width: 3, height: 1, placement: 'top', solid: true, lockable: false },
  dresser: { width: 2, height: 1, placement: 'wall', solid: true, lockable: true },
  wardrobe: { width: 2, height: 2, placement: 'wall', solid: true, lockable: true },
  nightstand: { width: 1, height: 1, placement: 'any', solid: true, lockable: true },
  lamp: { width: 1, height: 1, placement: 'any', solid: true, lockable: false },
  rug: { width: 3, height: 2, placement: 'floor', solid: false, lockable: false },
  plant: { width: 1, height: 1, placement: 'any', solid: true, lockable: false },
  painting: { width: 2, height: 1, placement: 'top', solid: false, lockable: false, hangs: true },
  clock: { width: 1, height: 1, placement: 'top', solid: false, lockable: false, hangs: true },
  trash_can: { width: 1, height: 1, placement: 'any', solid: true, lockable: false },
  lockbox: { width: 1, height: 1, placement: 'any', solid: true, lockable: true },
}

// ---------------------------------------------------------------------------------------
// Room geometry: a 20x15 tile room with a 1-tile wall border and fixed 3x3 slots.
// Slots are spaced so any object fits without overlap and every object stays reachable.
// ---------------------------------------------------------------------------------------

export const ROOM_COLS = 20
export const ROOM_ROWS = 15

export type SlotSide = 'top' | 'left' | 'right' | 'floor'

export interface SlotSpec {
  /** Top-left tile of the 3x3 area. */
  col: number
  row: number
  side: SlotSide
}

export const SLOTS = {
  T1: { col: 1, row: 1, side: 'top' },
  T2: { col: 5, row: 1, side: 'top' },
  T3: { col: 12, row: 1, side: 'top' },
  T4: { col: 16, row: 1, side: 'top' },
  L1: { col: 1, row: 5, side: 'left' },
  L2: { col: 1, row: 9, side: 'left' },
  R1: { col: 16, row: 5, side: 'right' },
  R2: { col: 16, row: 9, side: 'right' },
  F1: { col: 6, row: 5, side: 'floor' },
  F2: { col: 11, row: 5, side: 'floor' },
  F3: { col: 5, row: 10, side: 'floor' },
  F4: { col: 12, row: 10, side: 'floor' },
} as const satisfies Record<string, SlotSpec>
export type SlotId = keyof typeof SLOTS
export const SLOT_IDS = Object.keys(SLOTS) as SlotId[]

/** The door is fixed in the top wall; the player spawns facing it from the bottom. */
export const DOOR_ID = 'door'
export const DOOR_TILES = { col: 9, row: 0, width: 2, height: 1 } as const
export const PLAYER_SPAWN_TILE = { col: 10, row: 13 } as const

export function slotAllows(slot: SlotId, placement: Placement): boolean {
  const side = SLOTS[slot].side
  if (placement === 'any') return true
  if (placement === 'top') return side === 'top'
  return (placement === 'wall') === (side !== 'floor')
}

// ---------------------------------------------------------------------------------------
// Blueprint shape
// ---------------------------------------------------------------------------------------

export type Lock =
  | { type: 'key'; keyId: string }
  /** Digits only. clueIds[i] names the object or page whose text contains code[i]. */
  | { type: 'code'; code: string; clueIds: string[] }

export interface BlueprintObject {
  id: string
  kind: ObjectKind
  slot: SlotId
  name: string
  /** Shown when inspected. May carry clues (a digit, a cipher shift). */
  description: string
  /** Item id hidden inside, if any. */
  contains?: string
  lock?: Lock
}

export interface BlueprintItem {
  id: string
  kind: 'key' | 'page'
  name: string
  /** Page text. For cipher pages this is the plaintext; the engine encrypts it. */
  text?: string
  /** Caesar shift (1-9) for cipher pages. */
  cipherShift?: number
  /** Object or page whose text contains the shift digit. Required with cipherShift. */
  shiftClueId?: string
}

export interface HintLadder {
  /** An object id from solutionOrder, or DOOR_ID. */
  targetId: string
  /** Vague to explicit. The last line must name the target. */
  lines: string[]
}

export interface RoomBlueprint {
  title: string
  introLine: string
  objects: BlueprintObject[]
  items: BlueprintItem[]
  door: { description: string; lock: Lock }
  /** Intended order of objects to open, ending with DOOR_ID. */
  solutionOrder: string[]
  hints: HintLadder[]
}

// ---------------------------------------------------------------------------------------
// Limits (initial implementation choices)
// ---------------------------------------------------------------------------------------

export const BLUEPRINT_LIMITS = {
  minObjects: 5,
  maxObjects: 12,
  maxItems: 6,
  minSteps: 3,
  maxSteps: 7,
  maxTitle: 60,
  maxIntro: 160,
  maxName: 30,
  maxDescription: 200,
  maxPageText: 300,
  maxCipherText: 40,
  maxHintLine: 160,
  minHintLines: 2,
  maxHintLines: 4,
} as const

// ---------------------------------------------------------------------------------------
// Cipher
// ---------------------------------------------------------------------------------------

/** Caesar shift over A-Z; other characters pass through. Input is upper-cased. */
export function caesarEncrypt(plaintext: string, shift: number): string {
  return plaintext.toUpperCase().replace(/[A-Z]/g, (letter) => {
    const index = (letter.charCodeAt(0) - 65 + shift) % 26
    return String.fromCharCode(65 + ((index + 26) % 26))
  })
}

/** The text a player actually sees for a page. */
export function pageDisplayText(item: BlueprintItem): string {
  const text = item.text ?? ''
  return item.cipherShift ? caesarEncrypt(text, item.cipherShift) : text
}

// ---------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------

export type ValidationResult = { ok: true } | { ok: false; errors: string[] }

/**
 * Structural checks plus a simulated playthrough of solutionOrder. Pure; used by the
 * server before serving a generated room and by the check script.
 */
export function validateBlueprint(bp: RoomBlueprint): ValidationResult {
  const errors: string[] = []
  const err = (message: string) => errors.push(message)
  const L = BLUEPRINT_LIMITS

  // --- shape and limits ---
  if (!bp.title || bp.title.length > L.maxTitle) err('title missing or too long')
  if (!bp.introLine || bp.introLine.length > L.maxIntro) err('introLine missing or too long')
  if (bp.objects.length < L.minObjects || bp.objects.length > L.maxObjects) {
    err(`objects must number ${L.minObjects}-${L.maxObjects}, got ${bp.objects.length}`)
  }
  if (bp.items.length > L.maxItems) err(`at most ${L.maxItems} items`)

  const objects = new Map<string, BlueprintObject>()
  const items = new Map<string, BlueprintItem>()
  const usedSlots = new Set<string>()
  const containedBy = new Map<string, string>()

  for (const item of bp.items) {
    if (items.has(item.id) || item.id === DOOR_ID) err(`duplicate or reserved item id "${item.id}"`)
    items.set(item.id, item)
    if (!item.name || item.name.length > L.maxName) err(`item "${item.id}" name missing or too long`)
    if (item.kind === 'page') {
      if (!item.text) err(`page "${item.id}" has no text`)
      else if (item.text.length > L.maxPageText) err(`page "${item.id}" text too long`)
    }
    if (item.cipherShift !== undefined) {
      if (item.kind !== 'page') err(`"${item.id}" has a cipher but is not a page`)
      if (!Number.isInteger(item.cipherShift) || item.cipherShift < 1 || item.cipherShift > 9) {
        err(`page "${item.id}" cipherShift must be 1-9`)
      }
      if ((item.text ?? '').length > L.maxCipherText) err(`cipher page "${item.id}" text too long`)
      if (!item.shiftClueId) err(`cipher page "${item.id}" needs shiftClueId`)
    }
  }

  for (const obj of bp.objects) {
    if (objects.has(obj.id) || items.has(obj.id) || obj.id === DOOR_ID) {
      err(`duplicate or reserved object id "${obj.id}"`)
    }
    objects.set(obj.id, obj)
    const spec = KIND_SPECS[obj.kind]
    if (!spec) {
      err(`object "${obj.id}" has unknown kind "${obj.kind}"`)
      continue
    }
    if (!(obj.slot in SLOTS)) err(`object "${obj.id}" has unknown slot "${obj.slot}"`)
    else if (!slotAllows(obj.slot, spec.placement)) err(`object "${obj.id}" (${obj.kind}) cannot go in slot ${obj.slot}`)
    if (usedSlots.has(obj.slot)) err(`slot ${obj.slot} used twice`)
    usedSlots.add(obj.slot)
    if (!obj.name || obj.name.length > L.maxName) err(`object "${obj.id}" name missing or too long`)
    if (!obj.description || obj.description.length > L.maxDescription) {
      err(`object "${obj.id}" description missing or too long`)
    }
    if (obj.lock && !spec.lockable) err(`object "${obj.id}" (${obj.kind}) cannot be locked`)
    if (obj.contains) {
      if (!items.has(obj.contains)) err(`object "${obj.id}" contains unknown item "${obj.contains}"`)
      if (containedBy.has(obj.contains)) err(`item "${obj.contains}" is in two objects`)
      containedBy.set(obj.contains, obj.id)
    }
  }
  if (!bp.door.description || bp.door.description.length > L.maxDescription) err('door description missing or too long')
  for (const item of bp.items) {
    if (!containedBy.has(item.id)) err(`item "${item.id}" is not inside any object`)
  }

  // Texts a clue can point at: object descriptions, the door, and page plaintext.
  const clueText = (id: string): string | undefined => {
    if (id === DOOR_ID) return bp.door.description
    return objects.get(id)?.description ?? items.get(id)?.text
  }
  const checkLock = (ownerId: string, lock: Lock) => {
    if (lock.type === 'key') {
      const key = items.get(lock.keyId)
      if (!key || key.kind !== 'key') err(`"${ownerId}" needs key "${lock.keyId}", which is not a key item`)
      return
    }
    if (!/^\d{3,4}$/.test(lock.code)) err(`"${ownerId}" code must be 3-4 digits`)
    if (lock.clueIds.length !== lock.code.length) err(`"${ownerId}" needs one clue per code digit`)
    lock.clueIds.forEach((clueId, i) => {
      const text = clueText(clueId)
      if (text === undefined) err(`"${ownerId}" clue "${clueId}" does not exist`)
      else if (!text.includes(lock.code[i] ?? '')) err(`"${ownerId}" clue "${clueId}" does not contain digit ${lock.code[i]}`)
    })
  }
  for (const obj of bp.objects) if (obj.lock) checkLock(obj.id, obj.lock)
  checkLock(DOOR_ID, bp.door.lock)

  for (const item of bp.items) {
    if (item.cipherShift && item.shiftClueId) {
      const text = clueText(item.shiftClueId)
      if (text === undefined) err(`cipher page "${item.id}" shift clue "${item.shiftClueId}" does not exist`)
      else if (!text.includes(String(item.cipherShift))) {
        err(`cipher page "${item.id}" shift clue "${item.shiftClueId}" does not contain ${item.cipherShift}`)
      }
    }
  }

  // --- solution order: simulate opening each step in turn ---
  const order = bp.solutionOrder
  if (order.length < L.minSteps || order.length > L.maxSteps) err(`solutionOrder must have ${L.minSteps}-${L.maxSteps} steps`)
  if (order[order.length - 1] !== DOOR_ID) err('solutionOrder must end with the door')
  if (new Set(order).size !== order.length) err('solutionOrder repeats a step')

  const inventory = new Set<string>()
  const available = (clueId: string) => objects.has(clueId) || clueId === DOOR_ID || inventory.has(clueId)
  for (const stepId of order) {
    const lock = stepId === DOOR_ID ? bp.door.lock : objects.get(stepId)?.lock
    if (stepId !== DOOR_ID && !objects.has(stepId)) {
      err(`solutionOrder step "${stepId}" is not an object`)
      continue
    }
    if (lock?.type === 'key' && !inventory.has(lock.keyId)) err(`step "${stepId}" needs key "${lock.keyId}" before it is found`)
    if (lock?.type === 'code') {
      for (const clueId of lock.clueIds) {
        if (!available(clueId)) err(`step "${stepId}" needs clue "${clueId}" before it is found`)
      }
    }
    const found = objects.get(stepId)?.contains
    if (found) {
      inventory.add(found)
      const item = items.get(found)
      if (item?.shiftClueId && !available(item.shiftClueId)) {
        err(`cipher page "${found}" shift clue "${item.shiftClueId}" is not available when the page is found`)
      }
    }
  }

  // --- hints: one ladder per step, escalating to naming the target ---
  const ladders = new Map(bp.hints.map((ladder) => [ladder.targetId, ladder]))
  for (const stepId of order) {
    const ladder = ladders.get(stepId)
    if (!ladder) {
      err(`no hints for step "${stepId}"`)
      continue
    }
    if (ladder.lines.length < L.minHintLines || ladder.lines.length > L.maxHintLines) {
      err(`hints for "${stepId}" must have ${L.minHintLines}-${L.maxHintLines} lines`)
    }
    if (ladder.lines.some((line) => !line || line.length > L.maxHintLine)) err(`a hint for "${stepId}" is empty or too long`)
    const target = objects.get(stepId)
    const targetNames = stepId === DOOR_ID ? ['door'] : [target?.name ?? stepId, (target?.kind ?? '').replace('_', ' ')]
    const last = (ladder.lines[ladder.lines.length - 1] ?? '').toLowerCase()
    if (!targetNames.some((name) => name && last.includes(name.toLowerCase()))) {
      err(`last hint for "${stepId}" must name "${targetNames[0]}"`)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
