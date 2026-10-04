import { API_PATHS, INITIAL_TIMEOUTS_MS } from '../shared/contract.ts'
import type { VoiceRequest } from '../shared/contract.ts'

/**
 * POST /api/voice. Resolves to the audio, or null on any failure or timeout so the
 * caller can carry on with the subtitle alone. Never throws.
 */
export async function requestVoice(
  request: VoiceRequest,
  timeoutMs: number = INITIAL_TIMEOUTS_MS.voice,
): Promise<Blob | null> {
  try {
    const response = await fetch(API_PATHS.voice, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return null
    const audio = await response.blob()
    return audio.size > 0 ? audio : null
  } catch {
    return null
  }
}
