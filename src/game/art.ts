// Procedural pixel art. Every sprite is drawn at "art resolution" (16 art px per tile)
// into a canvas texture, then displayed at 2x with pixelArt rendering, so the whole room
// shares one palette and one pixel grid. Real art can replace any texture by key.

import type Phaser from 'phaser'
import type { RoomObjectData } from './rooms/types'

/** Art pixels per world pixel is 1:2 (a 32px tile is 16 art px). */
export const ART_SCALE = 2
const T = 16

// Cozy-creepy palette.
const C = {
  woodDark: '#2e1a12',
  wood: '#5a3622',
  woodMid: '#7a4a2c',
  woodLight: '#9a6338',
  woodHi: '#b97c45',
  floorA: '#3a2619',
  floorB: '#432c1d',
  floorC: '#33211a',
  floorLine: '#24160f',
  wallpaper: '#2a2a40',
  wallpaperDark: '#212034',
  wallpaperFleck: '#3a3a5a',
  trim: '#4b3326',
  trimHi: '#6e4b36',
  wallTop: '#17121f',
  wallEdge: '#2b2238',
  red: '#7a2632',
  redHi: '#9c3a46',
  redDark: '#561a24',
  cream: '#e9dcc0',
  creamShade: '#c7b694',
  teal: '#2f6066',
  tealHi: '#3f7b80',
  green: '#3d7a3a',
  greenHi: '#5ca04f',
  greenDark: '#2a5528',
  terracotta: '#9a4f2f',
  terracottaHi: '#b8653d',
  metal: '#59606d',
  metalHi: '#8b94a4',
  metalDark: '#3a3f49',
  gold: '#c9a227',
  goldHi: '#efd065',
  ink: '#1a1420',
  paper: '#efe4c8',
  skin: '#e2b38f',
  hair: '#3b2416',
  shirt: '#3d6e8f',
  shirtHi: '#4f88ad',
  pants: '#2c2c3e',
  shoe: '#1a1420',
  lampGlow: '#ffe7a3',
  books: ['#7a2632', '#2f6066', '#c9a227', '#3d7a3a', '#5c4a8a', '#9a4f2f'],
} as const

type Ctx = CanvasRenderingContext2D

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** Draws a canvas texture once; skipped if the key already exists (e.g. real art loaded). */
function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, w, h)
  if (!texture) return
  draw(texture.context)
  texture.refresh()
}

// Deterministic noise so floors look varied but identical across reloads.
function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263
  n = (n ^ (n >> 13)) * 1274126177
  return ((n ^ (n >> 16)) >>> 0) / 4294967295
}

// ---------------------------------------------------------------------------------------
// Room surfaces
// ---------------------------------------------------------------------------------------

export const FLOOR_KEY = 'art-floor'
/** Wallpaper colours (base, stripe, fleck) per dream mood. Initial implementation choice. */
const WALLPAPERS: Record<string, [string, string, string]> = {
  violet: ['#2a2a40', '#212034', '#3a3a5a'],
  blue: ['#1f2f45', '#182538', '#2f4766'],
  amber: ['#3a2c1f', '#2e2218', '#55412c'],
  green: ['#1f3529', '#182a20', '#2e4d3b'],
  rose: ['#3a2230', '#2e1a26', '#553245'],
}

/** The back wall's texture key for a dream mood. */
export function wallFaceKey(mood: string): string {
  return `art-wall-face-${mood}`
}
export const WALL_TOP_KEY = 'art-wall-top'

/** The whole floor as one texture (cols x rows tiles), planks running horizontally. */
function drawFloor(ctx: Ctx, cols: number, rows: number): void {
  for (let row = 0; row < rows * 2; row++) {
    const y = row * 8
    // Staggered plank seams per 8px row.
    const offset = (row * 11) % 24
    for (let x = -offset; x < cols * T; x += 24) {
      const shade = hash(x, row)
      rect(ctx, x, y, 24, 8, shade < 0.33 ? C.floorA : shade < 0.66 ? C.floorB : C.floorC)
      rect(ctx, x, y + 7, 24, 1, C.floorLine)
      rect(ctx, x, y, 1, 7, C.floorLine)
      // Wood grain flecks.
      for (let i = 0; i < 3; i++) {
        const gx = x + 3 + Math.floor(hash(x + i, row * 7) * 18)
        const gy = y + 1 + Math.floor(hash(row + i, x) * 5)
        rect(ctx, gx, gy, 2 + Math.floor(hash(gx, gy) * 3), 1, C.floorLine)
      }
    }
  }
}

function drawWallFace(ctx: Ctx, cols: number, mood: string): void {
  const w = cols * T
  const [base, stripe, fleck] = WALLPAPERS[mood] ?? WALLPAPERS.violet ?? [C.wallpaper, C.wallpaperDark, C.wallpaperFleck]
  rect(ctx, 0, 0, w, T, base)
  // Vertical stripes and a small damask fleck.
  for (let x = 0; x < w; x += 6) rect(ctx, x, 2, 2, T - 4, stripe)
  for (let x = 3; x < w; x += 12) {
    rect(ctx, x, 6, 1, 1, fleck)
    rect(ctx, x + 6, 10, 1, 1, fleck)
  }
  // Crown molding and baseboard.
  rect(ctx, 0, 0, w, 2, C.trim)
  rect(ctx, 0, 0, w, 1, C.trimHi)
  rect(ctx, 0, T - 3, w, 3, C.trim)
  rect(ctx, 0, T - 3, w, 1, C.trimHi)
}

