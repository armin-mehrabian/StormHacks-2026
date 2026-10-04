import { Router } from 'express'
import { API_PATHS, isGameEvent } from '../../src/shared/contract.ts'
import type { ApiError, NarratorResponse } from '../../src/shared/contract.ts'
import { generateNarration } from '../gemini/narration.ts'

export const narratorRouter = Router()

narratorRouter.post(API_PATHS.narrator, async (req, res) => {
  if (!isGameEvent(req.body)) {
    const body: ApiError = { error: 'Invalid game event' }
    res.status(400).json(body)
    return
  }

  const body: NarratorResponse = await generateNarration(req.body)
  res.status(200).json(body)
})
