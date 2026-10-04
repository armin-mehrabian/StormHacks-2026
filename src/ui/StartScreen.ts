// Title screen. The click or key press that starts the game also satisfies the browser's
// autoplay rule, so the narrator can speak its intro immediately.

import { modalClosed, modalOpened } from './modal.ts'

const CONTROLS: [string, string][] = [
  ['WASD', 'move'],
  ['E', 'inspect'],
  ['M', 'mute'],
]

export function showStartScreen(parent: HTMLElement = document.body): Promise<void> {
  const root = document.createElement('div')
  root.className = 'screen'

  const title = document.createElement('h1')
  title.className = 'screen-title'
  title.textContent = 'Escape Room A'
  const tagline = document.createElement('small')
  tagline.textContent = 'a room that talks back'
  title.append(tagline)

  const text = document.createElement('p')
  text.className = 'screen-text'
  text.textContent = 'You wake up in a locked bedroom. Five minutes on the clock. Someone is watching, and they have opinions.'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ui-button'
  button.textContent = 'Wake up'

  const controls = document.createElement('div')
  controls.className = 'screen-controls'
  for (const [key, action] of CONTROLS) {
    const item = document.createElement('span')
    const kbd = document.createElement('kbd')
    kbd.textContent = key
    item.append(kbd, action)
    controls.append(item)
  }

  root.append(title, text, button, controls)
  parent.appendChild(root)
  modalOpened()
  button.focus()

  return new Promise((resolve) => {
    const start = () => {
      window.removeEventListener('keydown', onKey)
      root.remove()
      modalClosed()
      resolve()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        start()
      }
    }
    button.addEventListener('click', start, { once: true })
    window.addEventListener('keydown', onKey)
  })
}
