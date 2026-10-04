// Gemini dreams up a new story each run; the engine builds the puzzle around it.
//
// The engine randomises a three-act puzzle skeleton (which furniture, where, which memory
// needs which tool, the melody) that is solvable by construction. Gemini writes everything
// human: the dreamer, their worry, the people in their life and what they say, every
// description, page, the fear and its choices, and the hints. The engine then patches the
// few facts the puzzle relies on (a number in each voice, the name, the worry), validates,
// and retries; the handmade dream is the last resort.

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import {
  BLUEPRINT_LIMITS,
  DOOR_ID,
  DREAM_MOODS,
  KIND_SPECS,
  NOTES,
  SLOT_IDS,
  mentions,
  slotAllows,
  validateBlueprint,
} from '../../src/shared/blueprint.ts'
import type { BlueprintItem, BlueprintObject, HintLadder, Memory, ObjectKind, RoomBlueprint, SlotId } from '../../src/shared/blueprint.ts'
import { CAST_ROLES } from '../../src/shared/contract.ts'
import type { CastRole, DreamResponse } from '../../src/shared/contract.ts'
import { FALLBACK_ROOM } from '../../src/shared/fallbackRoom.ts'

/** Models to try, in order; an overloaded or rate-limited model hands over to the next. */
const MODEL_CHAIN = ['gemini-flash-lite-latest', 'gemini-flash-latest']
const ATTEMPT_TIMEOUT_MS = 20_000
const MAX_ATTEMPTS = 3

const L = BLUEPRINT_LIMITS
const MEMORY_SPEAKERS = CAST_ROLES.filter((role) => !role.startsWith('self_'))

// ---------------------------------------------------------------------------------------
// Puzzle skeleton (engine-made, random each run)
// ---------------------------------------------------------------------------------------

type MemoryKind = 'answering_machine' | 'radio' | 'music_box'
type Role =
  | 'diary_box'
  | 'tool_box'
  | 'memory_a'
  | 'memory_b'
  | 'memory_c'
  | 'piano'
  | 'lockbox'
  | 'mirror'
  | 'fear'
  | 'herring_1'
  | 'herring_2'
  | 'herring_3'

const ROLES: Role[] = ['diary_box', 'tool_box', 'memory_a', 'memory_b', 'memory_c', 'piano', 'lockbox', 'mirror', 'fear', 'herring_1', 'herring_2', 'herring_3']
const MEMORY_ROLES = ['memory_a', 'memory_b', 'memory_c'] as const

/** What each role is, for the writer. */
const ROLE_PURPOSE: Record<Role, string> = {
  diary_box: 'holds the diary page (act 1)',
  tool_box: 'hides the small tool that makes memory A play (act 1)',
  memory_a: 'memory A: needs the tool to play (act 1)',
  memory_b: 'memory B (appears in act 2)',
  memory_c: 'memory C (appears in act 2)',
  piano: 'a toy piano; replaying the music box song opens it and reveals an old photo (act 2)',
  lockbox: 'a box with a 3-digit lock; the digits are the numbers said in memories A, B, C (act 2)',
  mirror: 'a mirror where I must remember who I am (act 2)',
  fear: 'the fear made visible, a symbolic image of the worry (act 3)',
  herring_1: 'a funny red herring with nothing useful (act 1)',
  herring_2: 'a funny red herring with nothing useful (act 1)',
  herring_3: 'a funny red herring with nothing useful (appears in act 2)',
}

const ROLE_ACT: Record<Role, 1 | 2 | 3> = {
  diary_box: 1,
  tool_box: 1,
  memory_a: 1,
  herring_1: 1,
  herring_2: 1,
  memory_b: 2,
  memory_c: 2,
  piano: 2,
  lockbox: 2,
  mirror: 2,
  herring_3: 2,
  fear: 3,
}

const TOOL_FOR: Record<MemoryKind, string> = {
  answering_machine: 'a cassette tape',
  radio: 'batteries',
  music_box: 'a tiny winding key',
}

interface Skeleton {
  kinds: Record<Role, ObjectKind>
  slots: Record<Role, SlotId>
  melody: string
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T
}

