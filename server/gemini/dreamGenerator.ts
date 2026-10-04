// Gemini dreams up a new room each run: a dreamer with a life and a worry, a room that
// reflects it, voices from their memories, and a puzzle chain built from the catalog.
// Every result is validated; one retry gets the validation errors; then the handmade dream.

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import {
  BLUEPRINT_LIMITS,
  DOOR_ID,
  DREAM_MOODS,
  KIND_SPECS,
  MEMORY_KINDS,
  OBJECT_KINDS,
  SLOTS,
  SLOT_IDS,
  validateBlueprint,
} from '../../src/shared/blueprint.ts'
import type { BlueprintItem, BlueprintObject, Lock, RoomBlueprint } from '../../src/shared/blueprint.ts'
import { CAST_ROLES } from '../../src/shared/contract.ts'
import type { DreamResponse } from '../../src/shared/contract.ts'
import { FALLBACK_ROOM } from '../../src/shared/fallbackRoom.ts'

/**
 * Models to try, in order (initial implementation choices, measured live): flash-lite is
 * fast (~5s); when a model is overloaded (503) or rate-limited (429) the next one is tried.
 * GEMINI_DREAM_MODEL, if set, goes first.
 */
const MODEL_CHAIN = ['gemini-flash-lite-latest', 'gemini-flash-latest']
const ATTEMPT_TIMEOUT_MS = 20_000
const MAX_ATTEMPTS = 3

const MEMORY_SPEAKERS = CAST_ROLES.filter((role) => !role.startsWith('self_'))

// A random starting point per dream so runs don't converge on the same story.
// Initial implementation choices.
const WORRIES = [
  'a driving test in the morning',
  'moving to a new city alone next week',
  'telling their best friend a secret they have kept for years',
  'a first date tomorrow night',
  'the last day before their family dog is rehomed',
  'a cooking competition final',
  'their grandparent moving into a care home',
  'a big exam they have barely studied for',
  'their first day as a night-shift nurse',
  'performing stand-up comedy for the first time',
  'a job interview at their dream bakery',
  'their younger sibling leaving for college',
  'a swim meet they have trained a whole year for',
  'apologising to someone they hurt',
  'opening their tiny bookshop for the very first time',
  'their band playing its first real gig',
] as const
const NAMES_F = ['Ana', 'Priya', 'Zoe', 'Hana', 'Grace', 'Lucia', 'Nadia', 'Ruby', 'Mei', 'Imani'] as const
const NAMES_M = ['Omar', 'Theo', 'Kenji', 'Mateo', 'Sam', 'Ravi', 'Jonah', 'Felix', 'Diego', 'Kwame'] as const

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T
}

function dreamSeed(): string {
  const voice = Math.random() < 0.5 ? 'self_f' : 'self_m'
  const name = pick(voice === 'self_f' ? NAMES_F : NAMES_M)
  const age = 14 + Math.floor(Math.random() * 50)
  return `This dream's dreamer: ${name}, ${age}, voice ${voice}, worried about ${pick(WORRIES)}. Build the whole room, title, memories, and clues around that.`
}

// ---------------------------------------------------------------------------------------
// Output schema (flat locks so the model never has to pick a union shape)
// ---------------------------------------------------------------------------------------

const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) })
const lockSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['none', 'key', 'code'] },
    keyId: str('For key locks: the id of the key item.'),
    code: str('For code locks: 3-4 digits.'),
    clueIds: { type: 'array', items: { type: 'string' }, description: 'For code locks: one object or page id per digit, in order.' },
  },
  required: ['type'],
}

