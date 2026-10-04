// Handmade dream used for demo mode (?demo) and whenever Gemini is unavailable, slow, or
// produces an invalid blueprint. A three-act showcase of every story mechanic:
//   Act 1: a diary points to a hidden cassette; Mom's voicemail plays once it's inserted.
//   Act 2: the room shifts. Grandma's song (music box -> toy piano), the night radio,
//          a code hidden in three voices, and the mirror asking "who am I?".
//   Act 3: the fear appears, an empty stage. Choose what to tell yourself, then wake up.

import type { RoomBlueprint } from './blueprint.ts'

export const FALLBACK_ROOM: RoomBlueprint = {
  dreamer: {
    name: 'Maya',
    age: 19,
    situation: 'Her first big violin audition is at 9am tomorrow, and she is terrified of freezing on stage.',
    personality: 'Jittery, self-teasing, overthinks everything, secretly loves the violin more than anything.',
    voice: 'self_f',
    mood: 'violet',
  },
  title: 'The Night Before',
  introLine: 'A small bedroom, full of music. Someone here has not slept in a long time.',
  objects: [
    // ---- Act 1: confusion ----
    {
      id: 'bookshelf',
      kind: 'bookshelf',
      slot: 'T2',
      name: 'Bookshelf',
      description: 'Sheet music, sheet music, more sheet music. One page is sticking out.',
      contains: 'page-diary',
    },
    {
      id: 'drawer',
      kind: 'dresser',
      slot: 'T3',
      name: 'Dresser',
      description: 'My sock drawer. Empty. Even my socks abandoned me.',
    },
    {
      id: 'clock',
      kind: 'clock',
      slot: 'T4',
      name: 'Clock',
      description: 'Stuck at 2:47. Of course it is. Time does not want to help either.',
    },
    {
      id: 'lamp',
      kind: 'lamp',
      slot: 'L1',
      name: 'Lamp',
      description: 'My desk lamp. Warm. Something rattles inside the shade.',
      contains: 'cassette',
    },
    {
      id: 'bed',
      kind: 'bed',
      slot: 'R1',
      name: 'Bed',
      description: 'My bed. I should be asleep in it. Ha. Funny.',
    },
    {
      id: 'answering_machine',
      kind: 'answering_machine',
      slot: 'F3',
      name: 'Answering machine',
      description: 'The answering machine. The tape slot is empty.',
      lock: { type: 'item', itemId: 'cassette' },
      memory: {
        speaker: 'mom',
        speakerName: 'Mom',
        text: "Hi Maya, sweetie, it's Mom! Big day tomorrow. Don't forget your lucky number, 4. And Grandma's old music box is still in your room... she'd want you to hear it. Love you!",
      },
    },

    // ---- Act 2: memories ----
    {
      id: 'mirror',
      kind: 'mirror',
      slot: 'T1',
      name: 'Mirror',
      act: 2,
      description: "A mirror. The reflection is blurry, like it doesn't know who I am yet.",
      lock: {
        type: 'identity',
        questions: [
          { prompt: 'My name is...', answer: 'Maya', decoys: ['Mia', 'Grace'], clueIds: ['answering_machine'] },
          {
            prompt: 'Tomorrow I have my...',
            answer: 'violin audition',
            decoys: ['piano recital', 'math exam'],
            clueIds: ['page-diary'],
          },
          { prompt: 'The person I miss most is...', answer: 'Grandma', decoys: ['Mom', 'my old teacher'], clueIds: ['music_box'] },
        ],
      },
    },
    {
      id: 'music_box',
      kind: 'music_box',
      slot: 'L2',
      name: 'Music box',
      act: 2,
      description: "Grandma's music box. It plays our song.",
      melody: 'EDCDEE',
      memory: {
        speaker: 'grandma',
        speakerName: 'Grandma',
        text: 'Remember our song, darling. Play the first 2 notes, and the music remembers the rest for you. It always has.',
      },
    },
    {
      id: 'radio',
      kind: 'radio',
      slot: 'R2',
      name: 'Radio',
      act: 2,
      description: 'My old radio. Just static. Which station was it again?',
      lock: { type: 'tune', frequency: '93.5', clueIds: ['page-diary'] },
      memory: {
        speaker: 'radio_host',
        speakerName: 'Night radio',
        text: "Night Owl Radio, still with you. Can't sleep? Breathe in slowly and count to 7. Seven slow breaths. You've got this.",
      },
    },
    {
      id: 'case',
      kind: 'lockbox',
      slot: 'F1',
      name: 'Violin case',
      act: 2,
      description: 'My violin case. A three-digit lock. Three voices, three numbers?',
      contains: 'ticket',
      lock: { type: 'code', code: '472', clueIds: ['answering_machine', 'radio', 'music_box'] },
    },
    {
      id: 'toy_piano',
      kind: 'toy_piano',
      slot: 'F4',
      name: 'Toy piano',
      act: 2,
      description: "A tiny toy piano with five keys. Grandma's song... how did it go?",
      contains: 'photo',
      lock: { type: 'melody', notes: 'EDCDEE', sourceId: 'music_box' },
    },

    // ---- Act 3: the fear ----
    {
      id: 'fear',
      kind: 'fear',
      slot: 'F2',
      name: 'The empty stage',
      act: 3,
      description: 'A spotlight on an empty stage. My violin waits in the light. My hands will not stop shaking.',
      lock: {
        type: 'fear',
        prompt: 'The spotlight is blinding. Everyone is watching. What do I tell myself?',
        options: [
          'Everyone is waiting for me to mess up.',
          'Just play the first two notes. The music remembers.',
          'Maybe I should just stay asleep forever.',
        ],
        answer: 1,
        supportIds: ['music_box', 'toy_piano'],
      },
    },
  ],
  items: [
    {
      id: 'page-diary',
      kind: 'page',
      name: 'Diary page',
      text: "Dear me, I can't sleep. My violin audition is at 9. Mom left a message, but I hid the tape somewhere warm so I would stop replaying it. Only the night owl station, 93.5, ever helps.",
    },
    { id: 'cassette', kind: 'tool', name: 'Cassette: MOM' },
    {
      id: 'photo',
      kind: 'page',
      name: 'Old photo',
      text: "Me and Grandma at my first recital, both grinning. On the back, in her handwriting: 'You were brave then too.'",
    },
    {
      id: 'ticket',
      kind: 'page',
      name: 'Audition slip',
      text: 'AUDITION: 9:00 AM, Main Hall. Bring: violin, nerves, and Grandma\'s song.',
    },
  ],
  door: {
    description: 'My bedroom door. It will not open. Not until I stop running from tomorrow.',
    lock: { type: 'step', stepId: 'fear' },
  },
  solutionOrder: ['bookshelf', 'lamp', 'answering_machine', 'music_box', 'toy_piano', 'radio', 'case', 'mirror', 'fear', 'door'],
  hints: [
    { targetId: 'bookshelf', lines: ['So much sheet music... one page is sticking out.', 'Check the bookshelf.'] },
    {
      targetId: 'lamp',
      lines: ['Somewhere warm... what is warm in here?', 'The lamp shade rattles.', 'Look inside the lamp.'],
    },
    {
      targetId: 'answering_machine',
      lines: ['A tape labelled Mom. It has to play somewhere.', 'Put the cassette in the answering machine.'],
    },
    { targetId: 'music_box', lines: ["Mom said Grandma's music box is still here.", 'Open the music box.'] },
    {
      targetId: 'toy_piano',
      lines: ['That melody... I could play it back.', 'E, D, C, D, E, E.', "Play Grandma's song on the toy piano."],
    },
    {
      targetId: 'radio',
      lines: ['Who else talks to me this late at night?', 'My diary mentioned a station.', 'Tune the radio to 93.5.'],
    },
    {
      targetId: 'case',
      lines: [
        'Three voices, three numbers.',
        'Lucky 4, seven breaths, the first 2 notes.',
        'The violin case code is 4, 7, 2.',
      ],
    },
    {
      targetId: 'mirror',
      lines: ['I need to remember who I am.', 'My name, tomorrow, the person I miss.', 'Look in the mirror.'],
    },
    {
      targetId: 'fear',
      lines: ['The stage is waiting. What would Grandma tell me?', 'The music remembers.', 'Face the empty stage.'],
    },
    { targetId: 'door', lines: ['The way out is open now.', 'Open the door.'] },
  ],
}
