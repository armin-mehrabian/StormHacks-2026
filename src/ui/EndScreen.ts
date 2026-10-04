// Win/lose screen with the reveal (whose dream it was) and the dream journal: a diary entry
// the dreamer writes the morning after, which can be saved as a shareable image card.
// Play again reloads, which dreams up a fresh room.

import type { Dreamer } from '../shared/blueprint.ts'
import { stripAudioTags } from '../shared/contract.ts'
import type { RunStats } from '../shared/contract.ts'
import { modalOpened } from './modal.ts'

/** Lets the dreamer's final line be heard before the screen covers the room. */
const REVEAL_DELAY_MS = 1800
const CARD_WIDTH = 1200
const CARD_HEIGHT = 675

export class EndScreen {
  private readonly root: HTMLDivElement
  private readonly journal: HTMLDivElement
  private readonly journalText: HTMLParagraphElement
  private readonly saveButton: HTMLButtonElement
  private card: { dreamer: Dreamer; title: string; entry: string; stats: RunStats } | undefined

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.hidden = true
    parent.appendChild(this.root)

    this.journal = document.createElement('div')
    this.journal.className = 'journal'
    const heading = document.createElement('div')
    heading.className = 'journal-heading'
    heading.textContent = 'Dream journal'
    this.journalText = document.createElement('p')
    this.journalText.className = 'journal-text'
    this.journalText.textContent = 'Writing it down before it fades...'
    this.journal.append(heading, this.journalText)

    this.saveButton = document.createElement('button')
    this.saveButton.type = 'button'
    this.saveButton.className = 'ui-button secondary'
    this.saveButton.textContent = 'Save dream card'
    this.saveButton.hidden = true
    this.saveButton.addEventListener('click', () => this.saveCard())
  }

  show(escaped: boolean, timeRemainingMs: number, dreamer: Dreamer): void {
    // Stays open for good: the run is over.
    modalOpened()
    const clock = formatClock(Math.ceil(timeRemainingMs / 1000))

    const title = document.createElement('h1')
    title.className = 'screen-title'
    title.textContent = escaped ? 'You woke up' : 'Sinking deeper'
    const text = document.createElement('p')
    text.className = 'screen-text'
    text.textContent = escaped
      ? `You were ${dreamer.name}, ${dreamer.age}. ${dreamer.situation} You woke them with ${clock} to spare.`
      : `You never found out whose dream it was. (It was ${dreamer.name}'s.)`
    const again = document.createElement('button')
    again.type = 'button'
    again.className = 'ui-button'
    again.textContent = 'Dream again'
    again.addEventListener('click', () => window.location.reload())
    const buttons = document.createElement('div')
    buttons.className = 'screen-buttons'
    buttons.append(this.saveButton, again)

    setTimeout(() => {
      this.root.className = `screen ${escaped ? 'win' : 'lose'}`
      this.root.replaceChildren(title, text, this.journal, buttons)
      this.root.hidden = false
      again.focus()
    }, REVEAL_DELAY_MS)
  }

  /** Fills in the journal once Gemini has written it. */
  setJournal(entry: string, dreamer: Dreamer, title: string, stats: RunStats): void {
    const clean = stripAudioTags(entry)
    this.journalText.textContent = clean
    this.card = { dreamer, title, entry: clean, stats }
    this.saveButton.hidden = false
  }

  destroy(): void {
    this.root.remove()
  }

  /** Draws the journal as a 1200x675 image and downloads it. */
  private saveCard(): void {
    if (!this.card) return
    const { dreamer, title, entry, stats } = this.card
    const canvas = document.createElement('canvas')
    canvas.width = CARD_WIDTH
    canvas.height = CARD_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const background = ctx.createRadialGradient(600, 300, 50, 600, 340, 760)
    background.addColorStop(0, '#2a1d45')
    background.addColorStop(1, '#07040d')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
    ctx.strokeStyle = '#8a5a34'
    ctx.lineWidth = 8
    ctx.strokeRect(24, 24, CARD_WIDTH - 48, CARD_HEIGHT - 48)

    ctx.fillStyle = '#efd065'
    ctx.font = '22px "Press Start 2P", monospace'
    ctx.fillText('DREAM JOURNAL', 72, 104)
    ctx.fillStyle = '#b9ab90'
    ctx.font = '34px VT323, monospace'
    ctx.fillText(`${dreamer.name}, ${dreamer.age}  ·  "${title}"`, 72, 156)

    // Paper with the entry.
    ctx.fillStyle = '#efe4c8'
    ctx.fillRect(72, 190, CARD_WIDTH - 144, 360)
    ctx.fillStyle = '#2b2118'
    ctx.font = '34px "Special Elite", "Courier New", monospace'
    wrapText(ctx, entry, 104, 250, CARD_WIDTH - 208, 46)

    ctx.fillStyle = stats.escaped ? '#9be37a' : '#ff5a5a'
    ctx.font = '30px VT323, monospace'
    ctx.fillText(stats.escaped ? `Woke up with ${formatClock(stats.secondsLeft)} to spare` : 'Sank deeper into the dream', 72, 604)
    ctx.fillStyle = '#b9ab90'
    ctx.textAlign = 'right'
    ctx.fillText('Escape Room A  ·  voices by ElevenLabs  ·  dreamt by Gemini', CARD_WIDTH - 72, 604)

    const link = document.createElement('a')
    link.download = `dream-journal-${dreamer.name.toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = next
    }
  }
  if (line) ctx.fillText(line, x, y)
}