function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

function randomMelody(): string {
  const length = 4 + Math.floor(Math.random() * 3)
  let notes = ''
  while (notes.length < length) {
    const note = pick(NOTES)
    if (notes.endsWith(note + note)) continue // no three in a row
    notes += note
  }
  return notes
}

/** Random furniture and slots; tries combinations until every object fits. */
function makeSkeleton(): Skeleton {
  for (let attempt = 0; attempt < 50; attempt++) {
    const [a, b, c] = shuffle<MemoryKind>(['answering_machine', 'radio', 'music_box'])
    const herrings = shuffle<ObjectKind>(['bed', 'plant', 'painting', 'clock', 'rug', 'dresser']).slice(0, 3)
    const toolBox = pick((['lamp', 'wardrobe', 'trash_can', 'nightstand'] as ObjectKind[]).filter((k) => !herrings.includes(k)))
    const diaryBox = pick((['bookshelf', 'desk', 'nightstand'] as ObjectKind[]).filter((k) => k !== toolBox))
    const kinds: Record<Role, ObjectKind> = {
      diary_box: diaryBox,
      tool_box: toolBox,
      memory_a: a as ObjectKind,
      memory_b: b as ObjectKind,
      memory_c: c as ObjectKind,
      piano: 'toy_piano',
      lockbox: 'lockbox',
      mirror: 'mirror',
      fear: 'fear',
      herring_1: herrings[0] as ObjectKind,
      herring_2: herrings[1] as ObjectKind,
      herring_3: herrings[2] as ObjectKind,
    }
    // Place the most constrained objects first.
    const rank = { top: 0, floor: 1, wall: 2, any: 3 } as const
    const order = shuffle(ROLES).sort((x, y) => rank[KIND_SPECS[kinds[x]].placement] - rank[KIND_SPECS[kinds[y]].placement])
    const free = shuffle(SLOT_IDS)
    const slots = {} as Record<Role, SlotId>
    let placed = true
    for (const role of order) {
      const index = free.findIndex((id) => slotAllows(id, KIND_SPECS[kinds[role]].placement))
      if (index < 0) {
        placed = false
        break
      }
      slots[role] = free[index] as SlotId
      free.splice(index, 1)
    }
    if (placed) return { kinds, slots, melody: randomMelody() }
  }
  throw new Error('could not place the skeleton')
}

// ---------------------------------------------------------------------------------------
// What Gemini writes
// ---------------------------------------------------------------------------------------

interface DreamStory {
  dreamer: RoomBlueprint['dreamer']
  title: string
  introLine: string
  worry: string
  worryDecoys: string[]
  nameDecoys: string[]
  personDecoys: string[]
  memories: { speaker: CastRole; speakerName: string; text: string }[]
  personIndex: number
  toolName: string
  objects: { role: Role; name: string; description: string }[]
  diary: string
  photo: string
  keepsake: { name: string; text: string }
  fear: { name: string; description: string; prompt: string; options: string[]; answer: number; supportIndex: number }
  door: string
  hints: { role: Role | 'door'; lines: string[] }[]
}

const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) })
const list = (items: unknown, description?: string) => ({ type: 'array', items, ...(description ? { description } : {}) })