const DREAM_SCHEMA = {
  type: 'object',
  properties: {
    dreamer: {
      type: 'object',
      properties: {
        name: str(),
        age: { type: 'integer' },
        situation: str('What is weighing on them right now, one sentence.'),
        personality: str('How they think and talk, one sentence.'),
        voice: { type: 'string', enum: ['self_f', 'self_m'] },
        mood: { type: 'string', enum: [...DREAM_MOODS] },
      },
      required: ['name', 'age', 'situation', 'personality', 'voice', 'mood'],
    },
    title: str(),
    introLine: str(),
    objects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: str(),
          kind: { type: 'string', enum: [...OBJECT_KINDS] },
          slot: { type: 'string', enum: [...SLOT_IDS] },
          name: str(),
          description: str(),
          contains: str('Id of the item hidden inside, or empty.'),
          lock: lockSchema,
          memory: {
            type: 'object',
            properties: {
              speaker: { type: 'string', enum: MEMORY_SPEAKERS },
              speakerName: str(),
              text: str(),
            },
            required: ['speaker', 'speakerName', 'text'],
          },
        },
        required: ['id', 'kind', 'slot', 'name', 'description'],
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: str(),
          kind: { type: 'string', enum: ['key', 'page'] },
          name: str(),
          text: str(),
          cipherShift: { type: 'integer' },
          shiftClueId: str(),
        },
        required: ['id', 'kind', 'name'],
      },
    },
    door: {
      type: 'object',
      properties: { description: str(), lock: lockSchema },
      required: ['description', 'lock'],
    },
    solutionOrder: { type: 'array', items: { type: 'string' } },
    hints: {
      type: 'array',
      items: {
        type: 'object',
        properties: { targetId: str(), lines: { type: 'array', items: { type: 'string' } } },
        required: ['targetId', 'lines'],
      },
    },
  },
  required: ['dreamer', 'title', 'introLine', 'objects', 'items', 'door', 'solutionOrder', 'hints'],
}

// ---------------------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------------------

function catalogText(): string {
  const kinds = OBJECT_KINDS.map((kind) => {
    const spec = KIND_SPECS[kind]
    const notes = [
      `placement ${spec.placement === 'top' ? 'back wall only (T slots)' : spec.placement}`,
      spec.lockable ? 'can be locked' : 'cannot be locked',
      kind in MEMORY_KINDS ? 'MEMORY object: must have a memory, plays a voice' : '',
      spec.hangs ? 'hangs on the wall' : '',
    ].filter(Boolean)
    return `- ${kind}: ${notes.join(', ')}`
  })
  const slots = SLOT_IDS.map((id) => `${id} (${SLOTS[id].side === 'floor' ? 'floor' : `${SLOTS[id].side} wall`})`)
  return `Object kinds:\n${kinds.join('\n')}\n\nSlots (each used at most once): ${slots.join(', ')}\nplacement "wall" = T, L, or R slots; "floor" = F slots; "any" = any slot.`
}

const L = BLUEPRINT_LIMITS
const SYSTEM_INSTRUCTION = `You design one short escape-room dream for a cozy, slightly eerie pixel-art game.

THE PREMISE: the player wakes up inside a stranger's body, in their bedroom, inside their dream. The dreamer is an ordinary person with a relatable worry (an exam, a breakup, a new job, a move, a goodbye, a big performance...). The room reflects their life. Voices from their life (memories) and notes they wrote help the player piece together who they are. Opening the door = waking up. Tone: funny-anxious, warm, a little eerie. Simple everyday words.

${catalogText()}

RULES (the game rejects dreams that break them):
- ${L.minObjects}-${L.maxObjects} objects, unique ids (lowercase, no spaces). Never use the id "${DOOR_ID}" for an object.
- Include 2 or 3 MEMORY objects (answering_machine, radio, music_box), each with a memory from a different person in the dreamer's life. speakerName is who they are ("Mom", "Coach Rivera", "Night radio"). Memory text: natural speech, 1-3 sentences, max ${L.maxMemoryText} characters.
- Puzzle chain: solutionOrder lists ${L.minSteps}-${L.maxSteps} object ids in the order the player should open them, ending with "${DOOR_ID}". Simulate it: when a step is reached, any key it needs must already have been found in an earlier step, and every code clue that is a page must already have been found.
- Use one code lock (on a lockable object or the door): code is 3-4 digits; clueIds has exactly one id per digit, in order; the text of clueIds[i] (object description, memory text, or page text) must literally contain the digit code[i], written as a numeral (like "4", never "four"). Hiding the digits in memories is ideal.
- Optionally one cipher page: text is the plaintext (UPPERCASE letters and spaces, max ${L.maxCipherText} chars) that points to the next step; cipherShift 1-9; shiftClueId names an object or page whose text contains that digit.
- Every item is inside exactly one object (contains). Keys open key locks (lock.keyId). Unlocked objects use lock type "none".
- Include at least one red-herring object with nothing useful, written funny.
- hints: one entry per solutionOrder step (targetId = the step id, "${DOOR_ID}" for the door), 2-4 lines from vague to explicit, written as the dreamer's own thoughts. The LAST line must contain that object's exact name.
- Text lengths: title max ${L.maxTitle}, introLine max ${L.maxIntro} (third person, sets the scene, no name), names max ${L.maxName}, descriptions max ${L.maxDescription} written in first person as the dreamer ("My old radio..."), page text max ${L.maxPageText}, situation max ${L.maxSituation}, personality max ${L.maxPersonality}.
- dreamer.voice: self_f or self_m to match the dreamer. mood: the colour of the dream.

Make every dream different from the example: a new person, a new worry, new objects and clues.`