function drawWallTop(ctx: Ctx): void {
  rect(ctx, 0, 0, T, T, C.wallTop)
  rect(ctx, 0, 0, T, 1, C.wallEdge)
}

// ---------------------------------------------------------------------------------------
// Furniture (one texture per kind, sized to its footprint)
// ---------------------------------------------------------------------------------------

const FURNITURE: Record<RoomObjectData['kind'], (ctx: Ctx, w: number, h: number) => void> = {
  bed(ctx, w, h) {
    rect(ctx, 1, 0, w - 2, h - 1, C.woodDark)
    rect(ctx, 2, 1, w - 4, 6, C.wood) // headboard
    rect(ctx, 2, 1, w - 4, 1, C.woodHi)
    rect(ctx, 3, 7, w - 6, h - 11, C.cream) // sheet
    rect(ctx, 4, 8, w / 2 - 5, 5, C.paper) // pillows
    rect(ctx, w / 2 + 1, 8, w / 2 - 5, 5, C.paper)
    rect(ctx, 4, 12, w / 2 - 5, 1, C.creamShade)
    rect(ctx, w / 2 + 1, 12, w / 2 - 5, 1, C.creamShade)
    rect(ctx, 3, 16, w - 6, h - 20, C.red) // blanket
    rect(ctx, 3, 16, w - 6, 2, C.redHi)
    rect(ctx, 3, 18, w - 6, 1, C.cream) // folded edge
    for (let y = 22; y < h - 6; y += 5) rect(ctx, 5, y, w - 10, 1, C.redDark)
    rect(ctx, 2, h - 4, w - 4, 3, C.wood) // footboard
    rect(ctx, 2, h - 4, w - 4, 1, C.woodHi)
  },
  desk(ctx, w, h) {
    rect(ctx, 0, 0, w, h - 2, C.woodDark)
    rect(ctx, 1, 1, w - 2, h - 14, C.woodLight) // top
    rect(ctx, 1, 1, w - 2, 1, C.woodHi)
    rect(ctx, 1, h - 13, w - 2, 10, C.woodMid) // front
    rect(ctx, 3, h - 11, 12, 6, C.wood) // drawers
    rect(ctx, w - 15, h - 11, 12, 6, C.wood)
    rect(ctx, 8, h - 9, 2, 1, C.gold)
    rect(ctx, w - 10, h - 9, 2, 1, C.gold)
    rect(ctx, 2, h - 3, 2, 3, C.woodDark) // legs
    rect(ctx, w - 4, h - 3, 2, 3, C.woodDark)
    rect(ctx, 6, 3, 9, 7, C.paper) // papers and a mug
    rect(ctx, 7, 5, 6, 1, C.creamShade)
    rect(ctx, 7, 7, 5, 1, C.creamShade)
    rect(ctx, w - 12, 4, 4, 4, C.teal)
    rect(ctx, w - 12, 4, 4, 1, C.tealHi)
  },
  bookshelf(ctx, w, h) {
    rect(ctx, 0, 0, w, h, C.woodDark)
    rect(ctx, 1, 1, w - 2, h - 2, C.wood)
    rect(ctx, 1, 1, w - 2, 1, C.woodHi)
    let x = 2
    let i = 0
    while (x < w - 3) {
      const bw = 2 + Math.floor(hash(i, 3) * 2)
      const bh = 8 + Math.floor(hash(i, 9) * 4)
      rect(ctx, x, h - 2 - bh, bw, bh, C.books[i % C.books.length] ?? C.red)
      rect(ctx, x, h - 2 - bh, bw, 1, C.cream)
      x += bw + (hash(i, 5) > 0.8 ? 2 : 0)
      i++
    }
    rect(ctx, 1, h - 2, w - 2, 1, C.woodHi)
  },
  dresser(ctx, w, h) {
    rect(ctx, 0, 0, w, h, C.woodDark)
    rect(ctx, 1, 1, w - 2, 4, C.woodLight)
    rect(ctx, 1, 1, w - 2, 1, C.woodHi)
    rect(ctx, 2, 6, w - 4, h - 8, C.woodMid)
    rect(ctx, 3, 7, w - 6, h - 10, C.wood) // the drawer
    rect(ctx, w / 2 - 2, 9, 4, 2, C.gold)
    rect(ctx, w / 2 - 1, 9, 2, 1, C.goldHi)
  },
  wardrobe(ctx, w, h) {
    rect(ctx, 0, 0, w, h, C.woodDark)
    rect(ctx, 1, 0, w - 2, 3, C.woodLight) // cornice
    rect(ctx, 1, 0, w - 2, 1, C.woodHi)
    rect(ctx, 2, 4, w / 2 - 3, h - 6, C.woodMid)
    rect(ctx, w / 2 + 1, 4, w / 2 - 3, h - 6, C.woodMid)
    rect(ctx, 3, 5, w / 2 - 5, h - 8, C.wood)
    rect(ctx, w / 2 + 2, 5, w / 2 - 5, h - 8, C.wood)
    rect(ctx, w / 2 - 2, h / 2, 1, 3, C.gold)
    rect(ctx, w / 2 + 1, h / 2, 1, 3, C.gold)
  },
  nightstand(ctx, w, h) {
    rect(ctx, 1, 1, w - 2, h - 2, C.woodDark)
    rect(ctx, 2, 2, w - 4, 5, C.woodLight)
    rect(ctx, 2, 2, w - 4, 1, C.woodHi)
    rect(ctx, 3, 8, w - 6, 5, C.wood)
    rect(ctx, w / 2 - 1, 10, 2, 1, C.gold)
  },
  lamp(ctx, w, h) {
    rect(ctx, 5, 12, 6, 3, C.metalDark) // base
    rect(ctx, 7, 7, 2, 6, C.metal)
    rect(ctx, 3, 2, 10, 7, C.creamShade) // shade
    rect(ctx, 4, 1, 8, 1, C.cream)
    rect(ctx, 4, 2, 8, 5, C.lampGlow)
    rect(ctx, 3, 8, 10, 1, C.trim)
    void w
    void h
  },
  rug(ctx, w, h) {
    rect(ctx, 0, 1, w, h - 2, C.redDark)
    rect(ctx, 2, 3, w - 4, h - 6, C.red)
    rect(ctx, 4, 5, w - 8, h - 10, C.redDark)
    rect(ctx, 6, 7, w - 12, h - 14, C.red)
    // Diamond medallion.
    const cx = w / 2
    const cy = h / 2
    for (let i = 0; i < 4; i++) rect(ctx, cx - i - 1, cy - 3 + i, (i + 1) * 2, 1, C.gold)
    for (let i = 0; i < 3; i++) rect(ctx, cx - 3 + i, cy + 1 + i, (3 - i) * 2, 1, C.gold)
    // Fringe.
    for (let x = 1; x < w - 1; x += 2) {
      rect(ctx, x, 0, 1, 1, C.cream)
      rect(ctx, x, h - 1, 1, 1, C.cream)
    }
  },
  plant(ctx) {
    rect(ctx, 4, 10, 8, 5, C.terracotta)
    rect(ctx, 4, 10, 8, 1, C.terracottaHi)
    rect(ctx, 5, 15, 6, 1, C.terracotta)
    const leaves: [number, number, number, number][] = [
      [7, 1, 2, 9], [3, 3, 3, 2], [10, 3, 3, 2], [2, 6, 4, 2], [10, 6, 4, 2], [5, 4, 2, 5], [9, 4, 2, 5],
    ]
    leaves.forEach(([x, y, lw, lh], i) => rect(ctx, x, y, lw, lh, i % 2 ? C.greenHi : C.green))
    rect(ctx, 6, 9, 4, 1, C.greenDark)
  },
  painting(ctx, w, h) {
    rect(ctx, 0, 1, w, h - 2, C.gold)
    rect(ctx, 0, 1, w, 1, C.goldHi)
    rect(ctx, 2, 3, w - 4, h - 6, C.teal) // sky and water
    rect(ctx, 2, 8, w - 4, h - 11, C.tealHi)
    for (let i = 0; i < 4; i++) {
      // Four little ducks.
      rect(ctx, 4 + i * 6, 9, 3, 2, C.goldHi)
      rect(ctx, 6 + i * 6, 8, 1, 1, C.goldHi)
    }
  },
  clock(ctx) {
    rect(ctx, 3, 1, 10, 13, C.woodDark)
    rect(ctx, 4, 2, 8, 8, C.cream)
    rect(ctx, 4, 2, 8, 1, C.paper)
    rect(ctx, 7, 3, 1, 4, C.ink) // hands
    rect(ctx, 7, 6, 3, 1, C.ink)
    rect(ctx, 7, 11, 2, 3, C.gold) // pendulum
  },
  trash_can(ctx) {
    rect(ctx, 3, 4, 10, 11, C.metalDark)
    rect(ctx, 4, 4, 8, 10, C.metal)
    for (let x = 5; x < 12; x += 2) rect(ctx, x, 6, 1, 8, C.metalDark)
    rect(ctx, 2, 3, 12, 2, C.metalHi)
    rect(ctx, 5, 1, 3, 3, C.paper) // crumpled receipts
    rect(ctx, 8, 2, 3, 2, C.creamShade)
  },
  lockbox(ctx) {
    rect(ctx, 1, 4, 14, 11, C.metalDark)
    rect(ctx, 2, 5, 12, 9, C.metal)
    rect(ctx, 2, 5, 12, 1, C.metalHi)
    rect(ctx, 5, 7, 6, 5, C.ink) // dial window
    rect(ctx, 6, 8, 1, 3, C.gold)
    rect(ctx, 8, 8, 1, 3, C.gold)
    rect(ctx, 10, 8, 1, 3, C.goldHi)
  },
  answering_machine(ctx) {
    rect(ctx, 1, 6, 14, 9, C.ink) // body
    rect(ctx, 2, 7, 12, 7, C.metalDark)
    rect(ctx, 2, 7, 12, 1, C.metal)
    rect(ctx, 3, 9, 6, 3, C.ink) // tape window
    rect(ctx, 4, 10, 1, 1, C.metalHi)
    rect(ctx, 7, 10, 1, 1, C.metalHi)
    rect(ctx, 11, 9, 2, 2, '#ff4d4d') // blinking message light
    rect(ctx, 11, 9, 1, 1, '#ffb0b0')
    rect(ctx, 2, 3, 8, 3, C.ink) // handset
    rect(ctx, 2, 3, 2, 2, C.metalDark)
    rect(ctx, 8, 3, 2, 2, C.metalDark)
  },
  radio(ctx) {
    rect(ctx, 1, 5, 14, 10, C.woodDark)
    rect(ctx, 2, 6, 12, 8, C.woodMid)
    rect(ctx, 2, 6, 12, 1, C.woodHi)
    rect(ctx, 3, 8, 6, 5, C.cream) // speaker grille
    for (let y = 9; y < 13; y += 2) rect(ctx, 3, y, 6, 1, C.creamShade)
    rect(ctx, 10, 8, 3, 3, C.gold) // dial
    rect(ctx, 11, 9, 1, 1, C.ink)
    rect(ctx, 10, 12, 3, 1, C.goldHi)
    rect(ctx, 11, 1, 1, 4, C.metal) // antenna
  },
  music_box(ctx) {
    rect(ctx, 2, 7, 12, 8, C.woodDark)
    rect(ctx, 3, 8, 10, 6, C.red)
    rect(ctx, 3, 8, 10, 1, C.redHi)
    rect(ctx, 5, 10, 6, 2, C.gold) // brass plate
    rect(ctx, 2, 3, 12, 4, C.wood) // open lid
    rect(ctx, 3, 4, 10, 2, C.cream) // mirror inside lid
    rect(ctx, 7, 5, 2, 3, C.goldHi) // tiny dancer
    rect(ctx, 14, 10, 2, 1, C.metalHi) // crank
  },
  mirror(ctx) {
    rect(ctx, 3, 0, 10, 15, C.gold) // ornate frame
    rect(ctx, 3, 0, 10, 1, C.goldHi)
    rect(ctx, 4, 1, 8, 13, '#9fb6d6') // glass
    rect(ctx, 4, 1, 8, 4, '#c6d6ee')
    rect(ctx, 5, 6, 2, 6, '#dfe9f8') // shine streak
    rect(ctx, 7, 3, 1, 2, '#ffffff')
    rect(ctx, 7, 15, 2, 1, C.gold)
  },
  toy_piano(ctx, w, h) {
    rect(ctx, 0, 2, w, h - 3, C.red) // body
    rect(ctx, 0, 2, w, 1, C.redHi)
    rect(ctx, 2, 6, w - 4, 7, C.paper) // white keys
    for (let x = 2 + 5; x < w - 2; x += 5) rect(ctx, x, 6, 1, 7, C.creamShade)
    for (let x = 5; x < w - 4; x += 5) rect(ctx, x, 6, 2, 4, C.ink) // black keys
    rect(ctx, 1, h - 2, 2, 2, C.redDark)
    rect(ctx, w - 3, h - 2, 2, 2, C.redDark)
  },
  fear(ctx, w, h) {
    // A small stage under a harsh spotlight, with a lone violin waiting.
    rect(ctx, 0, h - 9, w, 9, C.woodDark)
    for (let x = 0; x < w; x += 6) rect(ctx, x, h - 9, 1, 9, C.wood)
    rect(ctx, 0, h - 9, w, 1, C.woodHi)
    for (let i = 0; i < h - 9; i++) {
      const half = 3 + Math.floor((i * (w / 2 - 4)) / (h - 9))
      rect(ctx, w / 2 - half, i, half * 2, 1, 'rgba(255, 244, 200, 0.35)') // spotlight cone
    }
    rect(ctx, w / 2 - 6, h - 12, 12, 3, 'rgba(255, 244, 200, 0.6)') // pool of light
    rect(ctx, w / 2 - 2, h - 15, 4, 6, C.woodLight) // violin
    rect(ctx, w / 2 - 1, h - 19, 2, 4, C.wood)
    rect(ctx, w / 2 - 1, h - 13, 2, 1, C.ink)
  },
  record_player(ctx) {
    rect(ctx, 1, 6, 14, 9, C.woodDark) // cabinet
    rect(ctx, 2, 7, 12, 7, C.woodMid)
    rect(ctx, 2, 2, 12, 6, C.ink) // record
    rect(ctx, 4, 3, 8, 4, '#2a2333')
    rect(ctx, 7, 4, 2, 2, C.red) // label
    rect(ctx, 12, 2, 1, 5, C.metalHi) // tone arm
    rect(ctx, 10, 6, 3, 1, C.metalHi)
    rect(ctx, 4, 10, 2, 2, C.gold) // knobs
    rect(ctx, 10, 10, 2, 2, C.gold)
  },
  guitar(ctx, w, h) {
    rect(ctx, 7, 1, 2, 14, C.woodDark) // neck
    rect(ctx, 6, 0, 4, 3, C.wood) // head
    for (let y = 4; y < 15; y += 3) rect(ctx, 7, y, 2, 1, C.metalHi) // frets
    rect(ctx, 3, 15, 10, 13, C.terracotta) // body
    rect(ctx, 4, 14, 8, 2, C.terracottaHi)
    rect(ctx, 5, 26, 6, 2, C.terracotta)
    rect(ctx, 6, 19, 4, 4, C.ink) // sound hole
    rect(ctx, 5, 25, 6, 1, C.woodDark) // bridge
    void w
    void h
  },
  easel(ctx, w, h) {
    rect(ctx, 3, 10, 1, h - 10, C.woodDark) // legs
    rect(ctx, 12, 10, 1, h - 10, C.woodDark)
    rect(ctx, 7, 12, 2, h - 12, C.wood)
    rect(ctx, 2, 1, 12, 13, C.paper) // canvas
    rect(ctx, 3, 2, 10, 4, '#9fd0e8') // painted sky
    rect(ctx, 3, 6, 10, 3, C.greenHi) // hills
    rect(ctx, 9, 3, 2, 2, C.goldHi) // sun
    rect(ctx, 2, 14, 12, 1, C.woodLight) // ledge
    rect(ctx, 4, 13, 3, 1, C.red) // paint tubes
    rect(ctx, 9, 13, 2, 1, C.teal)
    void w
  },
  aquarium(ctx, w, h) {
    rect(ctx, 0, 1, w, h - 1, C.metalDark)
    rect(ctx, 1, 2, w - 2, h - 4, '#2e6f8e') // water
    rect(ctx, 1, 2, w - 2, 2, '#4f9ec0')
    rect(ctx, 1, h - 4, w - 2, 2, C.creamShade) // sand
    rect(ctx, 5, 5, 3, 2, C.goldHi) // fish
    rect(ctx, 8, 5, 1, 2, C.gold)
    rect(ctx, 20, 8, 3, 2, C.redHi)
    rect(ctx, 19, 8, 1, 2, C.red)
    rect(ctx, 13, 6, 1, h - 10, C.green) // weed
    rect(ctx, 26, 4, 1, 1, C.cream) // bubbles
    rect(ctx, 25, 7, 1, 1, C.cream)
  },
  globe(ctx) {
    rect(ctx, 6, 13, 4, 2, C.woodDark) // stand
    rect(ctx, 7, 11, 2, 2, C.gold)
    rect(ctx, 3, 2, 10, 10, '#3f7bb0') // ocean
    rect(ctx, 4, 1, 8, 1, '#3f7bb0')
    rect(ctx, 4, 12, 8, 0, '#3f7bb0')
    rect(ctx, 5, 4, 3, 3, C.greenHi) // continents
    rect(ctx, 9, 6, 2, 4, C.green)
    rect(ctx, 6, 9, 2, 1, C.green)
    rect(ctx, 2, 2, 1, 10, C.gold) // meridian
  },
  typewriter(ctx) {
    rect(ctx, 1, 6, 14, 9, C.ink)
    rect(ctx, 2, 7, 12, 7, '#3b4a3f')
    rect(ctx, 3, 1, 10, 6, C.paper) // paper
    rect(ctx, 4, 3, 7, 1, C.creamShade)
    rect(ctx, 0, 6, 16, 1, C.metalHi) // carriage
    for (let x = 3; x < 13; x += 2) rect(ctx, x, 10, 1, 1, C.cream) // keys
    for (let x = 4; x < 12; x += 2) rect(ctx, x, 12, 1, 1, C.cream)
  },
  teddy_bear(ctx) {
    rect(ctx, 4, 6, 8, 8, C.woodLight) // body
    rect(ctx, 5, 1, 6, 6, C.woodLight) // head
    rect(ctx, 4, 1, 2, 2, C.wood) // ears
    rect(ctx, 10, 1, 2, 2, C.wood)
    rect(ctx, 6, 3, 1, 1, C.ink) // eyes
    rect(ctx, 9, 3, 1, 1, C.ink)
    rect(ctx, 7, 5, 2, 1, C.woodDark) // nose
    rect(ctx, 6, 8, 4, 4, C.creamShade) // tummy
    rect(ctx, 6, 6, 4, 1, C.red) // bow
  },
  toy_chest(ctx, w, h) {
    rect(ctx, 0, 2, w, h - 2, C.woodDark)
    rect(ctx, 1, 3, w - 2, h - 4, '#3f7bb0')
    rect(ctx, 1, 3, w - 2, 3, '#5b95c8') // lid
    for (let x = 3; x < w - 3; x += 7) {
      rect(ctx, x, 8, 3, 3, C.goldHi) // painted stars
    }
    rect(ctx, w / 2 - 2, 6, 4, 3, C.gold) // latch
  },
  computer(ctx, w, h) {
    rect(ctx, 0, 9, w, h - 9, C.woodMid) // desk top
    rect(ctx, 0, 9, w, 1, C.woodHi)
    rect(ctx, 6, 0, 18, 11, C.creamShade) // CRT
    rect(ctx, 8, 1, 14, 8, '#0e2a1a') // screen
    rect(ctx, 9, 2, 6, 1, '#5fd38a') // text glow
    rect(ctx, 9, 4, 9, 1, '#5fd38a')
    rect(ctx, 9, 6, 2, 1, '#9be37a') // cursor
    rect(ctx, 8, 12, 14, 3, C.cream) // keyboard
  },
  telescope(ctx, w, h) {
    rect(ctx, 4, 16, 1, h - 16, C.metalDark) // tripod
    rect(ctx, 11, 16, 1, h - 16, C.metalDark)
    rect(ctx, 7, 16, 2, h - 16, C.metalDark)
    rect(ctx, 6, 13, 4, 3, C.metal)
    rect(ctx, 3, 2, 4, 12, C.gold) // tube, angled by steps
    rect(ctx, 6, 4, 4, 8, C.gold)
    rect(ctx, 9, 6, 3, 5, C.goldHi)
    rect(ctx, 2, 1, 5, 2, C.ink) // lens
    void w
  },
  coat_rack(ctx, w, h) {
    rect(ctx, 7, 2, 2, h - 4, C.woodDark) // pole
    rect(ctx, 4, h - 3, 8, 3, C.woodDark) // base
    rect(ctx, 3, 3, 10, 1, C.wood) // hooks
    rect(ctx, 2, 4, 5, 10, C.red) // coat
    rect(ctx, 3, 4, 3, 2, C.redHi)
    rect(ctx, 9, 4, 4, 6, C.teal) // scarf
    rect(ctx, 10, 10, 2, 6, C.tealHi)
    rect(ctx, 6, 0, 4, 2, C.ink) // hat
    void w
  },
  trophy_shelf(ctx, w, h) {
    rect(ctx, 0, h - 4, w, 4, C.woodDark) // shelf
    rect(ctx, 0, h - 4, w, 1, C.woodHi)
    for (const [x, tall, colour] of [[3, 9, C.gold], [12, 11, C.goldHi], [21, 8, C.metalHi]] as const) {
      rect(ctx, x + 1, h - 4 - tall, 4, tall - 3, colour) // cup
      rect(ctx, x, h - 4 - tall, 1, 3, colour) // handles
      rect(ctx, x + 5, h - 4 - tall, 1, 3, colour)
      rect(ctx, x + 1, h - 7, 4, 3, C.woodDark) // base
    }
  },
  door(ctx, w, h) {
    rect(ctx, 0, 0, w, h, C.woodDark) // frame
    rect(ctx, 2, 1, w - 4, h - 1, C.wood)
    rect(ctx, 3, 2, w / 2 - 4, h - 4, C.woodMid)
    rect(ctx, w / 2 + 1, 2, w / 2 - 4, h - 4, C.woodMid)
    rect(ctx, w - 7, h / 2, 2, 2, C.gold) // knob
    rect(ctx, w - 7, h / 2, 1, 1, C.goldHi)
    rect(ctx, w - 6, h / 2 + 3, 1, 2, C.ink) // keyhole
  },
}

