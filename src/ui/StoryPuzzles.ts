// The story-lock screens: a story question (choice), facing the fear, the identity board
// ("who am I?"), and the toy piano. Each returns the player's answer through `submit`,
// which reports whether it was right; wrong answers shake the card.

import { NOTES } from '../shared/blueprint.ts'
import type { IdentityQuestion } from '../shared/blueprint.ts'
import { PuzzleOverlay, button, shuffled } from './PuzzleOverlay.ts'

/** Returns true when the answer opened the lock (the screen then closes). */
export type Submit<T> = (answer: T) => boolean

const WRONG = 'The dream shudders... time slips away.'

/** A story question or the fear: pick one of three. */
export class ChoicePuzzle extends PuzzleOverlay {
  constructor() {
    super('choice-card')
  }

  show(heading: string, question: string, options: string[], submit: Submit<number>, fear = false): void {
    this.card.classList.toggle('fear-card', fear)
    const prompt = document.createElement('p')
    prompt.className = 'puzzle-question'
    prompt.textContent = question
    const list = document.createElement('div')
    list.className = 'choice-list'
    // Keep each option's original index while shuffling the display order.
    for (const { option, index } of shuffled(options.map((option, index) => ({ option, index })))) {
      list.append(
        button(option, 'choice-option', () => {
          if (submit(index)) this.close()
          else this.rejected(WRONG)
        }),
      )
    }
    this.body.replaceChildren(prompt, list)
    this.open(heading)
    ;(list.firstElementChild as HTMLButtonElement | null)?.focus()
  }
}

/** The mirror: fill in who you are from three options per blank. */
export class IdentityBoard extends PuzzleOverlay {
  constructor() {
    super('identity-card')
  }

  show(questions: IdentityQuestion[], submit: Submit<string[]>): void {
    const picks: (string | undefined)[] = questions.map(() => undefined)
    const rows = questions.map((q, row) => {
      const element = document.createElement('div')
      element.className = 'identity-row'
      const prompt = document.createElement('span')
      prompt.className = 'identity-prompt'
      prompt.textContent = q.prompt
      const options = document.createElement('div')
      options.className = 'identity-options'
      for (const option of shuffled([q.answer, ...q.decoys])) {
        const choice = button(option, 'identity-option', () => {
          picks[row] = option
          for (const sibling of options.children) sibling.classList.toggle('picked', sibling === choice)
          confirm.disabled = picks.some((pick) => pick === undefined)
        })
        options.append(choice)
      }
      element.append(prompt, options)
      return element
    })
    const confirm = button('This is me', 'ui-button', () => {
      if (submit(picks.map((pick) => pick ?? ''))) this.close()
      else this.rejected(`${WRONG} That isn't me.`)
    })
    confirm.disabled = true
    this.body.replaceChildren(...rows, confirm)
    this.open('Who am I?')
  }
}

/** The toy piano: replay the music box melody on five keys. */
export class PianoPuzzle extends PuzzleOverlay {
  private readonly onNote: (note: string) => void

  constructor(onNote: (note: string) => void) {
    super('piano-card')
    this.onNote = onNote
  }

  show(length: number, submit: Submit<string>): void {
    let played = ''
    const slots = document.createElement('div')
    slots.className = 'piano-slots'
    const render = () => {
      slots.replaceChildren(
        ...Array.from({ length }, (_, i) => {
          const slot = document.createElement('span')
          slot.className = 'piano-slot'
          slot.textContent = played[i] ?? '·'
          return slot
        }),
      )
    }
    const keys = document.createElement('div')
    keys.className = 'piano-keys'
    const press = (note: string) => {
      this.onNote(note)
      played += note
      render()
      if (played.length < length) return
      if (submit(played)) {
        this.close()
        return
      }
      this.rejected(`${WRONG} That wasn't the song.`)
      played = ''
      setTimeout(render, 500)
    }
    for (const note of NOTES) keys.append(button(note, 'piano-key', () => press(note)))
    render()
    const tip = document.createElement('p')
    tip.className = 'puzzle-question'
    tip.textContent = 'Play the song from the music box. Keys: C D E G A (or click).'
    this.body.replaceChildren(tip, slots, keys)
    this.open('Toy piano')
    const onKey = (event: KeyboardEvent) => {
      const note = event.key.toUpperCase()
      if (!this.isOpen) {
        window.removeEventListener('keydown', onKey)
        return
      }
      if ((NOTES as readonly string[]).includes(note)) {
        event.preventDefault()
        event.stopPropagation()
        press(note)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
  }
}
