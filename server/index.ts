import './env.ts'
import express from 'express'
import { dreamRouter } from './routes/dream.ts'
import { journalRouter } from './routes/journal.ts'
import { narratorRouter } from './routes/narrator.ts'
import { voiceRouter } from './routes/voice.ts'

const app = express()
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use(dreamRouter)
app.use(journalRouter)
app.use(narratorRouter)
app.use(voiceRouter)

// Keep the default in sync with the proxy target in vite.config.ts.
const port = Number(process.env.PORT ?? 3001)

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