export function furnitureKey(kind: RoomObjectData['kind']): string {
  return `art-${kind}`
}

// ---------------------------------------------------------------------------------------
// Player: 4 directions x 2 frames, 10x14 art px each, laid out in one strip.
// ---------------------------------------------------------------------------------------

export const PLAYER_KEY = 'art-player'
export const PLAYER_FRAME_W = 10
export const PLAYER_FRAME_H = 14
export const PLAYER_DIRECTIONS = ['down', 'up', 'left', 'right'] as const
export type PlayerDirection = (typeof PLAYER_DIRECTIONS)[number]

function drawPlayerFrame(ctx: Ctx, ox: number, dir: PlayerDirection, step: number): void {
  const p = (x: number, y: number, w: number, h: number, c: string) => rect(ctx, ox + x, y, w, h, c)
  // Legs alternate on the step frame.
  const legL = step ? 1 : 0
  const legR = step ? 0 : 1
  p(2, 12 - legL, 2, 2 + legL, C.pants)
  p(6, 12 - legR, 2, 2 + legR, C.pants)
  p(2, 13, 2, 1, C.shoe)
  p(6, 13, 2, 1, C.shoe)
  // Body.
  p(1, 7, 8, 6, C.shirt)
  p(1, 7, 8, 1, C.shirtHi)
  // Arms swing opposite the legs.
  p(0, 8 + (step ? 1 : 0), 1, 3, C.skin)
  p(9, 8 + (step ? 0 : 1), 1, 3, C.skin)
  // Head.
  p(2, 1, 6, 6, C.skin)
  p(1, 0, 8, 2, C.hair)
  if (dir === 'up') {
    p(1, 0, 8, 6, C.hair)
  } else if (dir === 'down') {
    p(1, 2, 1, 2, C.hair)
    p(8, 2, 1, 2, C.hair)
    p(3, 4, 1, 1, C.ink)
    p(6, 4, 1, 1, C.ink)
  } else {
    const back = dir === 'left' ? 6 : 1
    p(back, 0, 3, 5, C.hair)
    p(dir === 'left' ? 3 : 6, 4, 1, 1, C.ink)
  }
}

