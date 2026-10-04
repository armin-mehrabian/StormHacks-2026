// Maps cast roles to ElevenLabs voices. Defaults are premade voices every account has;
// ELEVENLABS_VOICE_ID_F / _M override the dreamer's own voice (e.g. a designed one).
// Initial implementation choices.

import type { CastRole } from '../src/shared/contract.ts'

const CAST_VOICES: Record<CastRole, { env?: string; fallback: string }> = {
  self_f: { env: 'ELEVENLABS_VOICE_ID_F', fallback: 'FGY2WhTYpPnrIDTdsKH5' }, // Laura: quirky, young
  self_m: { env: 'ELEVENLABS_VOICE_ID_M', fallback: 'IjnA9kwZJHJ20Fp7Vmy6' }, // Matthew: casual, young
  mom: { fallback: 'hpp4J3VqNfWAUOO0d1Us' }, // Bella: warm, bright
  dad: { fallback: 'iP95p4xoKVk53GoZ742B' }, // Chris: charming, down-to-earth
  friend_f: { fallback: 'cgSgspJ2msm6clMCkdW9' }, // Jessica: playful, bright
  friend_m: { fallback: 'bIHbv24MWmeRgasZH58o' }, // Will: relaxed optimist
  grandma: { fallback: 'pFZP5JQG7iQjIQuC4Bku' }, // Lily: velvety
  grandpa: { fallback: 'pqHfZKP75CvOlQylNhV4' }, // Bill: wise, old
  radio_host: { fallback: 'onwK4e9ZLuTAKqWW03F9' }, // Daniel: steady broadcaster
  teacher: { fallback: 'Xb7hH8MSUJpSbSDYk0k2' }, // Alice: clear educator
  stranger: { fallback: 'N2lVS1w4EtoT3dr4eOWO' }, // Callum: husky trickster
}

/** The voice for a role, or the configured narrator voice when no role is given. */
export function voiceIdFor(speaker: CastRole | undefined): string | undefined {
  if (!speaker) return process.env.ELEVENLABS_VOICE_ID?.trim() || undefined
  const voice = CAST_VOICES[speaker]
  return (voice.env && process.env[voice.env]?.trim()) || voice.fallback
}
