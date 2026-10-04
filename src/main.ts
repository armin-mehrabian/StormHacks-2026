import Phaser from 'phaser'
import './ui/ui.css'
import { AudioManager } from './audio/AudioManager.ts'
import { SoundEngine } from './audio/SoundEngine.ts'
import { createGameConfig } from './game/config'
import { gameEvents } from './game/events'
import { BedroomScene } from './game/scenes/BedroomScene.ts'
import type { BedroomSceneData } from './game/scenes/BedroomScene.ts'
import { GameState } from './game/state.ts'
import { NarratorManager } from './narrator/NarratorManager.ts'
import { loadDream } from './narrator/dream.ts'
import { memoryEffect } from './shared/blueprint.ts'
import { API_PATHS } from './shared/contract.ts'
import type { JournalRequest, JournalResponse } from './shared/contract.ts'
import { CodeLock } from './ui/CodeLock.ts'
import { EndScreen } from './ui/EndScreen.ts'
import { Hud } from './ui/Hud.ts'
import { playIntro } from './ui/Intro.ts'
import { Notice } from './ui/Notice.ts'
import { Notebook } from './ui/Notebook.ts'
import { ChoicePuzzle, IdentityBoard, PianoPuzzle } from './ui/StoryPuzzles.ts'
import { PageOverlay } from './ui/PageOverlay.ts'
import { showStartScreen } from './ui/StartScreen.ts'
import { Subtitle } from './ui/Subtitle.ts'

const unsubscribeLogger = gameEvents.subscribe((event) => {
  console.info('[GameEvent]', event)
})

// ?demo plays the handmade, rehearsed dream; otherwise Gemini dreams a new one.
const demo = new URLSearchParams(window.location.search).has('demo')
const dreamReady = loadDream(demo)

const sound = new SoundEngine()
// Decode the SFX library and soundtrack while the title screen is up.
const soundReady = sound.preload()

const audio = new AudioManager({ createPlayback: sound.voicePlayback })
const subtitle = new Subtitle()
const narrator = new NarratorManager(gameEvents, audio, subtitle)
const stopNarrator = narrator.start()

const pages = new PageOverlay()
const notebook = new Notebook()
const ui = {
  hud: new Hud(
    (page) => {
      sound.play('page-unfold')
      pages.show(page)
    },
    () => notebook.toggle(),
  ),
  pages,
  codeLock: new CodeLock(() => sound.play('keypad-beep', { volume: 0.7, rate: 0.95 + Math.random() * 0.1 })),
  endScreen: new EndScreen(),
  notice: new Notice(),
  choice: new ChoicePuzzle(),
  identity: new IdentityBoard(),
  piano: new PianoPuzzle((note) => sound.playNote(note)),
  notebook,
}

// M mutes everything: narrator voice (and its credit-using requests) plus all sound.
function onKeyDown(event: KeyboardEvent): void {
  // N opens the notebook (it closes itself), unless another screen is up.
  if ((event.key === 'n' || event.key === 'N') && game && !notebook.isOpen && !document.querySelector('.overlay:not([hidden])')) {
    notebook.open()
    return
  }
  if (event.key !== 'm' && event.key !== 'M') return
  const muted = !audio.isMuted()
  audio.setMuted(muted)
  sound.setMuted(muted)
  ui.notice.show(muted ? 'Sound off' : 'Sound on', 1200)
}
window.addEventListener('keydown', onKeyDown)

let game: Phaser.Game | undefined
void showStartScreen(dreamReady).then(async () => {
  // The Start click is the user gesture browsers require before audio can play.
  await sound.unlock()
  const { blueprint } = await dreamReady
  await soundReady

  narrator.setDreamer(blueprint.dreamer)
  const state = new GameState(blueprint)
  const sceneData: BedroomSceneData = {
    state,
    ui,
    sound,
    voice: {
      readAloud: (text) => void narrator.readAloud(text),
      prefetchMemories: (memories) => narrator.prefetchMemories(memories),
      playMemory: (objectId, memory) => {
        const kind = blueprint.objects.find((o) => o.id === objectId)?.kind
        const effect = (kind && memoryEffect(kind)) ?? 'room'
        void narrator.playMemory(objectId, memory, (clip) => sound.tagEffect(clip, effect), () => {})
      },
    },
    onEnd: (stats) => {
      // The dreamer writes the journal, then reads it aloud once the ending line is done.
      const request: JournalRequest = { dreamer: blueprint.dreamer, title: blueprint.title, stats }
      void fetch(API_PATHS.journal, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10_000),
      })
        .then((response) => (response.ok ? (response.json() as Promise<JournalResponse>) : Promise.reject(new Error(`HTTP ${response.status}`))))
        .then(({ entry }) => {
          ui.endScreen.setJournal(entry, blueprint.dreamer, blueprint.title, stats)
          void narrator.readAloud(entry)
        })
        .catch((error) => {
          console.warn('[Journal] unavailable:', error)
          ui.endScreen.setJournal('Dear diary, I had the strangest dream. I can barely remember it now.', blueprint.dreamer, blueprint.title, stats)
        })
    },
  }

  await playIntro(['2:47 AM', "Somewhere, someone can't sleep.", blueprint.introLine, '...and you just fell into their dream.'], () =>
    sound.play('heartbeat', { volume: 0.8 }),
  )
  sound.play('wake-up', { bus: 'ambience', volume: 0.9 })
  game = new Phaser.Game(createGameConfig())
  game.scene.add(BedroomScene.KEY, BedroomScene, true, sceneData)
})

// Avoid stacked canvases and duplicate listeners when Vite hot-reloads this module.
import.meta.hot?.dispose(() => {
  unsubscribeLogger()
  stopNarrator()
  window.removeEventListener('keydown', onKeyDown)
  audio.clear()
  sound.setMuted(true)
  subtitle.destroy()
  ui.hud.destroy()
  ui.pages.destroy()
  ui.codeLock.destroy()
  ui.endScreen.destroy()
  ui.notice.destroy()
  ui.choice.destroy()
  ui.identity.destroy()
  ui.piano.destroy()
  ui.notebook.destroy()
  game?.destroy(true)
})
