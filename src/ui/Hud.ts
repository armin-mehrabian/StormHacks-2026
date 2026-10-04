// Timer and inventory bar. Display only: the game state owns both values.

import type { BlueprintItem } from '../shared/blueprint.ts'

const LOW_TIME_MS = 60_000

export class Hud {
  private readonly root: HTMLDivElement
  private readonly timer: HTMLDivElement
  private readonly inventory: HTMLDivElement
  private readonly onPageClick: (item: BlueprintItem) => void
  private shownSeconds = -1

  constructor(onPageClick: (item: BlueprintItem) => void, parent: HTMLElement = document.body) {
    this.onPageClick = onPageClick
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.timer = document.createElement('div')
    this.timer.className = 'hud-timer'
    this.inventory = document.createElement('div')
    this.inventory.className = 'hud-inventory'
    this.root.append(this.timer, this.inventory)
    parent.appendChild(this.root)
  }

  setTime(remainingMs: number): void {
    const seconds = Math.ceil(remainingMs / 1000)
    if (seconds === this.shownSeconds) return
    this.shownSeconds = seconds
    const minutes = Math.floor(seconds / 60)
    this.timer.textContent = `${minutes}:${String(seconds % 60).padStart(2, '0')}`
    this.timer.classList.toggle('low', remainingMs <= LOW_TIME_MS)
  }

  /** Appends newly collected items only, so existing slots don't replay their pop-in. */
  setInventory(items: readonly BlueprintItem[]): void {
    for (const item of items.slice(this.inventory.childElementCount)) {
      this.inventory.append(this.slot(item))
    }
  }

  private slot(item: BlueprintItem): HTMLElement {
    if (item.kind !== 'page') {
      const chip = document.createElement('div')
      chip.className = 'hud-item'
      chip.append(icon('🗝️'), item.name)
      return chip
    }
    // Pages can be reread by clicking.
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'hud-item'
    button.title = 'Click to reread'
    button.append(icon('📜'), item.name)
    button.addEventListener('click', () => this.onPageClick(item))
    return button
  }

  destroy(): void {
    this.root.remove()
  }
}

function icon(glyph: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'icon'
  span.textContent = glyph
  return span
}