const STORY_SCHEMA = {
  type: 'object',
  properties: {
    dreamer: {
      type: 'object',
      properties: {
        name: str(),
        age: { type: 'integer' },
        situation: str('What is weighing on them, one sentence, third person.'),
        personality: str('How they think and talk, one sentence.'),
        voice: { type: 'string', enum: ['self_f', 'self_m'] },
        mood: { type: 'string', enum: [...DREAM_MOODS] },
      },
      required: ['name', 'age', 'situation', 'personality', 'voice', 'mood'],
    },
    title: str(),
    introLine: str('Third person, sets the scene, no name.'),
    worry: str('2-4 words naming the dreaded thing, e.g. "violin audition". Used as an answer.'),
    worryDecoys: list(str(), '2 plausible wrong worries (2-4 words each)'),
    nameDecoys: list(str(), '2 plausible wrong first names'),
    personDecoys: list(str(), '2 plausible wrong people (e.g. "Dad", "Coach")'),
    memories: list(
      {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: MEMORY_SPEAKERS },
          speakerName: str('Who they are, e.g. "Mom", "Coach Rivera", "Night radio".'),
          text: str('What they say, natural speech, 1-3 sentences.'),
        },
        required: ['speaker', 'speakerName', 'text'],
      },
      'Exactly 3, for memories A, B, C in order.',
    ),
    personIndex: { type: 'integer', description: 'Index (0-2) of the memory from the person who matters most.' },
    toolName: str('Name of the small tool, e.g. "Cassette: MOM".'),
    objects: list(
      {
        type: 'object',
        properties: { role: { type: 'string', enum: ROLES }, name: str(), description: str('First person, as the dreamer.') },
        required: ['role', 'name', 'description'],
      },
      'One entry per role.',
    ),
    diary: str('The diary page.'),
    photo: str('Text of the old photo found in the toy piano.'),
    keepsake: { type: 'object', properties: { name: str(), text: str() }, required: ['name', 'text'] },
    fear: {
      type: 'object',
      properties: {
        name: str('e.g. "The empty stage".'),
        description: str(),
        prompt: str('The panic, as a question to myself.'),
        options: list(str(), 'Exactly 3 things I could tell myself.'),
        answer: { type: 'integer', description: 'Index of the brave one.' },
        supportIndex: { type: 'integer', description: 'Index (0-2) of the memory it echoes.' },
      },
      required: ['name', 'description', 'prompt', 'options', 'answer', 'supportIndex'],
    },
    door: str('The bedroom door, first person.'),
    hints: list({
      type: 'object',
      properties: { role: { type: 'string', enum: [...ROLES, 'door'] }, lines: list(str(), '1-2 vague nudges') },
      required: ['role', 'lines'],
    }),
  },
  required: ['dreamer', 'title', 'introLine', 'worry', 'worryDecoys', 'nameDecoys', 'personDecoys', 'memories', 'personIndex', 'toolName', 'objects', 'diary', 'photo', 'keepsake', 'fear', 'door', 'hints'],
}

const SYSTEM_INSTRUCTION = `You write the story for one short escape-room dream in a cozy, slightly eerie pixel-art game.

THE PREMISE: the player wakes up inside a stranger's body, in their bedroom, inside their dream. The dreamer is an ordinary person with a relatable worry. Voices from their life (memories), their diary, and old keepsakes help the player piece together who they are. In the last act the worry itself appears and the dreamer must choose what to tell themselves. Tone: funny-anxious, warm, a little eerie. Simple everyday words.

The engine has already built the puzzle; you write everything a player reads or hears:
- memories: exactly 3 (A, B, C in order). Each is one person from the dreamer's life speaking naturally, 1-3 sentences, max ${L.maxMemoryText - 40} characters. EACH memory mentions exactly one memorable number as a single numeral from 1 to 9 (e.g. "your lucky number 4", "count to 7"), and no other digits; these numbers form a lock code. Memory A addresses the dreamer by first name. The music box memory is about a song or melody.
- diary: max ${L.maxPageText - 40} characters, contains the exact worry phrase, and hints (without naming it) where the tool is hidden.
- descriptions: first person as the dreamer, max ${L.maxDescription} characters; names max ${L.maxName}. Each description is only about that object (never reveal where other things are hidden).
- diary: hint at the tool's hiding place with a feeling or memory ("somewhere warm", "where I drop my spare change"), never by naming the furniture.
- door: it is locked and won't open; I sense it will only open once I stop running from my worry.
- fear: 3 short options (max ${L.maxOption} characters) of what to tell myself: two anxious or giving-up thoughts, one brave thought echoing the memory at supportIndex.
- decoys: believable, but they must NOT appear anywhere in the memories or diary.
- hints: 1-2 vague nudges per role, in the dreamer's own words; the engine adds the explicit final hint.
- title max ${L.maxTitle}, introLine max ${L.maxIntro}, situation max ${L.maxSituation}, personality max ${L.maxPersonality}, worry max ${L.maxAnswer}.`

