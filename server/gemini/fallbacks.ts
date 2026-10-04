import type { GameEvent, NarratorEmotion, NarratorResponse } from '../../src/shared/contract.ts'

// Used when Gemini is unavailable. Lines refer only to the event, never to puzzle answers;
// hint events speak the engine's hint verbatim instead.
const FALLBACKS: Record<GameEvent['type'], { emotion: NarratorEmotion; lines: readonly string[] }> = {
  game_start: {
    emotion: 'neutral',
    lines: ['Rise and shine. The door is locked, and the clock is already running.'],
  },
  repeated_action: {
    emotion: 'sarcastic',
    lines: ['Again? A bold choice.', 'You and that thing are getting acquainted.', 'Consistency is one way to approach this.'],
  },
  nothing_found: {
    emotion: 'sarcastic',
    lines: ['Nothing. Shocking.', 'Thorough. Useless, but thorough.', 'Another dead end. Keep going.'],
  },
  item_found: {
    emotion: 'praise',
    lines: ['Oh, look at you, finding things.', 'Hold on to that.', 'Progress. Finally.'],
  },
  cipher_found: {
    emotion: 'neutral',
    lines: ['Scrambled letters. Someone wanted this to be annoying.'],
  },
  locked: {
    emotion: 'sarcastic',
    lines: ['Locked. As locks tend to be.', 'It does not open by wanting it harder.'],
  },
  wrong_code: {
    emotion: 'sarcastic',
    lines: ['Was that a code or a guess?', 'Wrong. Confidently wrong.', 'The lock is unimpressed.'],
  },
  unlocked: {
    emotion: 'praise',
    lines: ['It opened. I am almost proud.', 'Well, well. That worked.'],
  },
  near_solution: { emotion: 'hint', lines: ['You are close. Look around you.'] },
  stuck: { emotion: 'hint', lines: ['Try something you have not tried yet.'] },
  time_warning: {
    emotion: 'warning',
    lines: ['Tick tock. Time is not on your side.', 'The clock is winning.'],
  },
  escaped: { emotion: 'praise', lines: ['You escaped. I suppose congratulations are in order.'] },
  time_up: { emotion: 'sarcastic', lines: ['Time is up. The room wins. It usually does.'] },
}

export function fallbackNarration(event: GameEvent): NarratorResponse {
  if (event.hint) return { line: event.hint, emotion: 'hint', shouldSpeak: true }
  const { emotion, lines } = FALLBACKS[event.type]
  const line = lines[Math.floor(Math.random() * lines.length)] ?? lines[0]
  return { line: line ?? '', emotion, shouldSpeak: true }
}
