// Places non-interactive decor for a room: windows and sconces on the back wall, cobwebs
// in the corners, and clutter on free floor tiles. Deterministic per room title, so a
// room always looks the same. Pure, so it can be previewed outside Phaser.

import { KIND_TAGS } from '../shared/blueprint.ts'
import type { ObjectKind } from '../shared/blueprint.ts'
import { CLUTTER_KEYS, COBWEB_KEY, FAIRY_LIGHT_KEY, POSTER_KEYS, SCONCE_KEY, WINDOW_KEY } from './art.ts'
import { TILE_SIZE } from './rooms/layout.ts'
import type { RoomData } from './rooms/types'

export type DecorLayer = 'wall' | 'floor'

export interface DecorPiece {
  key: string
  x: number
  y: number
  layer: DecorLayer
  flipX?: boolean
  /** Glowing pieces (fairy lights) show through the darkness, tinted this colour. */
  glow?: number
}

export interface DecorLight {
  x: number
  y: number
  kind: 'moon' | 'candle'
}

export interface DecorPlan {
  pieces: DecorPiece[]
  lights: DecorLight[]
  /** Window positions, for moonlight shafts. */
  windows: { x: number; width: number }[]
}

/** Back-wall columns that never hold slot objects (between slots and beside the door). */
const WINDOW_COLS = [4, 15] as const
const SCONCE_COLS = [8, 11] as const
const CLUTTER_COUNT = 7

/** Tiles kept clear: in front of the door and around the spawn point. */
const KEEP_CLEAR = [
  { col: 8, row: 1, cols: 4, rows: 2 },
  { col: 9, row: 12, cols: 3, rows: 2 },
] as const

export function planDecor(room: RoomData, seed: string): DecorPlan {
  const pieces: DecorPiece[] = []
  const lights: DecorLight[] = []
  const windows: DecorPlan['windows'] = []

  // A themed poster replaces the second window when the room says something about its owner.
  const poster = posterTheme(room)
  WINDOW_COLS.forEach((col, i) => {
    if (poster && i === WINDOW_COLS.length - 1) {
      pieces.push({ key: POSTER_KEYS[poster], x: col * TILE_SIZE, y: 0, layer: 'wall' })
      return
    }
    pieces.push({ key: WINDOW_KEY, x: col * TILE_SIZE, y: 0, layer: 'wall' })
    lights.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: TILE_SIZE * 1.6, kind: 'moon' })
    windows.push({ x: col * TILE_SIZE + 4, width: TILE_SIZE - 8 })
  })

  // A string of fairy lights along the top of the back wall.
  const BULBS = [0xffd27a, 0xff8fb1, 0x8fd6ff, 0xb6ff9b]
  for (let x = TILE_SIZE + 6, i = 0; x < room.width - TILE_SIZE; x += 22, i++) {
    const sag = Math.round(Math.sin((x / 88) * Math.PI) * 2) * 2
    pieces.push({ key: FAIRY_LIGHT_KEY, x, y: 4 + Math.abs(sag), layer: 'wall', glow: BULBS[i % BULBS.length] })
  }
  for (const col of SCONCE_COLS) {
    pieces.push({ key: SCONCE_KEY, x: col * TILE_SIZE, y: 0, layer: 'wall' })
    lights.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: 8, kind: 'candle' })
  }

  pieces.push({ key: COBWEB_KEY, x: TILE_SIZE, y: TILE_SIZE, layer: 'floor' })
  pieces.push({ key: COBWEB_KEY, x: room.width - TILE_SIZE - 24, y: TILE_SIZE, layer: 'floor', flipX: true })

  // Free floor tiles: inside the walls, not under furniture, not in kept-clear areas.
  const cols = room.width / TILE_SIZE
  const rows = room.height / TILE_SIZE
  const blocked = new Set<string>()
  const block = (col: number, row: number, w: number, h: number) => {
    for (let c = col; c < col + w; c++) for (let r = row; r < row + h; r++) blocked.add(`${c},${r}`)
  }
  for (const object of room.objects) {
    if (object.hangs) continue
    block(object.x / TILE_SIZE, object.y / TILE_SIZE, object.width / TILE_SIZE, object.height / TILE_SIZE)
  }
  for (const area of KEEP_CLEAR) block(area.col, area.row, area.cols, area.rows)

  const free: { col: number; row: number; order: number }[] = []
  const seedHash = hashString(seed)
  for (let col = 1; col < cols - 1; col++) {
    for (let row = 2; row < rows - 1; row++) {
      if (!blocked.has(`${col},${row}`)) free.push({ col, row, order: hashInts(col, row, seedHash) })
    }
  }
  free.sort((a, b) => a.order - b.order)
  free.slice(0, CLUTTER_COUNT).forEach((tile, i) => {
    // Even offsets keep sprites on the 2px art-pixel grid (no shimmer).
    const jitterX = 2 * (Math.floor(hashInts(tile.col, i, seedHash + 1) * 6) - 3)
    const jitterY = 2 * (Math.floor(hashInts(i, tile.row, seedHash + 2) * 6) - 3)
    pieces.push({
      key: CLUTTER_KEYS[(i + seedHash) % CLUTTER_KEYS.length] ?? CLUTTER_KEYS[0],
      x: tile.col * TILE_SIZE + jitterX,
      y: tile.row * TILE_SIZE + jitterY,
      layer: 'floor',
    })
  })

  return { pieces, lights, windows }
}

/** A poster theme from the furniture in the room, if any fits. */
function posterTheme(room: RoomData): keyof typeof POSTER_KEYS | undefined {
  const tags = new Set(room.objects.flatMap((o) => (o.kind === 'door' ? [] : (KIND_TAGS[o.kind as ObjectKind] ?? []))))
  for (const theme of ['music', 'sport', 'night', 'art'] as const) if (tags.has(theme)) return theme
  return undefined
}

function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function hashInts(a: number, b: number, seed: number): number {
  let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + seed
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
