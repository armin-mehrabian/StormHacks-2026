// Composes the soundtrack with ElevenLabs Music.
//
//   npm run music                    compose missing tracks
//   npm run music -- --only=dream-tense
//   npm run music -- --force         recompose everything
//
// Tracks land in public/music/<key>.mp3 with an index.html for listening at
// http://localhost:5173/music/ while `npm run dev` is running.

import '../server/env.ts'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { MUSIC, MUSIC_KEYS } from '../src/shared/music.ts'
import type { MusicKey } from '../src/shared/music.ts'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'music')

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean)

const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not set in .env')
  process.exit(1)
}
const unknown = only?.filter((key) => !(key in MUSIC))
if (unknown?.length) {
  console.error(`Unknown track keys: ${unknown.join(', ')}`)
  process.exit(1)
}

const client = new ElevenLabsClient({ apiKey, maxRetries: 1 })
mkdirSync(OUT_DIR, { recursive: true })

const keys: MusicKey[] = only ? (only as MusicKey[]) : MUSIC_KEYS
let failed = 0
for (const key of keys) {
  const file = join(OUT_DIR, `${key}.mp3`)
  if (!force && !only && existsSync(file)) continue
  const spec = MUSIC[key]
  const started = performance.now()
  try {
    const stream = await client.music.compose(
      { prompt: spec.prompt, musicLengthMs: spec.seconds * 1000, forceInstrumental: true },
      { timeoutInSeconds: 240 },
    )
    const audio = Buffer.from(await new Response(stream).arrayBuffer())
    writeFileSync(file, audio)
    console.log(`✓ ${key.padEnd(14)} ${(audio.length / 1024).toFixed(0).padStart(5)} KB  ${Math.round((performance.now() - started) / 1000)} s`)
  } catch (error) {
    failed++
    const message = error instanceof Error ? error.message : String(error)
    console.error(`✗ ${key}: ${message.slice(0, 300)}`)
    if (/401|403|permission|unauthori/i.test(message)) break
  }
}

writeFileSync(
  join(OUT_DIR, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Soundtrack</title>
<style>body{font:16px system-ui;background:#120c1e;color:#f4ead5;padding:24px}td{padding:8px 12px}</style>
<h1>Soundtrack candidates</h1><table>${MUSIC_KEYS.filter((key) => existsSync(join(OUT_DIR, `${key}.mp3`)))
    .map((key) => `<tr><td>${MUSIC[key].label}</td><td><audio controls preload="none" src="${key}.mp3"></audio></td></tr>`)
    .join('')}</table>`,
)
if (failed) process.exit(1)
