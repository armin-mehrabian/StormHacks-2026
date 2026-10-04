// The narrator's dialogue box: a name tag plus typewriter text. Shown for every spoken
// line (in sync with the voice) and on its own when audio is muted or unavailable.

import type { NarratorEmotion } from '../shared/contract.ts'

const CHARS_PER_SECOND = 40
const MIN_HOLD_MS = 2500
const HOLD_MS_PER_CHARACTER = 45

export class Subtitle {
  private readonly element: HTMLDivElement
  private readonly text: HTMLParagraphElement
  private hideTimer: ReturnType<typeof setTimeout> | undefined
  private typeTimer: ReturnType<typeof setInterval> | undefined

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div')
    this.element.className = 'narrator'
    this.element.setAttribute('role', 'status')
    this.element.setAttribute('aria-live', 'polite')
    this.element.hidden = true
    const name = document.createElement('div')
    name.className = 'narrator-name'
    name.textContent = 'Narrator'
    this.text = document.createElement('p')
    this.text.className = 'narrator-text'
    this.element.append(name, this.text)
    parent.appendChild(this.element)
  }

  /** Shows a line, replacing any current one, typed out then held based on its length. */
  show(line: string, emotion: NarratorEmotion): void {
    this.stopTimers()
    this.element.dataset.emotion = emotion
    this.element.hidden = false
    this.element.setAttribute('aria-label', line)

    let shown = 0
    this.text.textContent = ''
    this.typeTimer = setInterval(() => {
      shown = Math.min(line.length, shown + 1)
      this.text.textContent = line.slice(0, shown)
      if (shown >= line.length) clearInterval(this.typeTimer)
    }, 1000 / CHARS_PER_SECOND)

    const typingMs = (line.length / CHARS_PER_SECOND) * 1000
    const holdMs = Math.max(MIN_HOLD_MS, line.length * HOLD_MS_PER_CHARACTER)
    this.hideTimer = setTimeout(() => this.hide(), typingMs + holdMs)
  }

  hide(): void {
    this.stopTimers()
    this.element.hidden = true
  }

  destroy(): void {
    this.stopTimers()
    this.element.remove()
  }

  private stopTimers(): void {
    clearTimeout(this.hideTimer)
    clearInterval(this.typeTimer)
  }
}
