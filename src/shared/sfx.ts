// The sound effects library. Each entry is generated once by ElevenLabs Sound Effects
// (npm run sfx) into public/sfx/<key>.mp3 and played locally in game, so sounds are
// instant, cost no credits per play, and cannot fail on stage.
// Prompts are initial implementation choices; tweak and regenerate with --only=<key>.

export interface SfxSpec {
  prompt: string
  /** Seconds; omit to let ElevenLabs choose. */
  duration?: number
  /** Seamless loop (ambience). */
  loop?: boolean
  /** 0-1: how literally to follow the prompt. */
  influence?: number
}

export const SFX = {
  // Movement: four takes of the same prompt so steps never sound robotic.
  'step-1': { prompt: 'single soft footstep on an old creaky wooden floorboard, sneaker, close, dry', duration: 0.5, influence: 0.6 },
  'step-2': { prompt: 'single soft footstep on an old creaky wooden floorboard, sneaker, close, dry', duration: 0.5, influence: 0.6 },
  'step-3': { prompt: 'single soft footstep on an old wooden floor with a faint creak, sneaker, close, dry', duration: 0.5, influence: 0.6 },
  'step-4': { prompt: 'single soft footstep on an old wooden floor with a faint creak, sneaker, close, dry', duration: 0.5, influence: 0.6 },

  // Searching, one per object kind.
  'search-bed': { prompt: 'hands rummaging through bed sheets and a heavy blanket, fabric rustling', duration: 1.5 },
  'search-desk': { prompt: 'wooden desk drawer sliding open, papers shuffling inside', duration: 1.5 },
  'search-bookshelf': { prompt: 'books being pulled from a wooden shelf and pages flipping', duration: 1.5 },
  'search-dresser': { prompt: 'stiff old wooden dresser drawer scraping open, empty and hollow', duration: 1.2 },
  'search-wardrobe': { prompt: 'old wooden wardrobe door creaking open slowly, hangers clinking', duration: 1.8 },
  'search-nightstand': { prompt: 'small wooden nightstand drawer pulled open, a few loose items rattle', duration: 1 },
  'search-lamp': { prompt: 'lamp switch clicking and a fabric lampshade being tilted', duration: 1 },
  'search-rug': { prompt: 'lifting the corner of a heavy rug, fabric flapping and dust', duration: 1.2 },
  'search-plant': { prompt: 'ceramic plant pot scraping on a wooden floor, leaves rustling', duration: 1.2 },
  'search-painting': { prompt: 'picture frame tilted on a wall, tapping against plaster', duration: 1 },
  'search-clock': { prompt: 'opening the small glass door of an antique wall clock, faint ticking', duration: 1.2 },
  'search-trash': { prompt: 'rummaging through crumpled paper in a metal trash can', duration: 1.2 },
  'search-lockbox': { prompt: 'small locked metal box being shaken, rattling', duration: 1 },

  'search-answering_machine': { prompt: 'click of an old answering machine button, then a single electronic beep', duration: 1 },
  'search-radio': { prompt: 'old radio switching on, tuning dial sweeping through static, landing on a station', duration: 1.5 },
  'search-music_box': { prompt: 'wooden music box lid opening, a few delicate tinkling music box notes of a lullaby', duration: 4 },

  'search-mirror': { prompt: 'soft glassy shimmer, a mirror ringing faintly, dreamlike', duration: 1.5 },
  'search-toy_piano': { prompt: 'a single plinky note on a tiny toy piano', duration: 0.8, influence: 0.7 },
  'search-fear': { prompt: 'deep low heartbeat thump with a rising tense string swell, ominous', duration: 2.5 },
  'act-shift': { prompt: 'dreamy magical whoosh swell with shimmering chimes, the world transforming', duration: 3 },

  // Pages and locks.
  'page-unfold': { prompt: 'unfolding an old piece of paper, crisp crinkle', duration: 1 },
  'locked-rattle': { prompt: 'doorknob rattling on a locked wooden door', duration: 1.2 },
  'keypad-beep': { prompt: 'single soft mechanical dial click of a combination lock', duration: 0.5, influence: 0.7 },
  'wrong-buzz': { prompt: 'short low error buzzer, dull and disappointed', duration: 0.8 },
  'code-correct': { prompt: 'combination lock clicking open followed by a soft bright chime', duration: 1.5 },
  'unlock-key': { prompt: 'key turning in an old lock, heavy click', duration: 1 },

  // Progress.
  'key-pickup': { prompt: 'picking up a small brass key, light metallic jingle', duration: 1 },
  'item-found': { prompt: 'soft magical sparkle chime, discovery', duration: 1.2 },
  'door-open': { prompt: 'heavy wooden door unlocking and creaking open, a breeze rushing in', duration: 3 },

  // Ambience loops.
  'amb-rain': { prompt: 'gentle rain against a window pane at night, steady, no thunder', duration: 12, loop: true },
  'amb-house': { prompt: 'quiet old house at night, low room tone with occasional distant wood creaks', duration: 15, loop: true },
  'clock-tick': { prompt: 'antique wall clock ticking steadily, close, dry', duration: 4, loop: true, influence: 0.7 },
  'lamp-hum': { prompt: 'faint electrical hum of an old incandescent lamp', duration: 4, loop: true },
  heartbeat: { prompt: 'slow heavy human heartbeat thumping, tense', duration: 4, loop: true },

  // One-shots for mood and endings.
  thunder: { prompt: 'distant rolling thunder rumble outside, at night', duration: 5 },
  'wake-up': { prompt: 'eerie low drone swelling up with a faint music box note, suspense', duration: 4 },
  'time-up': { prompt: 'deep ominous gong with long dark reverb', duration: 4 },
  victory: { prompt: 'short triumphant orchestral sting with bells, relief', duration: 3 },
} as const satisfies Record<string, SfxSpec>

export type SfxKey = keyof typeof SFX
export const SFX_KEYS = Object.keys(SFX) as SfxKey[]

export function sfxUrl(key: SfxKey): string {
  return `/sfx/${key}.mp3`
}
