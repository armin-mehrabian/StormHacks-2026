import { Router } from 'express'
import { API_PATHS } from '../../src/shared/contract.ts'
import type { ApiError, JournalRequest, JournalResponse } from '../../src/shared/contract.ts'
import { writeJournal } from '../gemini/journal.ts'

export const journalRouter = Router()

journalRouter.post(API_PATHS.journal, async (req, res) => {
  const body = req.body as Partial<JournalRequest>
  if (!body?.dreamer?.name || !body.stats || typeof body.title !== 'string') {
    const error: ApiError = { error: 'Invalid journal request' }
    res.status(400).json(error)
    return
  }
  const response: JournalResponse = { entry: await writeJournal(body as JournalRequest) }
  res.json(response)
})
