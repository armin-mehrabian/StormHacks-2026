import { Router } from 'express'
import type { Response } from 'express'
import { ElevenLabsClient, ElevenLabsTimeoutError } from '@elevenlabs/elevenlabs-js'
import type { VoiceSettings } from '@elevenlabs/elevenlabs-js/api'
import { API_PATHS, INITIAL_TIMEOUTS_MS, isVoiceRequest } from '../../src/shared/contract.ts'
import type { ApiError, NarratorEmotion } from '../../src/shared/contract.ts'

export const voiceRouter = Router()

// Initial implementation choices, tune once the narrator voice is decided.
const MODEL_ID = 'eleven_flash_v2_5'
const OUTPUT_FORMAT = 'mp3_44100_64'
const MAX_LINE_LENGTH = 400
// Stay under the client's voice timeout so a slow request fails here with an ApiError.
const UPSTREAM_TIMEOUT_MS = INITIAL_TIMEOUTS_MS.voice - 500

// Delivery per emotion. Flash models ignore `style`, so only stability and speed are varied.
const EMOTION_SETTINGS: Record<NarratorEmotion, VoiceSettings> = {
  sarcastic: { stability: 0.35, similarityBoost: 0.75, speed: 0.95 },
  hint: { stability: 0.6, similarityBoost: 0.75, speed: 0.95 },
  warning: { stability: 0.45, similarityBoost: 0.75, speed: 1.1 },
  praise: { stability: 0.4, similarityBoost: 0.75, speed: 1.0 },
  neutral: { stability: 0.5, similarityBoost: 0.75, speed: 1.0 },
}

let client: ElevenLabsClient | undefined

function sendError(res: Response, status: number, error: string) {
  const body: ApiError = { error }
  res.status(status).json(body)
}

voiceRouter.post(API_PATHS.voice, async (req, res) => {
  if (!isVoiceRequest(req.body)) {
    sendError(res, 400, 'Invalid voice request')
    return
  }
  const { line, emotion } = req.body
  if (line.length > MAX_LINE_LENGTH) {
    sendError(res, 400, 'Invalid voice request')
    return
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!apiKey || !voiceId) {
    sendError(res, 503, 'Voice is not configured')
    return
  }

  try {
    client ??= new ElevenLabsClient({ apiKey, maxRetries: 0 })
    const stream = await client.textToSpeech.convert(
      voiceId,
      {
        text: line,
        modelId: MODEL_ID,
        outputFormat: OUTPUT_FORMAT,
        voiceSettings: EMOTION_SETTINGS[emotion],
      },
      { abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), maxRetries: 0 },
    )
    // Buffer the whole clip so a mid-stream failure becomes an ApiError, not truncated audio.
    const audio = Buffer.from(await new Response(stream).arrayBuffer())
    res.type('audio/mpeg').send(audio)
  } catch (err) {
    const timedOut =
      err instanceof ElevenLabsTimeoutError ||
      (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError'))
    console.error('Voice request failed:', err instanceof Error ? err.message : err)
    sendError(res, timedOut ? 504 : 502, timedOut ? 'Voice timed out' : 'Voice generation failed')
  }
})