const EXAMPLE = JSON.stringify(toModelShape(FALLBACK_ROOM))

function toModelShape(bp: RoomBlueprint): unknown {
  const lock = (l?: Lock) => (l ? l : { type: 'none' })
  return { ...bp, objects: bp.objects.map((o) => ({ ...o, lock: lock(o.lock) })), door: { ...bp.door, lock: lock(bp.door.lock) } }
}

// ---------------------------------------------------------------------------------------
// Normalising model output into a RoomBlueprint
// ---------------------------------------------------------------------------------------

type RawLock = { type?: string; keyId?: string; code?: string; clueIds?: string[] }

function normaliseLock(raw: RawLock | undefined): Lock | undefined {
  if (!raw || raw.type === 'none' || !raw.type) return undefined
  if (raw.type === 'key') return { type: 'key', keyId: raw.keyId ?? '' }
  // Models sometimes format codes as "4-7-2"; keep the digits only.
  return { type: 'code', code: (raw.code ?? '').replace(/\D/g, ''), clueIds: raw.clueIds ?? [] }
}

function normalise(raw: unknown): RoomBlueprint {
  const bp = raw as RoomBlueprint & {
    objects: (BlueprintObject & { lock?: RawLock })[]
    door: { description: string; lock: RawLock }
  }
  const blank = (value: string | undefined) => (value && value.trim() ? value : undefined)
  return {
    ...bp,
    objects: bp.objects.map((o) => {
      const object: BlueprintObject = { id: o.id, kind: o.kind, slot: o.slot, name: o.name, description: o.description }
      const contains = blank(o.contains)
      const lock = normaliseLock(o.lock)
      if (contains) object.contains = contains
      if (lock) object.lock = lock
      if (o.memory?.text) object.memory = o.memory
      return object
    }),
    items: bp.items.map((i) => {
      const item: BlueprintItem = { id: i.id, kind: i.kind, name: i.name }
      if (blank(i.text)) item.text = i.text
      if (i.cipherShift) {
        item.cipherShift = i.cipherShift
        item.text = i.text?.toUpperCase()
        if (blank(i.shiftClueId)) item.shiftClueId = i.shiftClueId
      }
      return item
    }),
    door: { description: bp.door.description, lock: normaliseLock(bp.door.lock) ?? { type: 'key', keyId: '' } },
  }
}

/**
 * Fixes the one slip models make most: a code whose digits don't match its clue texts.
 * Each code digit is taken from what its clue actually says, and the final hint for that
 * lock is rewritten to match. Returns the blueprint unchanged if a clue has no digit at all.
 */