// ---------------------------------------------------------------------------------------
// Decor: non-interactive dressing that makes the room feel lived in
// ---------------------------------------------------------------------------------------

export const WINDOW_KEY = 'art-window'
export const FAIRY_LIGHT_KEY = 'art-fairy-light'
export const POSTER_KEYS = {
  music: 'art-poster-music',
  sport: 'art-poster-sport',
  night: 'art-poster-stars',
  art: 'art-poster-art',
} as const
export const SCONCE_KEY = 'art-sconce'
export const COBWEB_KEY = 'art-cobweb'
export const CLUTTER_KEYS = ['art-socks', 'art-books', 'art-paperball', 'art-mug', 'art-slippers', 'art-clothes'] as const

function drawWindow(ctx: Ctx): void {
  rect(ctx, 1, 1, 14, 13, C.woodDark) // frame
  rect(ctx, 2, 2, 12, 11, '#1b2a4a') // night sky
  rect(ctx, 2, 2, 12, 3, '#22365c')
  rect(ctx, 10, 3, 2, 2, '#e8ecff') // moon
  rect(ctx, 4, 6, 1, 1, '#c9d4ff') // stars
  rect(ctx, 7, 4, 1, 1, '#c9d4ff')
  rect(ctx, 7, 2, 1, 11, C.woodDark) // mullions
  rect(ctx, 2, 7, 12, 1, C.woodDark)
  rect(ctx, 0, 13, 16, 2, C.woodLight) // sill
  rect(ctx, 0, 13, 16, 1, C.woodHi)
}

