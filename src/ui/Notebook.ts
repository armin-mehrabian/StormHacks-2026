// The dream notebook: every clue found is written down automatically (descriptions that
// matter, pages, what people said in memories). N opens it. Numbers are highlighted.

import { modalClosed, modalOpened } from './modal.ts'

interface Entry {
  key: string
  title: string
  text: string
}

export class Notebook {
  private readonly root: HTMLDivElement
  private readonly list: HTMLDivElement
  private readonly entries: Entry[] = []
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (['Escape', 'n', 'N', 'e', 'E'].includes(event.key)) {
      event.preventDefault()
      this.close()
    }
  }

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.className = 'overlay'
    this.root.hidden = true
    const card = document.createElement('div')
    card.className = 'page-card notebook-card'
    const title = document.createElement('h2')
    title.className = 'page-title'
    title.textContent = 'Dream notebook'
    this.list = document.createElement('div')
    this.list.className = 'notebook-list'
    const hint = document.createElement('p')
    hint.className = 'overlay-hint'
    hint.textContent = 'N to close'
    card.append(title, this.list, hint)
    this.root.append(card)
    this.root.addEventListener('click', () => this.close())
    parent.appendChild(this.root)
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  get count(): number {
    return this.entries.length
  }

  /** Adds an entry once per key (re-adding the same key does nothing). */
  add(key: string, title: string, text: string): boolean {
    if (this.entries.some((entry) => entry.key === key)) return false
    this.entries.push({ key, title, text })
    return true
  }

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  open(): void {
    if (this.isOpen) return
    this.list.replaceChildren(
      ...(this.entries.length
        ? this.entries.map((entry) => {
            const item = document.createElement('div')
            item.className = 'notebook-entry'
            const title = document.createElement('div')
            title.className = 'notebook-entry-title'
            title.textContent = entry.title
            const text = document.createElement('p')
            text.className = 'notebook-entry-text'
            // Highlight numbers: they are usually what matters.
            for (const part of entry.text.split(/(\d+)/)) {
              if (/^\d+$/.test(part)) {
                const mark = document.createElement('mark')
                mark.textContent = part
                text.append(mark)
              } else {
                text.append(part)
              }
            }
            item.append(title, text)
            return item
          })
        : [Object.assign(document.createElement('p'), { className: 'notebook-empty', textContent: 'Nothing yet. Look around.' })]),
    )
    this.root.hidden = false
    modalOpened()
    window.addEventListener('keydown', this.onKeyDown)
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
}
