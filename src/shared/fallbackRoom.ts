// Handmade room used when Gemini is unavailable, slow, or produces an invalid blueprint.
// It exercises every puzzle block: riddle page, cipher page, code from clues, hidden key,
// and a red-herring drawer.

import type { RoomBlueprint } from './blueprint.ts'

export const FALLBACK_ROOM: RoomBlueprint = {
  title: 'The Overslept Bedroom',
  introLine: 'The door is locked. Everything you need is in this room, including a drawer you will not stop opening.',
  objects: [
    {
      id: 'bookshelf',
      kind: 'bookshelf',
      slot: 'T2',
      name: 'Bookshelf',
      description: 'A bookshelf of unread classics. One page sticks out.',
      contains: 'page-riddle',
    },
    {
      id: 'drawer',
      kind: 'dresser',
      slot: 'T3',
      name: 'Dresser',
      description: 'A dresser with a single drawer. It is empty.',
    },
    {
      id: 'clock',
      kind: 'clock',
      slot: 'T4',
      name: 'Clock',
      description: "The clock stopped at 3 o'clock. Someone circled the 3 in red.",
    },
    {
      id: 'painting',
      kind: 'painting',
      slot: 'T1',
      name: 'Painting',
      description: 'A painting of exactly 4 ducks. The first duck looks important.',
    },
    {
      id: 'plant',
      kind: 'plant',
      slot: 'L2',
      name: 'Plant',
      description: 'A plant that has given up. Nothing hides in the soil but regret.',
    },
    {
      id: 'bed',
      kind: 'bed',
      slot: 'R1',
      name: 'Bed',
      description: 'An unmade bed. Tempting, but the door will not unlock itself.',
    },
    {
      id: 'trash',
      kind: 'trash_can',
      slot: 'R2',
      name: 'Trash can',
      description: 'A trash can holding 2 crumpled receipts. The last thing anyone wanted.',
    },
    {
      id: 'lockbox',
      kind: 'lockbox',
      slot: 'F1',
      name: 'Lockbox',
      description: 'A small lockbox with a three-digit dial.',
      contains: 'door-key',
      lock: { type: 'code', code: '472', clueIds: ['painting', 'page-code', 'trash'] },
    },
    {
      id: 'lamp',
      kind: 'lamp',
      slot: 'F2',
      name: 'Lamp',
      description: 'A lamp with a crooked shade. Something rustles inside.',
      contains: 'page-cipher',
    },
    {
      id: 'rug',
      kind: 'rug',
      slot: 'F3',
      name: 'Rug',
      description: 'A worn rug. One corner is suspiciously lumpy.',
      contains: 'page-code',
    },
  ],
  items: [
    {
      id: 'page-riddle',
      kind: 'page',
      name: 'Torn page',
      text: "I wear a shade but never see the sun. I only shine when the day is done. Look inside me.",
    },
    {
      id: 'page-cipher',
      kind: 'page',
      name: 'Scrambled note',
      text: 'LOOK UNDER THE RUG',
      cipherShift: 3,
      shiftClueId: 'clock',
    },
    {
      id: 'page-code',
      kind: 'page',
      name: 'Folded note',
      text: 'The middle digit of the lockbox code is 7. The painting knows the first, the trash knows the last.',
    },
    { id: 'door-key', kind: 'key', name: 'Brass key' },
  ],
  door: {
    description: 'The only way out. Locked, obviously.',
    lock: { type: 'key', keyId: 'door-key' },
  },
  solutionOrder: ['bookshelf', 'lamp', 'rug', 'lockbox', 'door'],
  hints: [
    {
      targetId: 'bookshelf',
      lines: ['Reading is supposed to be good for you. Try it.', 'Something is tucked between the books.', 'Check the bookshelf.'],
    },
    {
      targetId: 'lamp',
      lines: ["That riddle wasn't decorative.", 'What wears a shade but never goes outside?', 'Look inside the lamp.'],
    },
    {
      targetId: 'rug',
      lines: [
        'The scrambled note wants decoding. The clock knows the shift.',
        'Shift every letter back by three.',
        'It says: look under the rug.',
      ],
    },
    {
      targetId: 'lockbox',
      lines: [
        'Count the ducks, read the note, dig through the trash.',
        'The ducks give the first digit, the trash gives the last.',
        'The lockbox code is 4, 7, 2.',
      ],
    },
    {
      targetId: 'door',
      lines: ['You have a key. Doors are famously fond of keys.', 'Use the brass key on the door.'],
    },
  ],
}