function drawSconce(ctx: Ctx): void {
  rect(ctx, 6, 9, 4, 3, C.gold) // bracket
  rect(ctx, 7, 12, 2, 2, C.gold)
  rect(ctx, 7, 5, 2, 4, C.cream) // candle
  rect(ctx, 7, 3, 2, 2, '#ffb347') // flame
  rect(ctx, 7, 2, 1, 1, '#fff1b0')
}

function drawCobweb(ctx: Ctx): void {
  const web = 'rgba(220,220,235,0.45)'
  for (let i = 0; i < 12; i++) rect(ctx, i, 0, 1, 12 - i, i % 3 === 0 ? web : 'rgba(0,0,0,0)')
  for (let i = 0; i < 12; i++) rect(ctx, 0, i, 12 - i, 1, i % 3 === 0 ? web : 'rgba(0,0,0,0)')
  for (let i = 0; i < 9; i++) rect(ctx, i, i, 1, 1, web)
}

function drawPoster(ctx: Ctx, theme: keyof typeof POSTER_KEYS): void {
  rect(ctx, 2, 1, 12, 13, C.ink)
  if (theme === 'music') {
    rect(ctx, 3, 2, 10, 11, C.redDark) // gig poster
    rect(ctx, 4, 3, 8, 1, C.goldHi)
    rect(ctx, 7, 5, 2, 6, C.cream) // guitar silhouette
    rect(ctx, 6, 9, 4, 3, C.cream)
    rect(ctx, 4, 12, 8, 1, C.goldHi)
  } else if (theme === 'sport') {
    rect(ctx, 3, 2, 10, 6, C.teal) // pennant
    rect(ctx, 3, 8, 7, 2, C.teal)
    rect(ctx, 3, 10, 4, 2, C.teal)
    rect(ctx, 5, 4, 6, 2, C.cream)
  } else if (theme === 'night') {
    rect(ctx, 3, 2, 10, 11, '#101a33') // star chart
    for (const [x, y] of [[5, 4], [9, 3], [11, 7], [6, 9], [8, 11], [4, 7]] as const) rect(ctx, x, y, 1, 1, C.cream)
    rect(ctx, 5, 4, 4, 1, '#3f5a8a')
  } else {
    rect(ctx, 3, 2, 10, 11, C.paper) // art print
    rect(ctx, 4, 4, 4, 4, C.red)
    rect(ctx, 8, 6, 4, 5, '#3f7bb0')
    rect(ctx, 5, 9, 3, 3, C.goldHi)
  }
}

