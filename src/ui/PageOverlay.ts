// Shows a found page as a sheet of paper (cipher pages show their encrypted text), or the
// transcript of a memory being played.

import { pageDisplayText } from '../shared/blueprint.ts'
import type { BlueprintItem } from '../shared/blueprint.ts'
import { modalClosed, modalOpened } from './modal.ts'

export class PageOverlay {
  private readonly root: HTMLDivElement
  private readonly card: HTMLDivElement
  private readonly title: HTMLHeadingElement
  private readonly text: HTMLParagraphElement
  private onClose: (() => void) | undefined
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (['Escape', 'Enter', 'e', 'E', ' '].includes(event.key)) {
      event.preventDefault()
      this.close()
    }
  }

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.className = 'overlay'
    this.root.hidden = true
    const card = document.createElement('div')
    this.card = card
    card.className = 'page-card'
    this.title = document.createElement('h2')
    this.title.className = 'page-title'
    this.text = document.createElement('p')
    this.text.className = 'page-text'
    const hint = document.createElement('p')
    hint.className = 'overlay-hint'
    hint.textContent = 'Press E to put it away'
    card.append(this.title, this.text, hint)
    this.root.append(card)
    this.root.addEventListener('click', () => this.close())
    parent.appendChild(this.root)
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  show(item: BlueprintItem, onClose?: () => void): void {
    this.open(item.name, pageDisplayText(item), { cipher: Boolean(item.cipherShift), onClose })
  }

  /** A memory's words, e.g. "Voicemail · Mom", while its voice plays. */
  showTranscript(title: string, text: string): void {
    this.open(title, `"${text}"`, { transcript: true })
  }

  private open(title: string, text: string, options: { cipher?: boolean; transcript?: boolean; onClose?: () => void }): void {
    if (this.isOpen) this.close()
    this.title.textContent = title
    this.text.textContent = text
    this.text.classList.toggle('cipher', Boolean(options.cipher))
    this.card.classList.toggle('transcript', Boolean(options.transcript))
    this.onClose = options.onClose
    this.root.hidden = false
    modalOpened()
    window.addEventListener('keydown', this.onKeyDown)
  }

  close(): void {
    if (!this.isOpen) return
    this.root.hidden = true
    window.removeEventListener('keydown', this.onKeyDown)
    modalClosed()
    const onClose = this.onClose
    this.onClose = undefined
    onClose?.()
  }

  destroy(): void {
    this.close()
    this.root.remove()
  }
}
