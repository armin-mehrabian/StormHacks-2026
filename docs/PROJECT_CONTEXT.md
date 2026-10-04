# EscapeRoom A — Project Context

- **Name:** EscapeRoom A
- **Event:** StormHacks 2026
- **Product:** A web-based, top-down pixel-art escape room game.

## Core Gameplay

The player moves through rooms, inspects objects, gathers clues, solves a puzzle, and escapes before the timer ends.

- The player does **not** speak to objects.
- Microphone input is **not** part of the game.

## AI Narrator

An AI narrator observes meaningful game events and reacts with short spoken lines: hints, warnings, praise, and occasional sarcastic remarks.

- **Gemini** generates contextual narrator text from structured game events.
- **ElevenLabs** voices that text and may supply sound effects.
- The **game engine, not Gemini,** controls puzzle solutions, inventory, the timer, and win conditions. The narrator only comments; it never decides game state.

## Long-Term Idea

Three rooms: **Bedroom**, **Security Room**, and **AI Control Room**.

In the final room the narrator can become unreliable. Any lie must be defined by the puzzle data so the game remains fair. Gemini must not invent lies on its own.

## Milestones

### Immediate: one Bedroom prototype

- Player moves around the Bedroom.
- Player inspects a drawer three times.
- Player hears a contextual sarcastic narrator line with a matching subtitle.

### After that milestone (in order)

1. Complete Bedroom puzzle
2. Inventory
3. Timer
4. Additional rooms

## Resilience Requirement

A failed or slow API request must **not** block movement or make the puzzle impossible. The game must stay fully playable without Gemini or ElevenLabs.

## Decisions Needed (project owner)

Do not invent final answers for these; build so they can be swapped later.

- [ ] Final art style
- [ ] Narrator voice
- [ ] Exact Bedroom puzzle solution
- [ ] Final room puzzle (AI Control Room)