/** A random starting point per dream so runs don't converge on the same story. */
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

function storyPrompt(skeleton: Skeleton): string {
  const voice = Math.random() < 0.5 ? 'self_f' : 'self_m'
  const name = pick(voice === 'self_f' ? NAMES_F : NAMES_M)
  const age = 14 + Math.floor(Math.random() * 50)
  const objects = ROLES.map((role) => `- ${role}: a ${skeleton.kinds[role].replace('_', ' ')} (${ROLE_PURPOSE[role]})`)
  const memoryKinds = MEMORY_ROLES.map((role, i) => `${'ABC'[i]} = the ${skeleton.kinds[role].replace('_', ' ')}`)
  return [
    `This dream's dreamer: ${name}, ${age}, voice ${voice}, worried about ${pick(WORRIES)}.`,
    `Objects in the room (write a name and description for every role):\n${objects.join('\n')}`,
    `Memories: ${memoryKinds.join(', ')}. Memory A only plays after inserting the tool (${TOOL_FOR[skeleton.kinds.memory_a as MemoryKind]}).`,
    'Write the story now. Return only JSON.',
  ].join('\n\n')
}

// ---------------------------------------------------------------------------------------
// Assembly: skeleton + story -> blueprint (with the patches the puzzle relies on)
// ---------------------------------------------------------------------------------------

