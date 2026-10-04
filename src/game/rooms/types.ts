// Shapes for room data. Coordinates are in world pixels; rects are top-left anchored.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface RoomObjectData extends Rect {
  /** Stable ID shared by room data, gameplay, and narration. Never rename in one place only. */
  id: string
  /** Display name for prompts and messages. */
  label: string
  /** Blocks player movement. */
  solid: boolean
  /** Can be inspected with the interact key. */
  interactable: boolean
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
