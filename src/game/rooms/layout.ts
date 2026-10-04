// Turns a blueprint's slot assignments into pixel geometry. Slots are 3x3 tile areas;
// each object is anchored against its wall (or centred on the floor) inside its slot.

import {
  DOOR_ID,
  DOOR_TILES,
  KIND_SPECS,
  PLAYER_SPAWN_TILE,
  ROOM_COLS,
  ROOM_ROWS,
  SLOTS,
} from '../../shared/blueprint.ts'
import type { RoomBlueprint } from '../../shared/blueprint.ts'
import type { RoomData, RoomObjectData } from './types.ts'

export const TILE_SIZE = 32
export const ROOM_ID = 'bedroom'

const SLOT_SPAN = 3

export function layoutRoom(blueprint: RoomBlueprint): RoomData {
  const width = ROOM_COLS * TILE_SIZE
  const height = ROOM_ROWS * TILE_SIZE
  const wall = TILE_SIZE

  const objects: RoomObjectData[] = blueprint.objects.map((object) => {
    const spec = KIND_SPECS[object.kind]
    const slot = SLOTS[object.slot]
    const centredCol = slot.col + Math.floor((SLOT_SPAN - spec.width) / 2)
    const centredRow = slot.row + Math.floor((SLOT_SPAN - spec.height) / 2)
    const col = slot.side === 'left' ? slot.col : slot.side === 'right' ? slot.col + SLOT_SPAN - spec.width : centredCol
    // Hanging kinds sit on the back wall's face (row 0), above their slot.
    const row = spec.hangs ? 0 : slot.side === 'top' ? slot.row : centredRow
    return {
      id: object.id,
      kind: object.kind,
      label: object.name,
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
      width: spec.width * TILE_SIZE,
      height: spec.height * TILE_SIZE,
      solid: spec.solid,
      interactable: true,
      hangs: spec.hangs ?? false,
    }
  })

  objects.push({
    id: DOOR_ID,
    kind: 'door',
    label: 'Door',
    x: DOOR_TILES.col * TILE_SIZE,
    y: DOOR_TILES.row * TILE_SIZE,
    width: DOOR_TILES.width * TILE_SIZE,
    height: DOOR_TILES.height * TILE_SIZE,
    // The door sits inside the top wall, which already blocks movement.
    solid: false,
    interactable: true,
    hangs: false,
  })

  return {
    id: ROOM_ID,
    width,
    height,
    playerSpawn: {
      x: PLAYER_SPAWN_TILE.col * TILE_SIZE + TILE_SIZE / 2,
      y: PLAYER_SPAWN_TILE.row * TILE_SIZE + TILE_SIZE / 2,
    },
    walls: [
      { x: 0, y: 0, width, height: wall },
      { x: 0, y: height - wall, width, height: wall },
      { x: 0, y: 0, width: wall, height },
      { x: width - wall, y: 0, width: wall, height },
    ],
    objects,
  }
}
