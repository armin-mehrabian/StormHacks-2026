// Handmade dream used for demo mode (?demo) and whenever Gemini is unavailable, slow, or
// produces an invalid blueprint. It exercises every puzzle block: a diary page, a cipher,
// three memories that hide the code, a locked case, and a red-herring drawer.

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
    {
      id: 'painting',
      kind: 'painting',
      slot: 'T1',
      name: 'Painting',
      description: 'A concert hall. Hundreds of empty seats, all waiting for me. No pressure.',
    },
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
      description: "The clock stopped at 3 o'clock. Someone circled the 3. Was that... me?",
    },
    {
      id: 'plant',
      kind: 'plant',
      slot: 'L1',
      name: 'Cactus',
      description: 'A tiny cactus. It is handling stress better than I am.',
    },
    {
      id: 'music_box',
      kind: 'music_box',
      slot: 'L2',
      name: 'Music box',
      description: "Grandma's music box. It still plays.",
      memory: {
        speaker: 'grandma',
        speakerName: 'Grandma',
        text: "Remember, my darling: you only need the first 2 notes. Play those, and the rest of the song will find you.",
      },
    },
    {
      id: 'bed',
      kind: 'bed',
      slot: 'R1',
      name: 'Bed',
      description: 'My bed. I should be asleep in it. Ha. Funny.',
    },
    {
      id: 'radio',
      kind: 'radio',
      slot: 'R2',
      name: 'Radio',
      description: 'My old radio. It always finds the late-night station.',
      memory: {
        speaker: 'radio_host',
        speakerName: 'Night radio',
        text: "You're listening to Night Owl Radio. If you can't sleep tonight, try this: breathe in slowly, and count to 7. Seven slow breaths. You've got this.",
      },
    },
    {
      id: 'case',
      kind: 'lockbox',
      slot: 'F1',
      name: 'Violin case',
      description: 'My violin case, with a three-digit lock. I always forget the code when I am nervous.',
      contains: 'key',
      lock: { type: 'code', code: '472', clueIds: ['answering_machine', 'radio', 'music_box'] },
    },
    {
      id: 'lamp',
      kind: 'lamp',
      slot: 'F2',
      name: 'Lamp',
      description: 'My desk lamp. Something is folded under the shade.',
      contains: 'page-cipher',
    },
    {
      id: 'answering_machine',
      kind: 'answering_machine',
      slot: 'F3',
      name: 'Answering machine',
      description: 'The answering machine is blinking. One new message.',
      memory: {
        speaker: 'mom',
        speakerName: 'Mom',
        text: "Hi sweetie, it's Mom. Just calling to say good luck tomorrow. And don't forget your lucky number, 4, like when you were little. We are so proud of you. Get some sleep!",
      },
    },
    {
      id: 'trash',
      kind: 'trash_can',
      slot: 'F4',
      name: 'Trash can',
      description: 'Crumpled practice schedules. Every single hour crossed out.',
    },
  ],
  items: [
    {
      id: 'page-diary',
      kind: 'page',
      name: 'Diary page',
      text: "I can't sleep. Every time I close my eyes I see the stage. Grandma always said the music remembers for you. I just have to listen.",
    },
    {
      id: 'page-cipher',
      kind: 'page',
      name: 'Scrambled note',
      text: 'THE CODE IS IN THE VOICES',
      cipherShift: 3,
      shiftClueId: 'clock',
    },
    { id: 'key', kind: 'key', name: 'Brass key' },
  ],
  door: {
    description: 'My bedroom door. Locked. From the inside? That makes no sense. Unless this is a dream.',
    lock: { type: 'key', keyId: 'key' },
  },
  solutionOrder: ['bookshelf', 'lamp', 'answering_machine', 'radio', 'music_box', 'case', 'door'],
  hints: [
    {
      targetId: 'bookshelf',
      lines: ['Something is sticking out of all that sheet music.', 'Check the bookshelf.'],
    },
    {
      targetId: 'lamp',
      lines: ['My desk always had secrets.', 'Something is folded under the lamp shade.', 'Look under the lamp.'],
    },
    {
      targetId: 'answering_machine',
      lines: ['The note said the code is in the voices. Who would call me tonight?', 'Play the answering machine.'],
    },
    {
      targetId: 'radio',
      lines: ['Mom gave me one number. Who else talks to me at night?', 'Turn on the radio.'],
    },
    {
      targetId: 'music_box',
      lines: ['Two voices down. Grandma always had the last word.', 'Open the music box.'],
    },
    {
      targetId: 'case',
      lines: [
        'Mom, the radio, Grandma. Three voices, three numbers.',
        'Lucky 4, seven breaths, the first 2 notes.',
        'The violin case code is 4, 7, 2.',
      ],
    },
    {
      targetId: 'door',
      lines: ['I have a key now. Doors like keys.', 'Use the brass key on the door.'],
    },
  ],
}