function repairCodes(bp: RoomBlueprint): RoomBlueprint {
  const textOf = (id: string): string => {
    if (id === DOOR_ID) return bp.door.description
    const obj = bp.objects.find((o) => o.id === id)
    if (obj) return obj.memory ? `${obj.description} ${obj.memory.text}` : obj.description
    return bp.items.find((i) => i.id === id)?.text ?? ''
  }
  const fix = (ownerId: string, ownerName: string, lock: Lock | undefined) => {
    if (lock?.type !== 'code' || lock.clueIds.length < 3) return
    const digits = lock.clueIds.map((id, i) => {
      const text = textOf(id)
      const wanted = lock.code[i]
      return wanted && text.includes(wanted) ? wanted : text.match(/\d/)?.[0]
    })
    if (digits.some((d) => d === undefined)) return
    const code = digits.join('')
    if (code === lock.code) return
    lock.code = code
    const ladder = bp.hints.find((h) => h.targetId === ownerId)
    if (ladder?.lines.length) ladder.lines[ladder.lines.length - 1] = `The ${ownerName} code is ${code.split('').join(', ')}.`
  }
  for (const obj of bp.objects) fix(obj.id, obj.name, obj.lock)
  fix(DOOR_ID, 'door', bp.door.lock)

  // Cipher shift: the engine encrypts the plaintext, so any shift its clue shows works.
  // If the clue shows no usable digit, the page simply stays readable.
  for (const item of bp.items) {
    if (!item.cipherShift) continue
    const clue = item.shiftClueId ? textOf(item.shiftClueId) : ''
    if (clue.includes(String(item.cipherShift))) continue
    const digit = clue.match(/[1-9]/)?.[0]
    if (digit) item.cipherShift = Number(digit)
    else {
      delete item.cipherShift
      delete item.shiftClueId
    }
  }
  return bp
}

// ---------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------

let client: GoogleGenAI | undefined

export async function generateDream(): Promise<DreamResponse> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    console.warn('[dream] using the handmade dream: GEMINI_API_KEY is not set')
    return { blueprint: FALLBACK_ROOM, source: 'fallback' }
  }
  client ??= new GoogleGenAI({ apiKey: key })
  const preferred = process.env.GEMINI_DREAM_MODEL?.trim()
  const models = preferred ? [preferred, ...MODEL_CHAIN.filter((m) => m !== preferred)] : MODEL_CHAIN
  let modelIndex = 0

  let feedback = ''
  const seed = dreamSeed()
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = models[Math.min(modelIndex, models.length - 1)] ?? MODEL_CHAIN[0]
    const started = Date.now()
    try {
      const response = await client.models.generateContent({
        model,
        contents: [
          `Example of a valid dream (JSON):\n${EXAMPLE}`,
          `Now design a brand-new dream. ${seed} Return only JSON.${feedback}`,
        ].join('\n\n'),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: DREAM_SCHEMA,
          temperature: 1.1,
          maxOutputTokens: 8192,
          ...(model.includes('lite') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        },
      })
      const blueprint = repairCodes(normalise(JSON.parse(response.text ?? '')))
      const result = validateBlueprint(blueprint)
      const seconds = ((Date.now() - started) / 1000).toFixed(1)
      if (result.ok) {
        console.info(`[dream] "${blueprint.title}" for ${blueprint.dreamer.name} (${model}, attempt ${attempt}, ${seconds}s)`)
        return { blueprint, source: 'gemini' }
      }
      console.warn(`[dream] attempt ${attempt} invalid (${model}, ${seconds}s): ${result.errors.slice(0, 5).join('; ')}`)
      feedback = `\n\nYour previous dream was rejected. Fix these problems:\n- ${result.errors.slice(0, 10).join('\n- ')}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[dream] attempt ${attempt} failed (${model}): ${message.slice(0, 200)}`)
      // Overloaded, rate-limited, or too slow: move on to the next model.
      if (/503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|abort/i.test(message)) modelIndex++
    }
  }
  console.warn('[dream] using the handmade dream')
  return { blueprint: FALLBACK_ROOM, source: 'fallback' }
}