const DECOY_POOLS = {
  name: ['Alex', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Taylor'],
  worry: ['math exam', 'job interview', 'dentist visit', 'piano recital', 'driving test'],
  person: ['Dad', 'my coach', 'my neighbour', 'my teacher', 'my cousin'],
}

function clip(text: string | undefined, max: number, fallback: string): string {
  const value = (typeof text === 'string' ? text : '').trim() || fallback
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}

/** Two decoys that differ from the answer and appear in none of the given texts. */
function cleanDecoys(decoys: string[], answer: string, texts: string[], pool: string[]): string[] {
  const ok = (d: string) => d.trim() !== '' && d.trim().toLowerCase() !== answer.trim().toLowerCase() && !texts.some((t) => mentions(t, d))
  const result = decoys.map((d) => clip(d, L.maxAnswer, '')).filter(ok).slice(0, 2)
  for (const candidate of shuffle(pool)) {
    if (result.length >= 2) break
    if (ok(candidate) && !result.includes(candidate)) result.push(candidate)
  }
  return result
}

function assemble(skeleton: Skeleton, story: DreamStory): RoomBlueprint {
  const dreamer = {
    name: clip(story.dreamer?.name, L.maxName, 'Sam'),
    age: Math.min(99, Math.max(8, Math.round(story.dreamer?.age ?? 25))),
    situation: clip(story.dreamer?.situation, L.maxSituation, 'Something big happens tomorrow.'),
    personality: clip(story.dreamer?.personality, L.maxPersonality, 'Anxious, funny, kind.'),
    voice: story.dreamer?.voice === 'self_m' ? ('self_m' as const) : ('self_f' as const),
    mood: (DREAM_MOODS as readonly string[]).includes(story.dreamer?.mood) ? story.dreamer.mood : pick(DREAM_MOODS),
  }
  const worry = clip(story.worry, L.maxAnswer, 'big day')
  const written = (role: Role) => story.objects?.find((o) => o.role === role)
  const nameOf = (role: Role) =>
    clip(written(role)?.name, L.maxName, skeleton.kinds[role].replace('_', ' ').replace(/^./, (c) => c.toUpperCase()))
  const descriptionOf = (role: Role) => clip(written(role)?.description, L.maxDescription, 'Something about this feels familiar.')

  // Memories: each carries one digit (for the lock); A says the dreamer's name.
  const memories: Memory[] = MEMORY_ROLES.map((_, i) => {
    const raw = story.memories?.[i]
    const speaker = raw && MEMORY_SPEAKERS.includes(raw.speaker) ? raw.speaker : pick(MEMORY_SPEAKERS)
    let spoken = clip(raw?.text, L.maxMemoryText - 40, 'I believe in you. Remember that.')
    if (!/[1-9]/.test(spoken)) spoken += ` Remember: ${1 + Math.floor(Math.random() * 9)}.`
    if (i === 0 && !mentions(spoken, dreamer.name)) spoken = `${dreamer.name}! ${spoken}`
    return { speaker, speakerName: clip(raw?.speakerName, L.maxName, 'A voice'), text: spoken }
  })
  const digits = memories.map((m) => m.text.match(/[1-9]/)?.[0] ?? '1')

  let diary = clip(story.diary, L.maxPageText - 40, "I can't sleep.")
  if (!mentions(diary, worry)) diary += ` Tomorrow: my ${worry}.`

  const items: BlueprintItem[] = [
    { id: 'page-diary', kind: 'page', name: 'Diary page', text: diary },
    { id: 'tool', kind: 'tool', name: clip(story.toolName, L.maxName, 'Small key') },
    { id: 'photo', kind: 'page', name: 'Old photo', text: clip(story.photo, L.maxPageText, 'An old photo. We look so happy.') },
    {
      id: 'keepsake',
      kind: 'page',
      name: clip(story.keepsake?.name, L.maxName, 'Keepsake'),
      text: clip(story.keepsake?.text, L.maxPageText, 'I kept this for a reason.'),
    },
  ]

  const ids = {} as Record<Role, string>
  for (const role of ROLES) ids[role] = role === 'fear' || role === 'mirror' ? role : skeleton.kinds[role]
  const base = (role: Role): BlueprintObject => {
    const object: BlueprintObject = { id: ids[role], kind: skeleton.kinds[role], slot: skeleton.slots[role], name: nameOf(role), description: descriptionOf(role) }
    if (ROLE_ACT[role] > 1) object.act = ROLE_ACT[role] as 2 | 3
    return object
  }

  const objects: BlueprintObject[] = []
  MEMORY_ROLES.forEach((role, i) => {
    const object = base(role)
    object.memory = memories[i]
    if (object.kind === 'music_box') object.melody = skeleton.melody
    if (role === 'memory_a') object.lock = { type: 'item', itemId: 'tool' }
    objects.push(object)
  })
  const musicBox = objects.find((o) => o.kind === 'music_box')
  objects.push({ ...base('diary_box'), contains: 'page-diary' })
  objects.push({ ...base('tool_box'), contains: 'tool' })
  objects.push({ ...base('piano'), contains: 'photo', lock: { type: 'melody', notes: skeleton.melody, sourceId: musicBox?.id ?? '' } })
  objects.push({ ...base('lockbox'), contains: 'keepsake', lock: { type: 'code', code: digits.join(''), clueIds: MEMORY_ROLES.map((r) => ids[r]) } })

  const memoryClue = (role: (typeof MEMORY_ROLES)[number]) => {
    const m = memories[MEMORY_ROLES.indexOf(role)]
    return m ? [`${m.speakerName}: ${m.text}`] : []
  }
  const personRole = MEMORY_ROLES[Math.min(2, Math.max(0, story.personIndex ?? 0))] ?? 'memory_a'
  const person = memories[MEMORY_ROLES.indexOf(personRole)]?.speakerName ?? 'Mom'
  objects.push({
    ...base('mirror'),
    lock: {
      type: 'identity',
      questions: [
        { prompt: 'My name is...', answer: dreamer.name, decoys: cleanDecoys(story.nameDecoys ?? [], dreamer.name, memoryClue('memory_a'), DECOY_POOLS.name), clueIds: [ids.memory_a] },
        { prompt: "What I'm dreading is my...", answer: worry, decoys: cleanDecoys(story.worryDecoys ?? [], worry, [diary], DECOY_POOLS.worry), clueIds: ['page-diary'] },
        { prompt: 'The person who matters most is...', answer: person, decoys: cleanDecoys(story.personDecoys ?? [], person, memoryClue(personRole), DECOY_POOLS.person), clueIds: [ids[personRole]] },
      ],
    },
  })

  const fearName = clip(story.fear?.name, L.maxName, 'The fear')
  const fearOptions = (story.fear?.options ?? []).slice(0, 3).map((o) => clip(o, L.maxOption, '...'))
  while (fearOptions.length < 3) fearOptions.push(['I can do this.', 'I should give up.', 'Nobody believes in me.'][fearOptions.length] ?? '...')
  const supportRole = MEMORY_ROLES[Math.min(2, Math.max(0, story.fear?.supportIndex ?? 0))] ?? 'memory_a'
  objects.push({
    ...base('fear'),
    name: fearName,
    description: clip(story.fear?.description, L.maxDescription, 'Here it is. The thing I have been dreading.'),
    lock: {
      type: 'fear',
      prompt: clip(story.fear?.prompt, L.maxQuestion, 'What do I tell myself?'),
      options: fearOptions,
      answer: Math.min(2, Math.max(0, story.fear?.answer ?? 0)),
      supportIds: [ids[supportRole]],
    },
  })
  for (const role of ['herring_1', 'herring_2', 'herring_3'] as const) objects.push(base(role))

  // Hints: Gemini's vague nudges, then an explicit line the engine guarantees.
  const code = digits.join('')
  const finalHint: Record<Role | 'door', string> = {
    diary_box: `Check the ${nameOf('diary_box')}.`,
    tool_box: `Look in the ${nameOf('tool_box')}.`,
    memory_a: `Use the ${items[1]?.name} on the ${nameOf('memory_a')}.`,
    memory_b: `Play the ${nameOf('memory_b')}.`,
    memory_c: `Play the ${nameOf('memory_c')}.`,
    piano: `Play ${[...skeleton.melody].join(', ')} on the ${nameOf('piano')}.`,
    lockbox: `The ${nameOf('lockbox')} code is ${[...code].join(', ')}.`,
    mirror: `Look in the ${nameOf('mirror')}.`,
    fear: `Face ${fearName}.`,
    herring_1: '',
    herring_2: '',
    herring_3: '',
    door: 'Open the door.',
  }
  const order: (Role | 'door')[] = ['diary_box', 'tool_box', 'memory_a', 'memory_b', 'memory_c', 'piano', 'lockbox', 'mirror', 'fear', 'door']
  const hints: HintLadder[] = order.map((role) => {
    const nudges = (story.hints?.find((h) => h.role === role)?.lines ?? [])
      .slice(0, 2)
      .map((line) => clip(line, L.maxHintLine, ''))
      .filter(Boolean)
    return { targetId: role === 'door' ? DOOR_ID : ids[role], lines: [...(nudges.length ? nudges : ['Hmm... what have I missed?']), finalHint[role]] }
  })

  return {
    dreamer,
    title: clip(story.title, L.maxTitle, 'A Strange Night'),
    introLine: clip(story.introLine, L.maxIntro, 'A small bedroom. Someone here cannot sleep.'),
    objects,
    items,
    door: { description: clip(story.door, L.maxDescription, 'My bedroom door.'), lock: { type: 'step', stepId: 'fear' } },
    solutionOrder: order.map((role) => (role === 'door' ? DOOR_ID : ids[role])),
    hints,
  }
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

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = models[Math.min(modelIndex, models.length - 1)] ?? MODEL_CHAIN[0]
    const started = Date.now()
    try {
      const skeleton = makeSkeleton()
      const response = await client.models.generateContent({
        model,
        contents: storyPrompt(skeleton),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: STORY_SCHEMA,
          temperature: 1.1,
          maxOutputTokens: 8192,
          ...(model.includes('lite') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        },
      })
      const blueprint = assemble(skeleton, JSON.parse(response.text ?? '') as DreamStory)
      const result = validateBlueprint(blueprint)
      const seconds = ((Date.now() - started) / 1000).toFixed(1)
      if (result.ok) {
        console.info(`[dream] "${blueprint.title}" for ${blueprint.dreamer.name} (${model}, attempt ${attempt}, ${seconds}s)`)
        return { blueprint, source: 'gemini' }
      }
      console.warn(`[dream] attempt ${attempt} invalid (${model}, ${seconds}s): ${result.errors.slice(0, 5).join('; ')}`)
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
