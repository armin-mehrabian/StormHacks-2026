import type { GameEvent, NarratorEmotion, NarratorResponse } from '../../src/shared/contract.ts'

// Used when Gemini is unavailable: the dreamer's inner voice, short and simple. Lines refer
// only to the event, never to puzzle answers; hint events speak the engine's hint verbatim.
const FALLBACKS: Record<GameEvent['type'], { emotion: NarratorEmotion; lines: readonly string[] }> = {
  game_start: {
    emotion: 'neutral',
    lines: ["Wait... whose hands are these? And whose room is this? Okay. Don't panic."],
  },
  repeated_action: {
    emotion: 'sarcastic',
    lines: ['Again? Come on, me.', "It's still the same. Stop it.", 'Why do I keep doing that?'],
  },
  nothing_found: {
    emotion: 'sarcastic',
    lines: ['Nope. Nothing.', 'Great. Nothing again.', 'Okay, not there.'],
  },
  item_found: {
    emotion: 'praise',
    lines: ['Oh! What is this?', 'Ooh, that might matter.', "I'm keeping this."],
  },
  cipher_found: {
    emotion: 'neutral',
    lines: ['Scrambled letters... is this a code?'],
  },
  locked: {
    emotion: 'sarcastic',
    lines: ["Locked. Of course it's locked.", 'Nope. Need a key.'],
  },
  wrong_code: {
    emotion: 'sarcastic',
    lines: ['Wrong. Okay. Breathe.', 'Nope. Not that one.', "That wasn't it... was it?"],
  },
  unlocked: {
    emotion: 'praise',
    lines: ['Yes! It opened!', 'Oh thank goodness.'],
  },
  near_solution: { emotion: 'hint', lines: ['Wait... something here feels familiar.'] },
  stuck: { emotion: 'hint', lines: ["Think. What haven't I tried yet?"] },
  time_warning: {
    emotion: 'warning',
    lines: ["Everything's getting blurry... hurry.", "I don't have long. I can feel it."],
  },
  memory_heard: {
    emotion: 'neutral',
    lines: ['That voice... I know that voice.', 'Why does that make my chest hurt?'],
  },
  act_changed: { emotion: 'neutral', lines: ['Whoa. Was that there before?', 'The room... changed.'] },
  clues_connected: { emotion: 'hint', lines: ['Wait... those go together, don\'t they?'] },
  wrong_answer: { emotion: 'warning', lines: ['No no no, wrong!', 'Everything shook... careful.'] },
  identity_solved: { emotion: 'praise', lines: ['I... I remember. That\'s me.'] },
  fear_faced: { emotion: 'praise', lines: ['Okay. Okay. I can do this.'] },
  escaped: { emotion: 'praise', lines: ["I remember now... I'm waking up. I'm waking up!"] },
  time_up: { emotion: 'sarcastic', lines: ["So sleepy... I can't... wake up..."] },
}

export function fallbackNarration(event: GameEvent): NarratorResponse {
  if (event.hint) return { line: event.hint, emotion: 'hint', shouldSpeak: true }
  const { emotion, lines } = FALLBACKS[event.type]
  const line = lines[Math.floor(Math.random() * lines.length)] ?? lines[0]
  return { line: line ?? '', emotion, shouldSpeak: true }
}
