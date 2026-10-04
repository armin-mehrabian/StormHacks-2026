// Darkness with light holes. A world-sized canvas is filled with near-black every frame,
// then each light erases a soft circle from it; additive glow sprites add warm colour.

import Phaser from 'phaser'
import { GLOW_KEY } from './art.ts'

const DARKNESS_KEY = 'lighting-darkness'
/** Initial implementation choice for the mood: how dark the unlit room is (0-1). */
const DEFAULT_DARKNESS = 0.9
const GLOW_SIZE = 128

export interface LightSource {
  x: number
  y: number
  radius: number
  /** Warm glow colour; omit for an unlit hole only. */
  tint?: number
  glowAlpha?: number
  /** 0 = steady; higher values flicker more. */
  flicker?: number
}

interface Light extends LightSource {
  glow?: Phaser.GameObjects.Image
  seed: number
}

export class Lighting {
  private readonly scene: Phaser.Scene
  private readonly texture: Phaser.Textures.CanvasTexture
  private readonly width: number
  private readonly height: number
  private readonly lights: Light[] = []
  private readonly depth: number
  /** 0..1 extra darkness, e.g. when time is running out. */
  private dread = 0
  private darkness = DEFAULT_DARKNESS
  private targetDarkness = DEFAULT_DARKNESS

  constructor(scene: Phaser.Scene, width: number, height: number, depth: number) {
    this.scene = scene
    this.width = width
    this.height = height
    this.depth = depth
    if (scene.textures.exists(DARKNESS_KEY)) scene.textures.remove(DARKNESS_KEY)
    const texture = scene.textures.createCanvas(DARKNESS_KEY, width, height)
    if (!texture) throw new Error('Could not create the lighting canvas')
    this.texture = texture
    scene.add.image(0, 0, DARKNESS_KEY).setOrigin(0).setDepth(depth)
  }

  /** Adds a light. Returns it so callers can move it (e.g. the player's light). */
  add(source: LightSource): LightSource {
    const light: Light = { ...source, seed: Math.random() * 1000 }
    if (source.tint !== undefined) {
      light.glow = this.scene.add
        .image(source.x, source.y, GLOW_KEY)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(source.tint)
        .setAlpha(source.glowAlpha ?? 0.25)
        .setDepth(this.depth + 1)
    }
    this.lights.push(light)
    return light
  }

  /** Eases the unlit room toward a new darkness (0 = fully lit, 1 = black), e.g. per act. */
  setDarkness(value: number): void {
    this.targetDarkness = Phaser.Math.Clamp(value, 0, 1)
  }

  setDread(value: number): void {
    this.dread = Phaser.Math.Clamp(value, 0, 1)
  }

  update(time: number): void {
    const ctx = this.texture.context
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.width, this.height)
    this.darkness += (this.targetDarkness - this.darkness) * 0.02
    ctx.fillStyle = `rgba(6, 4, 14, ${this.darkness.toFixed(3)})`
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.globalCompositeOperation = 'destination-out'
    for (const light of this.lights) {
      const flicker = light.flicker
        ? 1 - light.flicker * (0.5 + 0.5 * Math.sin(time / 90 + light.seed)) * (0.6 + 0.4 * Math.sin(time / 37 + light.seed * 2))
        : 1
      const radius = light.radius * flicker * (1 - this.dread * 0.35)
      const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius)
      gradient.addColorStop(0, 'rgba(0,0,0,1)')
      gradient.addColorStop(0.55, 'rgba(0,0,0,0.75)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2)

      if (light.glow) {
        light.glow.setPosition(light.x, light.y)
        light.glow.setScale((radius * 2) / GLOW_SIZE)
        light.glow.setAlpha((light.glowAlpha ?? 0.25) * flicker)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    this.texture.refresh()
  }
}
