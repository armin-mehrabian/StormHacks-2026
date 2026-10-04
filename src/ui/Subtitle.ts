// Temporary subtitle overlay for the integration slice; the design pass replaces its look.
// A DOM overlay so text stays crisp at any canvas scale and works with audio muted.

import type { NarratorEmotion } from '../shared/contract.ts'

const MIN_VISIBLE_MS = 3000
const MAX_VISIBLE_MS = 8000
const MS_PER_CHARACTER = 60

export class Subtitle {
  private readonly element: HTMLDivElement
  private hideTimer: ReturnType<typeof setTimeout> | undefined

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div')
    this.element.setAttribute('role', 'status')
    this.element.setAttribute('aria-live', 'polite')
    Object.assign(this.element.style, {
      position: 'fixed',
      left: '50%',
      bottom: '12%',
      transform: 'translateX(-50%)',
      maxWidth: 'min(90vw, 720px)',
      padding: '8px 14px',
      font: '16px/1.4 monospace',
      color: '#ffffff',
      background: 'rgba(0, 0, 0, 0.75)',
      borderRadius: '4px',
      textAlign: 'center',
      pointerEvents: 'none',
      visibility: 'hidden',
    })
    parent.appendChild(this.element)
  }

  /** Shows a line, replacing any current one, for a time based on its length. */
  show(line: string, emotion: NarratorEmotion): void {
    this.element.textContent = line
    this.element.dataset.emotion = emotion
    this.element.style.visibility = 'visible'
    clearTimeout(this.hideTimer)
    const visibleMs = Math.min(MAX_VISIBLE_MS, Math.max(MIN_VISIBLE_MS, line.length * MS_PER_CHARACTER))
    this.hideTimer = setTimeout(() => this.hide(), visibleMs)
  }

  hide(): void {
    clearTimeout(this.hideTimer)
    this.element.style.visibility = 'hidden'
  }

  destroy(): void {
    clearTimeout(this.hideTimer)
    this.element.remove()
  }
}
