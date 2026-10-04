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
import { FALLBACK_ROOM } from './shared/fallbackRoom.ts'
import { CodeLock } from './ui/CodeLock.ts'
import { EndScreen } from './ui/EndScreen.ts'
import { Hud } from './ui/Hud.ts'
import { Notice } from './ui/Notice.ts'
import { PageOverlay } from './ui/PageOverlay.ts'
import { showStartScreen } from './ui/StartScreen.ts'
import { Subtitle } from './ui/Subtitle.ts'

const unsubscribeLogger = gameEvents.subscribe((event) => {
  console.info('[GameEvent]', event)
})

const sound = new SoundEngine()
// Decode the SFX library while the title screen is up.
const soundReady = sound.preload()

const audio = new AudioManager({ createPlayback: sound.voicePlayback })
const subtitle = new Subtitle()
const narrator = new NarratorManager(gameEvents, audio, subtitle)
const stopNarrator = narrator.start()

const pages = new PageOverlay()
const ui = {
  hud: new Hud((page) => {
    sound.play('page-unfold')
    pages.show(page)
  }),
  pages,
  codeLock: new CodeLock(() => sound.play('keypad-beep', { volume: 0.7, rate: 0.95 + Math.random() * 0.1 })),
  endScreen: new EndScreen(),
  notice: new Notice(),
}

// M mutes everything: narrator voice (and its credit-using requests) plus all sound.
function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'm' && event.key !== 'M') return
  const muted = !audio.isMuted()
  audio.setMuted(muted)
  sound.setMuted(muted)
  ui.notice.show(muted ? 'Sound off' : 'Sound on', 1200)
}
window.addEventListener('keydown', onKeyDown)

// Stage 3 replaces this with a Gemini-generated room (FALLBACK_ROOM stays the last resort).
const state = new GameState(FALLBACK_ROOM)
const sceneData: BedroomSceneData = {
  state,
  ui,
  sound,
  readAloud: (text) => void narrator.readAloud(text),
}

let game: Phaser.Game | undefined
void showStartScreen().then(async () => {
  // The Start click is the user gesture browsers require before audio can play.
  await sound.unlock()
  await soundReady
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
  game?.destroy(true)
})