const CLUTTER: Record<(typeof CLUTTER_KEYS)[number], (ctx: Ctx) => void> = {
  'art-socks'(ctx) {
    rect(ctx, 3, 7, 4, 2, C.redHi)
    rect(ctx, 6, 7, 2, 4, C.redHi)
    rect(ctx, 9, 5, 2, 4, C.cream)
    rect(ctx, 9, 8, 4, 2, C.cream)
  },
  'art-books'(ctx) {
    rect(ctx, 3, 9, 10, 3, C.teal)
    rect(ctx, 4, 6, 9, 3, C.red)
    rect(ctx, 3, 4, 8, 2, C.gold)
    rect(ctx, 3, 9, 10, 1, C.tealHi)
  },
  'art-paperball'(ctx) {
    rect(ctx, 6, 7, 4, 3, C.paper)
    rect(ctx, 7, 6, 2, 1, C.paper)
    rect(ctx, 7, 8, 2, 1, C.creamShade)
    rect(ctx, 11, 10, 2, 2, C.creamShade)
  },
  'art-mug'(ctx) {
    rect(ctx, 6, 6, 4, 5, C.cream)
    rect(ctx, 10, 7, 1, 2, C.cream)
    rect(ctx, 6, 6, 4, 1, C.woodDark)
  },
  'art-slippers'(ctx) {
    rect(ctx, 4, 5, 3, 6, C.shirt)
    rect(ctx, 9, 6, 3, 6, C.shirt)
    rect(ctx, 4, 5, 3, 2, C.cream)
    rect(ctx, 9, 6, 3, 2, C.cream)
  },
  'art-clothes'(ctx) {
    rect(ctx, 2, 7, 12, 5, C.pants)
    rect(ctx, 4, 5, 8, 3, C.shirtHi)
    rect(ctx, 3, 9, 3, 3, C.greenDark)
    rect(ctx, 9, 10, 4, 2, C.red)
  },
}

