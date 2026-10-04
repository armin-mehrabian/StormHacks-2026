// Generates the sound effects library with ElevenLabs Sound Effects.
//
//   npm run sfx                 generate missing files only
//   npm run sfx -- --force      regenerate everything
//   npm run sfx -- --only=thunder,heartbeat
//
// Files land in public/sfx/<key>.mp3 and are committed, so the game never calls the
// Sound Effects API at play time.

import '../server/env.ts'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { SFX, SFX_KEYS } from '../src/shared/sfx.ts'
import type { SfxKey } from '../src/shared/sfx.ts'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'sfx')

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args
  .find((arg) => arg.startsWith('--only='))
  ?.slice('--only='.length)
  .split(',')
  .filter(Boolean)

const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not set in .env')
  process.exit(1)
}

const unknown = only?.filter((key) => !(key in SFX))
if (unknown?.length) {
  console.error(`Unknown sound keys: ${unknown.join(', ')}`)
  process.exit(1)
}

const client = new ElevenLabsClient({ apiKey, maxRetries: 1 })
mkdirSync(OUT_DIR, { recursive: true })

const keys: SfxKey[] = only ? (only as SfxKey[]) : SFX_KEYS
let generated = 0
let skipped = 0
const failed: string[] = []

for (const key of keys) {
  const file = join(OUT_DIR, `${key}.mp3`)
  if (!force && !only && existsSync(file)) {
    skipped++
    continue
  }
  const spec = SFX[key]
  const started = performance.now()
  try {
    const stream = await client.textToSoundEffects.convert({
      text: spec.prompt,
      modelId: 'eleven_text_to_sound_v2',
      outputFormat: 'mp3_44100_128',
      ...('duration' in spec ? { durationSeconds: spec.duration } : {}),
      ...('loop' in spec ? { loop: spec.loop } : {}),
      ...('influence' in spec ? { promptInfluence: spec.influence } : {}),
    })
    const audio = Buffer.from(await new Response(stream).arrayBuffer())
    writeFileSync(file, audio)
    generated++
    console.log(`✓ ${key.padEnd(18)} ${(audio.length / 1024).toFixed(0).padStart(4)} KB  ${Math.round(performance.now() - started)} ms`)
  } catch (error) {
    failed.push(key)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`✗ ${key.padEnd(18)} ${message.slice(0, 200)}`)
    // A permission error will fail every call; stop early instead of repeating it.
    if (/401|403|permission|unauthori/i.test(message)) break
  }
}

console.log(`\n${generated} generated, ${skipped} already present, ${failed.length} failed`)
if (failed.length) process.exit(1)
