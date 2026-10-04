import { Router } from 'express'
import { API_PATHS, isVoiceRequest } from '../../src/shared/contract.ts'
import type { ApiError } from '../../src/shared/contract.ts'

// Placeholder owned by the ElevenLabs agent. Replace the handler body with
// ElevenLabs speech that responds with audio/mpeg; keep the path and error shape.
export const voiceRouter = Router()

voiceRouter.post(API_PATHS.voice, (req, res) => {
  if (!isVoiceRequest(req.body)) {
    const body: ApiError = { error: 'Invalid voice request' }
    res.status(400).json(body)
    return
  }

  const body: ApiError = { error: 'Voice is not implemented yet' }
  res.status(503).json(body)
})
