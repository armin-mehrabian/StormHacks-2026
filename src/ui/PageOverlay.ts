// Shows a found page as a sheet of paper. Cipher pages show their encrypted text.

import { pageDisplayText } from '../shared/blueprint.ts'
import type { BlueprintItem } from '../shared/blueprint.ts'
import { modalClosed, modalOpened } from './modal.ts'

export class PageOverlay {
  private readonly root: HTMLDivElement
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
    if (this.isOpen) this.close()
    this.title.textContent = item.name
    this.text.textContent = pageDisplayText(item)
    this.text.classList.toggle('cipher', Boolean(item.cipherShift))
    this.onClose = onClose
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
