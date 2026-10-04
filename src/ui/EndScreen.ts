// Win/lose screen. Play again reloads, which fetches a fresh room.

import { modalOpened } from './modal.ts'

/** Lets the narrator's final line be heard before the screen covers the room. */
const REVEAL_DELAY_MS = 1800

export class EndScreen {
  private readonly root: HTMLDivElement

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.hidden = true
    parent.appendChild(this.root)
  }

  show(escaped: boolean, timeRemainingMs: number): void {
    // Stays open for good: the run is over.
    modalOpened()
    const seconds = Math.ceil(timeRemainingMs / 1000)
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

    const title = document.createElement('h1')
    title.className = 'screen-title'
    title.textContent = escaped ? 'You escaped' : "Time's up"
    const text = document.createElement('p')
    text.className = 'screen-text'
    text.textContent = escaped ? `With ${clock} left on the clock. The narrator is grudgingly impressed.` : 'The room wins this time. It usually does.'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ui-button'
    button.textContent = 'Play again'
    button.addEventListener('click', () => window.location.reload())

    setTimeout(() => {
      this.root.className = `screen ${escaped ? 'win' : 'lose'}`
      this.root.replaceChildren(title, text, button)
      this.root.hidden = false
      button.focus()
    }, REVEAL_DELAY_MS)
  }

  destroy(): void {
    this.root.remove()
  }
}
