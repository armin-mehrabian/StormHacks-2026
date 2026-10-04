// Placeholder art. The final art style is undecided, so every visual is either a
// generated texture under a stable key or a flat colour from PLACEHOLDER_COLORS.
// To swap in real art, load an image under the same key in a scene's preload():
// generation is skipped for any key that already exists.

import Phaser from 'phaser'
import type { RoomData } from './rooms/types'

export const PLACEHOLDER_COLORS = {
  background: 0x111118,
  floor: 0x3b3245,
  wall: 0x1f1a26,
  player: 0x7fd1ff,
  playerOutline: 0x0b3a55,
  object: 0x9a6a3c,
  objectOutline: 0x4a2f16,
  objectDetail: 0xe0c48a,
} as const

export const PLAYER_TEXTURE_KEY = 'player'
export const PLAYER_SIZE = 20

/** Texture key for a room object, derived from its stable ID. */
export function objectTextureKey(objectId: string): string {
  return `object-${objectId}`
}

export function createPlaceholderTextures(scene: Phaser.Scene, room: RoomData): void {
  const g = scene.make.graphics({}, false)

  if (!scene.textures.exists(PLAYER_TEXTURE_KEY)) {
    g.clear()
    g.fillStyle(PLACEHOLDER_COLORS.playerOutline)
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE)
    g.fillStyle(PLACEHOLDER_COLORS.player)
    g.fillRect(2, 2, PLAYER_SIZE - 4, PLAYER_SIZE - 4)
    g.generateTexture(PLAYER_TEXTURE_KEY, PLAYER_SIZE, PLAYER_SIZE)
  }

  for (const object of room.objects) {
    const key = objectTextureKey(object.id)
    if (scene.textures.exists(key)) continue
    const { width, height } = object
    g.clear()
    g.fillStyle(PLACEHOLDER_COLORS.objectOutline)
    g.fillRect(0, 0, width, height)
    g.fillStyle(PLACEHOLDER_COLORS.object)
    g.fillRect(2, 2, width - 4, height - 4)
    // A centred handle so a box reads as furniture.
    g.fillStyle(PLACEHOLDER_COLORS.objectDetail)
    g.fillRect(width / 2 - 6, height / 2 - 2, 12, 4)
    g.generateTexture(key, width, height)
  }

  g.destroy()
}
