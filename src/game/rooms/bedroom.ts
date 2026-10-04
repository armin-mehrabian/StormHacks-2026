// Bedroom room data: the single source for its object IDs and layout.

import type { RoomData } from './types'

export const TILE_SIZE = 32

const COLS = 20
const ROWS = 15
const WIDTH = COLS * TILE_SIZE
const HEIGHT = ROWS * TILE_SIZE
const WALL = TILE_SIZE

export const BEDROOM: RoomData = {
  id: 'bedroom',
  width: WIDTH,
  height: HEIGHT,
  playerSpawn: { x: WIDTH / 2, y: HEIGHT - WALL * 3 },
  walls: [
    { x: 0, y: 0, width: WIDTH, height: WALL },
    { x: 0, y: HEIGHT - WALL, width: WIDTH, height: WALL },
    { x: 0, y: 0, width: WALL, height: HEIGHT },
    { x: WIDTH - WALL, y: 0, width: WALL, height: HEIGHT },
  ],
  objects: [
    {
      id: 'drawer',
      label: 'Drawer',
      x: WALL * 3,
      y: WALL,
      width: TILE_SIZE * 2,
      height: TILE_SIZE + TILE_SIZE / 2,
      solid: true,
      interactable: true,
    },
  ],
}
