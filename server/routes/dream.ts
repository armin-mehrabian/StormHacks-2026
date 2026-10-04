import { Router } from 'express'
import { API_PATHS } from '../../src/shared/contract.ts'
import { generateDream } from '../gemini/dreamGenerator.ts'

// Always answers with a valid dream: Gemini's, or the handmade one if generation fails.
export const dreamRouter = Router()

dreamRouter.post(API_PATHS.dream, async (_req, res) => {
  res.json(await generateDream())
})
