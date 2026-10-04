// Digit entry for code locks. The game state checks the code; this only collects it.

import { modalClosed, modalOpened } from './modal.ts'

/** Returns true when the code was accepted (the lock closes the overlay). */
export type SubmitCode = (code: string) => boolean

export class CodeLock {
  private readonly root: HTMLDivElement
  private readonly card: HTMLDivElement
  private readonly heading: HTMLHeadingElement
  private readonly input: HTMLInputElement
  private readonly status: HTMLParagraphElement
  private submit: SubmitCode | undefined
  private digits = 0

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div')
    this.root.className = 'overlay'
    this.root.hidden = true
    this.card = document.createElement('div')
    this.card.className = 'lock-card'
    this.heading = document.createElement('h2')
    this.input = document.createElement('input')
    this.input.className = 'lock-input'
    this.input.inputMode = 'numeric'
    this.input.autocomplete = 'off'
    this.status = document.createElement('p')
    this.status.className = 'lock-status'
    const hint = document.createElement('p')
    hint.className = 'overlay-hint'
    hint.textContent = 'Enter to try, Esc to step away'
    this.card.append(this.heading, this.input, this.status, hint)
    this.root.append(this.card)
    parent.appendChild(this.root)

    this.input.addEventListener('input', () => {
      this.input.value = this.input.value.replace(/\D/g, '').slice(0, this.digits)
      this.status.textContent = ''
    })
    this.input.addEventListener('keydown', (event) => {
      // Keep typing out of the game's key handlers.
      event.stopPropagation()
      if (event.key === 'Escape') this.close()
      if (event.key === 'Enter') this.trySubmit()
    })
    this.card.addEventListener('animationend', () => this.card.classList.remove('shake'))
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  show(lockName: string, digits: number, submit: SubmitCode): void {
    this.heading.textContent = `${lockName}: ${digits}-digit code`
    this.digits = digits
    this.input.maxLength = digits
    this.input.placeholder = '_'.repeat(digits)
    this.input.value = ''
    this.status.textContent = ''
    this.submit = submit
    this.root.hidden = false
    modalOpened()
    this.input.focus()
  }

  close(): void {
    if (!this.isOpen) return
    this.root.hidden = true
    this.input.blur()
    this.submit = undefined
    modalClosed()
  }

  destroy(): void {
    this.close()
    this.root.remove()
  }

  private trySubmit(): void {
    if (this.input.value.length !== this.digits || !this.submit) return
    if (this.submit(this.input.value)) {
      this.close()
      return
    }
    this.status.textContent = 'Wrong code'
    this.input.select()
    this.card.classList.remove('shake')
    // Restart the shake animation on repeated wrong codes.
    void this.card.offsetWidth
    this.card.classList.add('shake')
  }
}
