import Phaser from 'phaser'
import { createGameConfig } from './game/config'
import { gameEvents } from './game/events'

// Temporary: log every GameEvent until the NarratorManager subscribes.
const unsubscribeLogger = gameEvents.subscribe((event) => {
  console.info('[GameEvent]', event)
})

const game = new Phaser.Game(createGameConfig())

// Avoid stacked canvases and duplicate listeners when Vite hot-reloads this module.
import.meta.hot?.dispose(() => {
  unsubscribeLogger()
  game.destroy(true)
})
