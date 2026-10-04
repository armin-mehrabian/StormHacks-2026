// Shared frame for story-puzzle screens (choice, identity board, piano): a modal card with
// a heading, a body the puzzle fills in, a status line, and a shake on wrong answers.
// Esc closes. The game pauses while one is open (see modal.ts).

import { modalClosed, modalOpened } from './modal.ts'

export class PuzzleOverlay {
  protected readonly root: HTMLDivElement
  protected readonly card: HTMLDivElement
  protected readonly heading: HTMLHeadingElement
  protected readonly body: HTMLDivElement
  protected readonly status: HTMLParagraphElement
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.close()
    }
  }

  constructor(cardClass: string, parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.className = 'overlay'
    this.root.hidden = true
    this.card = document.createElement('div')
    this.card.className = `puzzle-card ${cardClass}`
    this.heading = document.createElement('h2')
    this.heading.className = 'puzzle-heading'
    this.body = document.createElement('div')
    this.body.className = 'puzzle-body'
    this.status = document.createElement('p')
    this.status.className = 'lock-status'
    const hint = document.createElement('p')
    hint.className = 'overlay-hint'
    hint.textContent = 'Esc to step away'
    this.card.append(this.heading, this.body, this.status, hint)
    this.root.append(this.card)
    parent.appendChild(this.root)
    this.card.addEventListener('animationend', () => this.card.classList.remove('shake'))
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  close(): void {
    if (!this.isOpen) return
    this.root.hidden = true
    window.removeEventListener('keydown', this.onKeyDown)
    modalClosed()
  }

  destroy(): void {
    this.close()
    this.root.remove()
  }

  protected open(heading: string): void {
    if (this.isOpen) this.close()
    this.heading.textContent = heading
    this.status.textContent = ''
    this.root.hidden = false
    modalOpened()
    window.addEventListener('keydown', this.onKeyDown)
  }

  /** Shakes the card and shows why. */
  protected rejected(message: string): void {
    this.status.textContent = message
    this.card.classList.remove('shake')
    void this.card.offsetWidth
    this.card.classList.add('shake')
  }
}

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = label
  element.addEventListener('click', onClick)
  return element
}

/** Returns a shuffled copy (Fisher-Yates). */
export function shuffled<T>(list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}
