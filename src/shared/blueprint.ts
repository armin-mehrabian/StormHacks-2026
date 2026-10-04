// Room blueprint: the single source of truth for one playthrough. Gemini writes it by
// choosing from the catalog and slots below; validateBlueprint() proves it is solvable
// before anyone plays it. The engine then owns all truth; the narrator only words things.
// Must stay free of DOM and Node APIs: both tsconfigs compile it.

import type { CastRole } from './contract.ts'

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
  // Memory objects: inspecting one plays a voice from the dreamer's life.
  'answering_machine',
  'radio',
  'music_box',
  'record_player',
  // Story puzzle objects.
  'mirror',
  'toy_piano',
  'fear',
  // More furniture and things, for variety.
  'guitar',
  'easel',
  'aquarium',
  'globe',
  'typewriter',
  'teddy_bear',
  'toy_chest',
  'computer',
  'telescope',
  'coat_rack',
  'trophy_shelf',
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
  answering_machine: { width: 1, height: 1, placement: 'any', solid: true, lockable: true },
  radio: { width: 1, height: 1, placement: 'any', solid: true, lockable: true },
  music_box: { width: 1, height: 1, placement: 'any', solid: true, lockable: true },
  mirror: { width: 1, height: 1, placement: 'top', solid: false, lockable: true, hangs: true },
  toy_piano: { width: 2, height: 1, placement: 'any', solid: true, lockable: true },
  fear: { width: 2, height: 2, placement: 'floor', solid: false, lockable: true },
  record_player: { width: 1, height: 1, placement: 'any', solid: true, lockable: true },
  guitar: { width: 1, height: 2, placement: 'wall', solid: true, lockable: false },
  easel: { width: 1, height: 2, placement: 'any', solid: true, lockable: false },
  aquarium: { width: 2, height: 1, placement: 'any', solid: true, lockable: false },
  globe: { width: 1, height: 1, placement: 'any', solid: true, lockable: false },
  typewriter: { width: 1, height: 1, placement: 'any', solid: true, lockable: false },
  teddy_bear: { width: 1, height: 1, placement: 'any', solid: true, lockable: false },
  toy_chest: { width: 2, height: 1, placement: 'any', solid: true, lockable: true },
  computer: { width: 2, height: 1, placement: 'any', solid: true, lockable: true },
  telescope: { width: 1, height: 2, placement: 'any', solid: true, lockable: false },
  coat_rack: { width: 1, height: 2, placement: 'wall', solid: true, lockable: false },
  trophy_shelf: { width: 2, height: 1, placement: 'top', solid: true, lockable: false },
}

/**
 * Theme tags per kind, so a dream's furniture can fit the dreamer (a musician's room has a
 * guitar). Initial implementation choice.
 */
export const KIND_TAGS: Partial<Record<ObjectKind, readonly string[]>> = {
  guitar: ['music'],
  record_player: ['music', 'cozy'],
  easel: ['art'],
  painting: ['art'],
  trophy_shelf: ['sport'],
  computer: ['work', 'study'],
  typewriter: ['work', 'study', 'art'],
  globe: ['study', 'travel'],
  desk: ['study', 'work'],
  bookshelf: ['study'],
  aquarium: ['nature', 'care'],
  plant: ['nature'],
  telescope: ['night', 'study'],
  teddy_bear: ['cozy', 'family', 'care'],
  toy_chest: ['family', 'cozy'],
  coat_rack: ['travel', 'work'],
  rug: ['cozy'],
  bed: ['cozy'],
}

/** Lock types that only make sense on one kind, and kinds that require them. */
export const KIND_LOCKS: Partial<Record<ObjectKind, Lock['type']>> = {
  mirror: 'identity',
  toy_piano: 'melody',
  fear: 'fear',
}

/** Kinds that can hold a memory, and how the memory sounds when played. */
export const MEMORY_KINDS = {
  answering_machine: 'phone',
  radio: 'radio',
  music_box: 'room',
  record_player: 'vinyl',
} as const satisfies Partial<Record<ObjectKind, MemoryEffect>>
export type MemoryEffect = 'phone' | 'radio' | 'vinyl' | 'room'

