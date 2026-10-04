import type { GameEvent, NarratorEmotion, NarratorResponse } from '../../src/shared/contract.ts'

// These lines refer only to the repeated action, not to any puzzle outcome.
const FALLBACKS: Record<NarratorEmotion, readonly string[]> = {
  sarcastic: [
    'Again? A bold choice.',
    'Consistency is one way to approach this.',
    'You do seem committed to that approach.',
  ],
  hint: [
    'Perhaps a different action is worth trying.',
    'You have tried that more than once.',
    'A change of approach may help.',
  ],
  warning: [
    'Take a moment before trying that again.',
    'You are repeating yourself. Stay alert.',
    'Slow down and consider your next move.',
  ],
  praise: [
    'Persistence noted.',
    'You are paying attention.',
    'That is a determined approach.',
  ],
  neutral: [
    'You have tried that again.',
    'The same action, once more.',
    'Another attempt noted.',
  ],
}

const DRAWER_LINES = [
  'The drawer again? Bold strategy.',
  'You and that drawer are getting acquainted.',
  'Another look at the drawer. Persistent.',
] as const

export function fallbackNarration(
  event: GameEvent,
  preferredEmotion?: NarratorEmotion,
): NarratorResponse {
  const isDrawer = event.type === 'repeated_action' && event.objectId === 'drawer'
  const emotion = preferredEmotion ?? (isDrawer ? 'sarcastic' : 'neutral')
  const lines = isDrawer && emotion === 'sarcastic' ? DRAWER_LINES : FALLBACKS[emotion]
  const index = Number.isFinite(event.count) ? Math.abs(Math.trunc(event.count ?? 0)) % lines.length : 0

  return { line: lines[index], emotion, shouldSpeak: true }
}
