import Phaser from 'phaser'

export const GAME_PARENT_ID = 'game'

/** Viewport in game pixels; the camera zooms 2x into the room, so this shows ~14x8 tiles. */
const VIEW_WIDTH = 896
const VIEW_HEIGHT = 504

/** Scenes are added by the caller with their data (see main.ts). */
export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: GAME_PARENT_ID,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: '#06040c',
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  }
}
