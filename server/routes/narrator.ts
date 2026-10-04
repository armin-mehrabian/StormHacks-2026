import { Router } from 'express'
import { API_PATHS, isGameEvent } from '../../src/shared/contract.ts'
import type { ApiError, NarratorResponse } from '../../src/shared/contract.ts'

// Placeholder owned by the Gemini agent. Replace the handler body with Gemini
// generation plus fallback lines; keep the path and response shape.
export const narratorRouter = Router()

narratorRouter.post(API_PATHS.narrator, (req, res) => {
  if (!isGameEvent(req.body)) {
    const body: ApiError = { error: 'Invalid game event' }
    res.status(400).json(body)
    return
  }

  const body: NarratorResponse = {
    line: 'Interesting choice.',
    emotion: 'neutral',
    shouldSpeak: true,
  }
  res.json(body)
})