// ---------------------------------------------------------------------------------------
// Small effects textures
// ---------------------------------------------------------------------------------------

export const KEYCAP_KEY = 'art-keycap'
export const DUST_KEY = 'art-dust'
export const GLOW_KEY = 'art-glow'
export const SPARK_KEY = 'art-spark'

function drawKeycap(ctx: Ctx): void {
  rect(ctx, 1, 0, 9, 11, C.ink)
  rect(ctx, 0, 1, 11, 9, C.ink)
  rect(ctx, 1, 1, 9, 8, C.cream)
  rect(ctx, 1, 9, 9, 1, C.creamShade)
  // Letter E.
  rect(ctx, 3, 2, 1, 6, C.ink)
  rect(ctx, 3, 2, 5, 1, C.ink)
  rect(ctx, 3, 4, 4, 1, C.ink)
  rect(ctx, 3, 7, 5, 1, C.ink)
}

function drawGlow(ctx: Ctx, size: number): void {
  const r = size / 2
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
}

/** Creates every texture the room needs. Safe to call repeatedly. */
export function createRoomArt(scene: Phaser.Scene, cols: number, rows: number, kinds: Iterable<RoomObjectData>, mood = 'violet'): void {
  makeTexture(scene, FLOOR_KEY, cols * T, rows * T, (ctx) => drawFloor(ctx, cols, rows))
  makeTexture(scene, wallFaceKey(mood), cols * T, T, (ctx) => drawWallFace(ctx, cols, mood))
  makeTexture(scene, WALL_TOP_KEY, T, T, drawWallTop)

  for (const object of kinds) {
    const w = object.width / ART_SCALE
    const h = object.height / ART_SCALE
    makeTexture(scene, furnitureKey(object.kind), w, h, (ctx) => FURNITURE[object.kind](ctx, w, h))
  }

  makeTexture(scene, PLAYER_KEY, PLAYER_FRAME_W * 8, PLAYER_FRAME_H, (ctx) => {
    PLAYER_DIRECTIONS.forEach((dir, d) => {
      drawPlayerFrame(ctx, (d * 2) * PLAYER_FRAME_W, dir, 0)
      drawPlayerFrame(ctx, (d * 2 + 1) * PLAYER_FRAME_W, dir, 1)
    })
  })
  const player = scene.textures.get(PLAYER_KEY)
  if (player.frameTotal <= 1) {
    for (let i = 0; i < 8; i++) player.add(i, 0, i * PLAYER_FRAME_W, 0, PLAYER_FRAME_W, PLAYER_FRAME_H)
  }

  makeTexture(scene, WINDOW_KEY, T, T, drawWindow)
  makeTexture(scene, SCONCE_KEY, T, T, drawSconce)
  makeTexture(scene, COBWEB_KEY, 12, 12, drawCobweb)
  for (const key of CLUTTER_KEYS) makeTexture(scene, key, T, T, CLUTTER[key])

  for (const theme of Object.keys(POSTER_KEYS) as (keyof typeof POSTER_KEYS)[]) {
    makeTexture(scene, POSTER_KEYS[theme], T, T, (ctx) => drawPoster(ctx, theme))
  }
  makeTexture(scene, FAIRY_LIGHT_KEY, 2, 2, (ctx) => rect(ctx, 0, 0, 2, 2, '#ffffff'))

  makeTexture(scene, KEYCAP_KEY, 11, 11, drawKeycap)
  makeTexture(scene, DUST_KEY, 1, 1, (ctx) => rect(ctx, 0, 0, 1, 1, '#ffe9b8'))
  makeTexture(scene, SPARK_KEY, 2, 2, (ctx) => rect(ctx, 0, 0, 2, 2, C.goldHi))
  makeTexture(scene, GLOW_KEY, 128, 128, (ctx) => drawGlow(ctx, 128))
}

/** Frame index in the player strip for a direction and step. */
export function playerFrame(dir: PlayerDirection, step: number): number {
  return PLAYER_DIRECTIONS.indexOf(dir) * 2 + step
}
