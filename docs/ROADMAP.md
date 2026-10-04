# Escape The Storm — Roadmap

**Concept: "The Dream."** The player is a dream-walker who wakes inside a stranger's body, in their bedroom, inside their dream. The narrator is the dreamer's inner voice (first person, funny-anxious). Voices from the dreamer's life hide the clues. Opening the door = waking up, and the dreamer finally remembers who they are.

**Pitch:** Gemini dreams up a new person, room, and mystery every run. ElevenLabs gives it a voice cast, acting, music, and a soundscape. You solve it by listening.

## Status

| Phase | Scope | Status |
|---|---|---|
| Sound foundation | Web Audio mixer with ducking; 38 ElevenLabs SFX (`npm run sfx`); positional ambience; footsteps; per-object sounds; thunder; last-minute heartbeat | ✅ |
| Inner voice | Dreamer's first-person voice, short and simple, per-moment length budgets | ✅ |
| Voice and music | Eleven v3 with Gemini-chosen audio tags; dreamy reverb; Voice Design auditions (`npm run voice:design`); soundtrack via ElevenLabs Music (`npm run music`), calm → tense crossfade | ✅ (narrator voice pick pending) |
| Story | Dreamer with name, age, worry, personality; memory objects (answering machine, radio, music box) with a cast of premade voices and phone/radio filters; cinematic intro; reveal on waking; handmade demo dream (`?demo`) | ✅ |
| Dream generation | `POST /api/dream`: Gemini designs dreamer + room + puzzle from the catalog, seeded for variety; validated, auto-repaired, retried across a model chain; falls back to the demo dream | ✅ (~3 in 4 succeed in ~5s) |
| Dream feel | Mood tint per dream, drifting haze, glitch in the final 20 seconds | ✅ |
| Dream journal | Gemini writes the morning-after diary entry from run stats; read aloud in the dreamer's voice; downloadable card | ✅ |
| Story-driven puzzles | Three acts (room transforms between acts); item locks (cassette, batteries, winding key bring memories to life); melody lock (music box -> toy piano, synthesized notes); code from voices; identity board (mirror: name, worry, who matters, with decoys); facing the fear (choose what to tell yourself); "aha" moments when clues connect; wrong answers cost 15s; dream notebook (N). Generator: engine-built random skeleton + Gemini-written story (~5s, 5/5 valid in testing) | ✅ |
| Polish | Radio tuning dial, distorted memory, directional whispered hints, mixer panel, ElevenLabs sound-credits panel, README / Devpost, demo rehearsal | ⏳ |

## 60-second demo script (use `?demo`)

1. Title, then the intro: "2:47 AM. Somewhere, someone can't sleep."
2. Act 1: the diary points somewhere warm; the lamp hides a cassette; Mom's voicemail plays (phone filter).
3. Act 2: the room transforms. Grandma's music box song, replayed on the toy piano; the night radio; the case code from three voices (472); the mirror: "Who am I?"
4. Act 3: the empty stage appears. Choose what Maya tells herself; the door opens: "My name is Maya…"
5. The dream journal is read aloud; save the card. "Gemini dreamt it. ElevenLabs voiced it."

## Credit budget (100,000 ElevenLabs credits, estimates)

| Item | When | Approx. credits |
|---|---|---|
| SFX library + soundtrack + voice auditions | once | ~10–15k |
| One full playthrough (narration, memories, journal) | per play | ~3–4k |