export function memoryEffect(kind: ObjectKind): MemoryEffect | undefined {
  return (MEMORY_KINDS as Partial<Record<ObjectKind, MemoryEffect>>)[kind]
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

/** Notes the toy piano can play, and the music box can hum. */
export const NOTES = ['C', 'D', 'E', 'G', 'A'] as const

/** One blank on the identity board ("My name is ___"). */
export interface IdentityQuestion {
  prompt: string
  answer: string
  /** Two plausible wrong answers. */
  decoys: string[]
  /** Objects or pages whose text contains the answer. */
  clueIds: string[]
}

export type Lock =
  /** Needs an item the player holds: a key, a cassette, batteries... Used automatically. */
  | { type: 'item'; itemId: string }
  /** Digits only. clueIds[i] names the object or page whose text contains code[i]. */
  | { type: 'code'; code: string; clueIds: string[] }
  /** A 3-8 letter word from the story (a pet's name, a song) that appears in a clue. */
  | { type: 'word'; word: string; clueIds: string[] }
  /** A story question with three options; the right one appears in a clue. */
  | { type: 'choice'; question: string; options: string[]; answer: number; clueIds: string[] }
  /** Tune the dial to a station (e.g. "93.5", 88.0-107.9) named in a clue. Radio only. */
  | { type: 'tune'; frequency: string; clueIds: string[] }
  /** Replay the melody the music box (sourceId) plays. Toy piano only. */
  | { type: 'melody'; notes: string; sourceId: string }
  /** "Who am I?" Mirror only. */
  | { type: 'identity'; questions: IdentityQuestion[] }
  /** Facing the fear: choose what to tell yourself. supportIds are the memories behind it. Fear only. */
  | { type: 'fear'; prompt: string; options: string[]; answer: number; supportIds: string[] }
  /** Opens once another step (stepId) is done, e.g. the door after facing the fear. */
  | { type: 'step'; stepId: string }

/** A voice from the dreamer's life, played by a memory object. */
export interface Memory {
  speaker: CastRole
  /** Who it is, e.g. "Mom". */
  speakerName: string
  /** Spoken by ElevenLabs and shown as a transcript. May carry clues. */
  text: string
}

export interface BlueprintObject {
  id: string
  kind: ObjectKind
  slot: SlotId
  name: string
  /** Shown when inspected, in the dreamer's first person. May carry clues. */
  description: string
  /** Item id hidden inside, if any. */
  contains?: string
  lock?: Lock
  /** Only on memory kinds (answering machine, radio, music box). */
  memory?: Memory
  /** Which act it appears in (1-3, default 1). Later acts fade in as the dream shifts. */
  act?: 1 | 2 | 3
  /** Music box only: the melody it plays, as notes from NOTES (e.g. "EDCD"). */
  melody?: string
}

export const DREAM_MOODS = ['violet', 'blue', 'amber', 'green', 'rose'] as const
export type DreamMood = (typeof DREAM_MOODS)[number]

/** Whose dream this is. The inner voice only says the name and situation on waking. */
export interface Dreamer {
  name: string
  age: number
  /** What is weighing on them, e.g. "first violin audition at 9am tomorrow". */
  situation: string
  /** How they think and talk. */
  personality: string
  /** Their inner voice. */
  voice: 'self_f' | 'self_m'
  /** Colour tint of the dream. */
  mood: DreamMood
}

export interface BlueprintItem {
  id: string
  /** key and tool items open item locks; pages are read. */
  kind: 'key' | 'tool' | 'page'
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
  dreamer: Dreamer
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
  maxItems: 8,
  minSteps: 3,
  maxSteps: 10,
  maxTitle: 60,
  maxIntro: 160,
  maxName: 30,
  maxDescription: 200,
  maxPageText: 300,
  maxCipherText: 40,
  maxHintLine: 160,
  minHintLines: 2,
  maxHintLines: 4,
  maxMemoryText: 260,
  maxQuestion: 120,
  maxOption: 120,
  maxAnswer: 40,
  minIdentityQuestions: 2,
  maxIdentityQuestions: 4,
  penaltyMs: 15_000,
  maxSituation: 160,
  maxPersonality: 160,
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
  const d = bp.dreamer
  if (!d) err('dreamer missing')
  else {
    if (!d.name || d.name.length > L.maxName) err('dreamer name missing or too long')
    if (!Number.isInteger(d.age) || d.age < 8 || d.age > 99) err('dreamer age must be 8-99')
    if (!d.situation || d.situation.length > L.maxSituation) err('dreamer situation missing or too long')
    if (!d.personality || d.personality.length > L.maxPersonality) err('dreamer personality missing or too long')
    if (d.voice !== 'self_f' && d.voice !== 'self_m') err('dreamer voice must be self_f or self_m')
    if (!(DREAM_MOODS as readonly string[]).includes(d.mood)) err('dreamer mood is not a known mood')
  }
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
    if (!['key', 'tool', 'page'].includes(item.kind)) err(`item "${item.id}" has unknown kind "${item.kind}"`)
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
    if (obj.act !== undefined && ![1, 2, 3].includes(obj.act)) err(`object "${obj.id}" act must be 1, 2, or 3`)
    if (obj.lock && !spec.lockable) err(`object "${obj.id}" (${obj.kind}) cannot be locked`)
    const required = KIND_LOCKS[obj.kind]
    if (required && obj.lock?.type !== required) err(`object "${obj.id}" (${obj.kind}) needs a ${required} lock`)
    for (const [kind, type] of Object.entries(KIND_LOCKS)) {
      if (obj.lock?.type === type && obj.kind !== kind) err(`object "${obj.id}": ${type} locks only go on a ${kind}`)
    }
    if (obj.lock?.type === 'tune' && obj.kind !== 'radio') err(`object "${obj.id}": tune locks only go on a radio`)
    if (obj.memory) {
      if (!memoryEffect(obj.kind)) err(`object "${obj.id}" (${obj.kind}) cannot hold a memory`)
      if (!obj.memory.text || obj.memory.text.length > L.maxMemoryText) err(`memory in "${obj.id}" missing or too long`)
      if (!obj.memory.speakerName || obj.memory.speakerName.length > L.maxName) err(`memory in "${obj.id}" needs a speakerName`)
      if (obj.memory.speaker === 'self_f' || obj.memory.speaker === 'self_m') err(`memory in "${obj.id}" must be someone else's voice`)
    } else if (memoryEffect(obj.kind)) {
      err(`memory object "${obj.id}" (${obj.kind}) has no memory`)
    }
    if (obj.melody !== undefined) {
      if (obj.kind !== 'music_box') err(`only a music box can have a melody ("${obj.id}")`)
      if (!isMelody(obj.melody)) err(`melody of "${obj.id}" must be 3-6 notes from ${NOTES.join('')}`)
    }
    if (obj.contains) {
      if (!items.has(obj.contains)) err(`object "${obj.id}" contains unknown item "${obj.contains}"`)
      if (containedBy.has(obj.contains)) err(`item "${obj.contains}" is in two objects`)
      containedBy.set(obj.contains, obj.id)
    }
  }
  if (!bp.door.description || bp.door.description.length > L.maxDescription) err('door description missing or too long')
  if (['melody', 'identity', 'fear', 'choice', 'tune'].includes(bp.door.lock.type)) err(`the door cannot have a ${bp.door.lock.type} lock`)
  for (const item of bp.items) {
    if (!containedBy.has(item.id)) err(`item "${item.id}" is not inside any object`)
  }

  // Texts a clue can point at: object descriptions (plus any memory), the door, and page plaintext.
  const clueText = (id: string): string | undefined => {
    if (id === DOOR_ID) return bp.door.description
    const obj = objects.get(id)
    if (obj) return obj.memory ? `${obj.description} ${obj.memory.speakerName}: ${obj.memory.text}` : obj.description
    return items.get(id)?.text
  }
  const cluesMention = (ownerId: string, clueIds: string[], answer: string): boolean => {
    let found = false
    for (const clueId of clueIds) {
      const text = clueText(clueId)
      if (text === undefined) err(`"${ownerId}" clue "${clueId}" does not exist`)
      else if (mentions(text, answer)) found = true
    }
    return found
  }
  const checkOptions = (ownerId: string, options: string[], answer: number) => {
    if (options.length !== 3) err(`"${ownerId}" needs exactly 3 options`)
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) err(`"${ownerId}" answer must be an option index`)
    if (options.some((o) => !o || o.length > L.maxOption)) err(`"${ownerId}" has an empty or too-long option`)
  }

  const checkLock = (ownerId: string, lock: Lock) => {
    switch (lock.type) {
      case 'item': {
        const item = items.get(lock.itemId)
        if (!item || item.kind === 'page') err(`"${ownerId}" needs item "${lock.itemId}", which is not a key or tool`)
        return
      }
      case 'code':
        if (!/^\d{3,4}$/.test(lock.code)) err(`"${ownerId}" code must be 3-4 digits`)
        if (lock.clueIds.length !== lock.code.length) err(`"${ownerId}" needs one clue per code digit`)
        lock.clueIds.forEach((clueId, i) => {
          const text = clueText(clueId)
          if (text === undefined) err(`"${ownerId}" clue "${clueId}" does not exist`)
          else if (!text.includes(lock.code[i] ?? '')) err(`"${ownerId}" clue "${clueId}" does not contain digit ${lock.code[i]}`)
        })
        return
      case 'word':
        if (!/^[A-Za-z]{3,8}$/.test(lock.word)) err(`"${ownerId}" word must be 3-8 letters`)
        if (!lock.clueIds.length || !cluesMention(ownerId, lock.clueIds, lock.word)) err(`"${ownerId}" word "${lock.word}" is not in its clues`)
        return
      case 'choice':
        if (!lock.question || lock.question.length > L.maxQuestion) err(`"${ownerId}" question missing or too long`)
        checkOptions(ownerId, lock.options, lock.answer)
        if (!cluesMention(ownerId, lock.clueIds, lock.options[lock.answer] ?? '\u0000')) err(`"${ownerId}" right answer is not in its clues`)
        lock.options.forEach((option, i) => {
          if (i !== lock.answer && lock.clueIds.some((id) => mentions(clueText(id) ?? '', option))) {
            err(`"${ownerId}" wrong option "${option}" also appears in the clues`)
          }
        })
        return
      case 'tune':
        if (!isFrequency(lock.frequency)) err(`"${ownerId}" frequency must look like 93.5 (88.0-107.9)`)
        if (!lock.clueIds.length || !cluesMention(ownerId, lock.clueIds, lock.frequency)) {
          err(`"${ownerId}" frequency ${lock.frequency} is not in its clues`)
        }
        return
      case 'melody': {
        if (!isMelody(lock.notes)) err(`"${ownerId}" melody must be 3-6 notes from ${NOTES.join('')}`)
        const source = objects.get(lock.sourceId)
        if (!source || source.kind !== 'music_box' || source.melody !== lock.notes) {
          err(`"${ownerId}" melody must match the melody of music box "${lock.sourceId}"`)
        }
        return
      }
      case 'identity':
        if (lock.questions.length < L.minIdentityQuestions || lock.questions.length > L.maxIdentityQuestions) {
          err(`"${ownerId}" needs ${L.minIdentityQuestions}-${L.maxIdentityQuestions} identity questions`)
        }
        lock.questions.forEach((q, i) => {
          const label = `"${ownerId}" identity question ${i + 1}`
          if (!q.prompt || q.prompt.length > L.maxQuestion) err(`${label} prompt missing or too long`)
          if (!q.answer || q.answer.length > L.maxAnswer) err(`${label} answer missing or too long`)
          if (q.decoys.length !== 2 || q.decoys.some((dc) => !dc || dc.length > L.maxAnswer || same(dc, q.answer))) {
            err(`${label} needs 2 decoys different from the answer`)
          }
          if (!cluesMention(ownerId, q.clueIds, q.answer)) err(`${label} answer "${q.answer}" is not in its clues`)
          for (const decoy of q.decoys) {
            if (q.clueIds.some((id) => mentions(clueText(id) ?? '', decoy))) err(`${label} decoy "${decoy}" appears in its clues`)
          }
        })
        return
      case 'fear':
        if (!lock.prompt || lock.prompt.length > L.maxQuestion) err(`"${ownerId}" fear prompt missing or too long`)
        checkOptions(ownerId, lock.options, lock.answer)
        if (!lock.supportIds.length) err(`"${ownerId}" fear needs supporting memories`)
        for (const id of lock.supportIds) if (clueText(id) === undefined) err(`"${ownerId}" support "${id}" does not exist`)
        return
      case 'step':
        if (lock.stepId !== DOOR_ID && !objects.has(lock.stepId)) err(`"${ownerId}" waits for unknown step "${lock.stepId}"`)
        return
    }
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

  // --- solution order: simulate the dream act by act ---
  const order = bp.solutionOrder
  if (order.length < L.minSteps || order.length > L.maxSteps) err(`solutionOrder must have ${L.minSteps}-${L.maxSteps} steps`)
  if (order[order.length - 1] !== DOOR_ID) err('solutionOrder must end with the door')
  if (new Set(order).size !== order.length) err('solutionOrder repeats a step')

  const stepActs = order.map((id) => (id === DOOR_ID ? 0 : objectAct(objects.get(id))))
  for (let i = 1; i < stepActs.length; i++) {
    const act = stepActs[i] ?? 0
    if (act && act < (stepActs[i - 1] ?? 0)) err(`solutionOrder goes back to act ${act} at "${order[i]}"`)
  }
  const maxAct = Math.max(1, ...bp.objects.map(objectAct))
  for (let act = 1; act <= maxAct; act++) {
    if (!stepActs.includes(act)) err(`act ${act} has objects but no solution steps, so the dream cannot move past it`)
  }

  const inventory = new Set<string>()
  const opened = new Set<string>()
  let currentAct = 1
  const visible = (obj: BlueprintObject | undefined) => obj !== undefined && objectAct(obj) <= currentAct
  const available = (clueId: string) => clueId === DOOR_ID || visible(objects.get(clueId)) || inventory.has(clueId)
  const needClues = (stepId: string, clueIds: string[]) => {
    for (const clueId of clueIds) if (!available(clueId)) err(`step "${stepId}" needs clue "${clueId}" before it is found`)
  }
  for (const stepId of order) {
    const obj = objects.get(stepId)
    if (stepId !== DOOR_ID && !obj) {
      err(`solutionOrder step "${stepId}" is not an object`)
      continue
    }
    if (obj && !visible(obj)) err(`step "${stepId}" is in act ${objectAct(obj)} but the dream is still in act ${currentAct}`)
    const lock = stepId === DOOR_ID ? bp.door.lock : obj?.lock
    switch (lock?.type) {
      case 'item':
        if (!inventory.has(lock.itemId)) err(`step "${stepId}" needs "${lock.itemId}" before it is found`)
        break
      case 'code':
      case 'word':
      case 'choice':
      case 'tune':
        needClues(stepId, lock.clueIds)
        break
      case 'melody':
        needClues(stepId, [lock.sourceId])
        break
      case 'identity':
        for (const q of lock.questions) needClues(stepId, q.clueIds)
        break
      case 'fear':
        needClues(stepId, lock.supportIds)
        break
      case 'step':
        if (!opened.has(lock.stepId)) err(`step "${stepId}" waits for "${lock.stepId}", which is not done yet`)
        break
      default:
        break
    }
    opened.add(stepId)
    const found = obj?.contains
    if (found) {
      inventory.add(found)
      const item = items.get(found)
      if (item?.shiftClueId && !available(item.shiftClueId)) {
        err(`cipher page "${found}" shift clue "${item.shiftClueId}" is not available when the page is found`)
      }
    }
    // The dream shifts once every step of the current act is done.
    while (currentAct < maxAct && order.every((id, i) => stepActs[i] !== currentAct || opened.has(id))) currentAct++
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

/** The act an object appears in (1 when unset). */
export function objectAct(obj: BlueprintObject | undefined): number {
  return obj?.act ?? 1
}

/** A radio frequency with one decimal in the FM band, e.g. "93.5". */
export function isFrequency(value: string): boolean {
  return /^(8[89]|9\d|10[0-7])\.\d$/.test(value)
}

function isMelody(notes: string): boolean {
  return new RegExp(`^[${NOTES.join('')}]{3,6}$`).test(notes)
}

/** Case-insensitive "does this text mention that answer". */
export function mentions(text: string, answer: string): boolean {
  return answer.trim().length > 0 && text.toLowerCase().includes(answer.trim().toLowerCase())
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
