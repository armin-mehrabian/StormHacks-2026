# EscapeTheStorm

<img width="2048" height="1093" alt="image" src="https://github.com/user-attachments/assets/5c42d564-74cb-4007-a7bf-e3e4872e6f28" />

<img width="2048" height="1009" alt="image" src="https://github.com/user-attachments/assets/71d51a50-9193-4f0b-97a3-5a26b49ff98a" />

<img width="2048" height="1009" alt="image" src="https://github.com/user-attachments/assets/3b905c35-b34a-4ebf-a6de-8631513b9ecd" />

<img width="2048" height="1081" alt="image" src="https://github.com/user-attachments/assets/ffb830fc-dcde-4c63-8aa4-6a3213e5ad17" />

<img width="1218" height="708" alt="image" src="https://github.com/user-attachments/assets/4f4437db-c7b1-4f8b-9452-19d1d7c837b0" />

<img width="2048" height="1107" alt="image" src="https://github.com/user-attachments/assets/8564ceb3-2695-4a4f-9c60-1036e387179b" />

<img width="1206" height="790" alt="image" src="https://github.com/user-attachments/assets/d5842d19-a1c6-4f88-ad43-836901f0f299" />

<img width="1213" height="981" alt="image" src="https://github.com/user-attachments/assets/83425478-8283-4859-a182-bf9d3ae665bf" />








## Inspiration

EscapeTheStorm was inspired by the idea of an escape room that dreams up a new story for every player. We wanted AI to feel like part of the world, not a chatbot, so the player enters a stranger’s dream and hears that person’s funny, anxious inner voice while uncovering their memories and fears.

## What it does

EscapeTheStorm is a seven-minute, top-down pixel-art escape room. Players explore a bedroom, collect items, hear voiced memories, tune radios, replay melodies, unlock boxes, reconstruct the dreamer’s identity, and confront their fear before the dream collapses.

Gemini creates the dreamer, story, clues, narration, and post-game journal. ElevenLabs gives the dreamer and their memories distinct voices while also powering the project’s generated sound effects and music.

**Core gameplay loop:**

`Explore → find items and memories → connect clues → solve puzzles → reveal new acts → remember the dreamer’s identity → face their fear → escape`

## How we built it

We used:

- **TypeScript, Vite, and Phaser** for the game, movement, collisions, lighting, animations, and room transformations.
- **HTML and CSS** for the HUD, notebook, subtitles, puzzle interfaces, and ending.
- **Node.js and Express** for secure API routes.
- **Gemini** for dream generation, contextual narration, and personalized journals.
- **ElevenLabs** for character voices, narration, sound effects, and music.
- **Web Audio API** for positional sound, reverb, audio filters, mixing, and music ducking.

The main AI flow is:

`Game event → Express → Gemini generates dialogue → ElevenLabs creates audio → app positions and plays it`

Additional Core Loops That Combine Gemeni and ElevenLabs:

Live narration

**Player action → Game event → Gemini writes dialogue → ElevenLabs creates voice → Game plays it**

Voiced memories

**Player finds memory → Game loads its text → ElevenLabs creates character voice → Audio effects are applied → Memory plays**

Personalized ending

**Game ends → Run stats sent to Gemini → Gemini writes journal → ElevenLabs reads it → Player saves journal**

For dream generation:

`Game creates puzzle structure → Gemini writes its story → validator checks solvability → Phaser builds the room`

The engine controls answers, inventory, time, penalties, and win conditions.

The codebase is divided into:

- `src/game`: gameplay, room state, Phaser scene, lighting, and hints
- `src/ui`: puzzle screens, HUD, notebook, subtitles, and ending
- `src/audio`: speech queue and spatial audio engine
- `src/narrator`: AI narration orchestration
- `src/shared`: blueprints, validation, and API contracts
- `server`: Gemini and ElevenLabs API routes
- `scripts`: sound-effect, music, and voice-generation tools

## Challenges we ran into

We created different iterations of this application across 3D and 2D settings, but wanted to focus on a more concrete and replayable gameplay loop above all else. The 3D rendering aspects via ThreeJS or Unity offered no improvement to player experience other than the graphical difference. We would rather have easily recognizable and simple graphics with a varied and well constructed gameplay loop.

We also had to manage AI latency and failure. Narration runs asynchronously, memory voices are prefetched, speech uses priorities and cooldowns, and every AI feature has timeouts and fallbacks. The game remains playable even if Gemini or ElevenLabs is unavailable. As text is still shown on screen. 

Finally, mixing voices, music, ambience, and clues was difficult. We built a custom audio system that queues speech, lowers background audio during dialogue, applies phone/radio/vinyl effects, and positions sounds inside the room. Surround sound has been implemented so that sounds come from certain directions, providing potential spacial acoustic hints. 

## Accomplishments that we're proud of

We are proud that EscapeTheStorm combines procedural storytelling with a genuinely playable and fair puzzle system. Every generated dream can have a different person, worry, room, memories, and clue presentation while following a validated solution.

We are also proud of the immersive audio. Memories come from their physical objects, hints can be whispered from the correct direction, and the storm, heartbeat, lighting, and soundtrack intensify as time runs out.

We are very proud of the use of Gemeni and ElevenLabs to automate aspects, and keep the levels fresh and unique everytime. 

The personalized ending is another highlight: Gemini uses the player’s real actions to write a journal entry, ElevenLabs reads it in the dreamer’s voice, and the player can download it as a keepsake.

## What we learned

We learned that generative AI works best when creativity and authority are separated. Gemini creates personality and narrative, while deterministic code protects puzzle fairness.

We also learned that believable AI voice experiences depend on more than speech generation. Timing, positioning, filtering, subtitles, music mixing, and failure handling are equally important.

Most importantly, we learned to design AI as an enhancement rather than a dependency. The complete game still works through validated data and fallback content.

## What's next for EscapeTheStorm

Next, we want to add more dream themes, puzzle types, memories, character voices, and room layouts. We also plan to improve accessibility, mobile controls, narrator voice selection, and visual polish.

Longer term, we want players to share dream seeds, collect their generated journals, and explore connected dream locations such as a security room and an AI control room, building EscapeTheStorm into a larger journey through changing memories and fears.

## Run it

Requirements: Node 22+, a Gemini API key, and an ElevenLabs API key.

```bash
git clone https://github.com/armin-mehrabian/StormHacks-2026.git
cd StormHacks-2026
npm install
cp .env.example .env    # then fill in your keys
npm run dev
```

Open **http://localhost:5173** for a new dream every time, or **http://localhost:5173/?demo** for the handcrafted demo dream (Maya, the night before her violin audition).

`.env`:

```
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...        # needs Text to Speech (and Sound Effects / Music to regenerate assets)
ELEVENLABS_VOICE_ID=...       # optional default narrator voice
```

**Controls:** WASD / arrows to move · E to inspect · N for the dream notebook · M to mute. Headphones recommended for the 3D audio.

| Script | What it does |
|---|---|
| `npm run dev` | Client (Vite) and server (Express) together |
| `npm run build` | Type-check client and server, then build |
| `npm run sfx` | Regenerate missing sound effects with ElevenLabs |
| `npm run music` | Recompose the soundtrack with ElevenLabs Music |
| `npm run voice:design` | Audition custom narrator voices with ElevenLabs Voice Design |
