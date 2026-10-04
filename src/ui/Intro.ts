// The opening: black screen, a heartbeat, a few typed lines, then the dream fades in.
// Enter, Space, or a click skips it.

import { modalClosed, modalOpened } from './modal.ts'

const CHARS_PER_SECOND = 32
const PAUSE_AFTER_LINE_MS = 900

export function playIntro(lines: string[], onStart: () => void = () => {}, parent: HTMLElement = document.body): Promise<void> {
  const root = document.createElement('div')
  root.className = 'intro'
  const list = document.createElement('div')
  list.className = 'intro-lines'
  const skip = document.createElement('p')
  skip.className = 'intro-skip'
  skip.textContent = 'Press Enter to skip'
  root.append(list, skip)
  parent.appendChild(root)
  modalOpened()
  onStart()

  return new Promise((resolve) => {
    let finished = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const finish = () => {
      if (finished) return
      finished = true
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', onKey)
      root.classList.add('leaving')
      setTimeout(() => {
        root.remove()
        modalClosed()
        resolve()
      }, 700)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey)
    root.addEventListener('click', finish)

    // Type each line in turn.
    let at = 600
    lines.forEach((line, index) => {
      const p = document.createElement('p')
      p.className = index === 0 ? 'intro-line intro-time' : 'intro-line'
      timers.push(
        setTimeout(() => {
          list.append(p)
          for (let i = 1; i <= line.length; i++) {
            timers.push(setTimeout(() => (p.textContent = line.slice(0, i)), (i * 1000) / CHARS_PER_SECOND))
          }
        }, at),
      )
      at += (line.length * 1000) / CHARS_PER_SECOND + PAUSE_AFTER_LINE_MS
    })
    timers.push(setTimeout(finish, at + 600))
  })
}
