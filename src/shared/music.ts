// Soundtrack composed once with ElevenLabs Music (npm run music) into public/music/<key>.mp3.
// The game crossfades from the calm track to the tense one as the dream fades.
// Prompts are initial implementation choices; regenerate one with --only=<key>.

export interface MusicSpec {
  label: string
  prompt: string
  seconds: number
}

export const MUSIC = {
  'dream-calm-a': {
    label: 'Calm A: music box lullaby',
    prompt:
      'Dreamy, cozy-but-eerie lullaby for a pixel-art dream game. A soft, slightly detuned music box melody over warm analog synth pads, gentle vinyl crackle, slow 70 BPM, quiet and spacious, a subtle unsettling undertone. Instrumental only. Steady from start to end with no big build, so it loops smoothly.',
    seconds: 60,
  },
  'dream-tense': {
    label: 'Tense: the dream is fading',
    prompt:
      'Tense version of a dreamy music box lullaby: the same soft music box motif, now detuned and wobbling, over low pulsing drones, a ticking-clock percussion pattern, and a deep heartbeat-like kick, 90 BPM, rising unease. Instrumental only. Constant intensity, no ending, so it loops smoothly.',
    seconds: 45,
  },
} as const satisfies Record<string, MusicSpec>

export type MusicKey = keyof typeof MUSIC

/** Which tracks the game plays (chosen by the owner: Calm A and Tense). */
export const SOUNDTRACK: { calm: MusicKey; tense: MusicKey } = {
  calm: 'dream-calm-a',
  tense: 'dream-tense',
}
export const MUSIC_KEYS = Object.keys(MUSIC) as MusicKey[]

export function musicUrl(key: MusicKey): string {
  return `/music/${key}.mp3`
}
