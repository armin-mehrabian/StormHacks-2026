// Shapes for room data. Coordinates are in world pixels; rects are top-left anchored.

import type { ObjectKind } from '../../shared/blueprint.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface RoomObjectData extends Rect {
  /** Stable ID shared by the blueprint, gameplay, and narration. */
  id: string
  kind: ObjectKind | 'door'
  /** Display name for prompts and messages. */
  label: string
  /** Blocks player movement. */
  solid: boolean
  /** Can be inspected with the interact key. */
  interactable: boolean
  /** Drawn on the back wall's face rather than standing on the floor. */
  hangs: boolean
}

export interface RoomData {
  /** Stable room ID, used as GameEvent.roomId. */
  id: string
  width: number
  height: number
  playerSpawn: { x: number; y: number }
  walls: Rect[]
  objects: RoomObjectData[]
}
