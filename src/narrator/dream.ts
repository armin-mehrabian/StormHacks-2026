// Loads the dream for this run: a Gemini-generated one from the server, or the handmade
// demo dream (?demo, or whenever generation fails). Never throws.

import { validateBlueprint } from '../shared/blueprint.ts'
import type { RoomBlueprint } from '../shared/blueprint.ts'
import { API_PATHS, DREAM_TIMEOUT_MS } from '../shared/contract.ts'
import type { DreamResponse } from '../shared/contract.ts'
import { FALLBACK_ROOM } from '../shared/fallbackRoom.ts'

export interface LoadedDream {
  blueprint: RoomBlueprint
  source: 'gemini' | 'fallback' | 'demo'
}

export async function loadDream(demo: boolean): Promise<LoadedDream> {
  if (demo) return { blueprint: FALLBACK_ROOM, source: 'demo' }
  try {
    const response = await fetch(API_PATHS.dream, { method: 'POST', signal: AbortSignal.timeout(DREAM_TIMEOUT_MS) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as DreamResponse
    // The server validates too; checking again keeps a bad response from breaking the game.
    const check = validateBlueprint(body.blueprint)
    if (!check.ok) throw new Error(`invalid dream: ${check.errors[0]}`)
    console.info(`[Dream] "${body.blueprint.title}" (${body.source})`)
    return { blueprint: body.blueprint, source: body.source }
  } catch (error) {
    console.warn('[Dream] using the handmade dream:', error)
    return { blueprint: FALLBACK_ROOM, source: 'fallback' }
  }
}
