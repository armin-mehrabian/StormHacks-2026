// Designs candidate narrator voices with ElevenLabs Voice Design and saves the previews
// so the owner can listen and pick one.
//
//   npm run voice:design              all directions, 3 previews each
//   npm run voice:design -- --only=b  one direction
//   npm run voice:design -- --create=<generatedVoiceId> --name="Dreamer"
//
// Previews land in public/voice-previews/ with an index.html; open
// http://localhost:5173/voice-previews/ while `npm run dev` is running.

import '../server/env.ts'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'voice-previews')

/** Every preview reads the same inner-monologue line, so voices compare fairly. */
const PREVIEW_TEXT =
  "[nervous laugh] Okay... okay. Whose room is this? These aren't my hands. [whispers] Don't panic. Don't panic. " +
  "[sighs] Why do I keep opening this drawer? It's empty. It was empty last time too. [gasps] Wait... I remember something."

const DIRECTIONS: Record<string, { label: string; description: string }> = {
  a: {
    label: 'Warm and breathless',
    description:
      'A young adult in their early twenties with a warm, slightly breathless voice, talking to themselves nervously but with a good sense of humor. Natural and intimate, close to the microphone, like hearing their inner thoughts. Neutral North American accent.',
  },
  b: {
    label: 'Quirky and anxious',
    description:
      'A quirky, anxious young woman in her twenties, quick and expressive, self-deprecating, giggles nervously and whispers when scared. Close and intimate, like she is thinking out loud. Neutral North American accent.',
  },
  c: {
    label: 'Sleepy and awkward',
    description:
      'A soft-spoken young man in his twenties, sleepy and a bit awkward, with dry, nervous humor. Gentle and warm, close to the microphone like inner thoughts in a dream. Neutral North American accent.',
  },
}

const args = process.argv.slice(2)
const argValue = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)

const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not set in .env')
  process.exit(1)
}
const client = new ElevenLabsClient({ apiKey, maxRetries: 1 })

const createId = argValue('create')
if (createId) {
  // Turn a chosen preview into a permanent voice in the account.
  const voice = await client.textToVoice.create({
    voiceName: argValue('name') ?? 'Dreamer',
    voiceDescription: 'EscapeRoom A dreamer inner voice',
    generatedVoiceId: createId,
  })
  console.log(`Created voice "${voice.name}". Put this in .env:\nELEVENLABS_VOICE_ID=${voice.voiceId}`)
  process.exit(0)
}

mkdirSync(OUT_DIR, { recursive: true })
const only = argValue('only')
const rows: string[] = []

for (const [key, direction] of Object.entries(DIRECTIONS)) {
  if (only && key !== only) continue
  const started = performance.now()
  try {
    const result = await client.textToVoice.design({
      voiceDescription: direction.description,
      text: PREVIEW_TEXT,
      modelId: 'eleven_ttv_v3',
      outputFormat: 'mp3_44100_128',
    })
    result.previews.forEach((preview, i) => {
      const file = `${key}${i + 1}.mp3`
      writeFileSync(join(OUT_DIR, file), Buffer.from(preview.audioBase64, 'base64'))
      rows.push(
        `<tr><td>${key.toUpperCase()}${i + 1}</td><td>${direction.label}</td>` +
          `<td><audio controls preload="none" src="${file}"></audio></td><td><code>${preview.generatedVoiceId}</code></td></tr>`,
      )
      console.log(`✓ ${key}${i + 1}  ${direction.label.padEnd(20)} ${preview.durationSecs.toFixed(1)}s  id=${preview.generatedVoiceId}`)
    })
    console.log(`  (${Math.round(performance.now() - started)} ms)`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`✗ ${key} ${direction.label}: ${message.slice(0, 300)}`)
    if (/401|403|permission|unauthori/i.test(message)) process.exit(1)
  }
}

writeFileSync(
  join(OUT_DIR, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Dreamer voice previews</title>
<style>body{font:16px system-ui;background:#120c1e;color:#f4ead5;padding:24px}td{padding:8px 12px}code{font-size:12px;color:#b9ab90}</style>
<h1>Dreamer voice previews</h1><p>${PREVIEW_TEXT.replace(/</g, '&lt;')}</p>
<table>${rows.join('')}</table>`,
)
console.log(`\nListen at http://localhost:5173/voice-previews/ (with npm run dev running)`)
