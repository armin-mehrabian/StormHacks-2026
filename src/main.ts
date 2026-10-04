import Phaser from 'phaser'
import { AudioManager } from './audio/AudioManager.ts'
import { createGameConfig } from './game/config'
import { gameEvents } from './game/events'
import { NarratorManager } from './narrator/NarratorManager.ts'
import { Subtitle } from './ui/Subtitle.ts'

const unsubscribeLogger = gameEvents.subscribe((event) => {
  console.info('[GameEvent]', event)
})

const audio = new AudioManager()
const subtitle = new Subtitle()
const stopNarrator = new NarratorManager(gameEvents, audio, subtitle).start()

// Temporary mute toggle until the design pass adds audio controls.
function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'm' && event.key !== 'M') return
  audio.setMuted(!audio.isMuted())
  console.info(`[Audio] narrator voice ${audio.isMuted() ? 'muted' : 'unmuted'}`)
}
window.addEventListener('keydown', onKeyDown)

const game = new Phaser.Game(createGameConfig())

// Avoid stacked canvases and duplicate listeners when Vite hot-reloads this module.
import.meta.hot?.dispose(() => {
  unsubscribeLogger()
  stopNarrator()
  window.removeEventListener('keydown', onKeyDown)
  audio.clear()
  subtitle.destroy()
  game.destroy(true)
})
