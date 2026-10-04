import Phaser from 'phaser'
import { PLACEHOLDER_COLORS } from './placeholderArt'
import { BEDROOM } from './rooms/bedroom'
import { BedroomScene } from './scenes/BedroomScene'

export const GAME_PARENT_ID = 'game'

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: GAME_PARENT_ID,
    width: BEDROOM.width,
    height: BEDROOM.height,
    backgroundColor: PLACEHOLDER_COLORS.background,
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BedroomScene],
  }
}
