// Object descriptions (top) and the interaction prompt (bottom), rendered as crisp DOM
// so they stay readable at any camera zoom.

const DEFAULT_MS = 4500

export class Notice {
  private readonly message: HTMLDivElement
  private readonly prompt: HTMLDivElement
  private readonly promptLabel: HTMLSpanElement
  private hideTimer: ReturnType<typeof setTimeout> | undefined
  private shownPrompt: string | null = null

  constructor(parent: HTMLElement = document.body) {
    this.message = document.createElement('div')
    this.message.className = 'notice'
    this.message.hidden = true

    this.prompt = document.createElement('div')
    this.prompt.className = 'prompt'
    this.prompt.hidden = true
    const key = document.createElement('kbd')
    key.textContent = 'E'
    this.promptLabel = document.createElement('span')
    this.prompt.append(key, this.promptLabel)

    parent.append(this.message, this.prompt)
  }

  show(text: string, durationMs = DEFAULT_MS): void {
    this.message.textContent = text
    this.message.hidden = false
    // Restart the entrance animation for each new message.
    this.message.classList.remove('enter')
    void this.message.offsetWidth
    this.message.classList.add('enter')
    clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => {
      this.message.hidden = true
    }, durationMs)
  }

  /** Shows "E  <label>", or hides the prompt with null. Cheap to call every frame. */
  setPrompt(label: string | null): void {
    if (label === this.shownPrompt) return
    this.shownPrompt = label
    this.prompt.hidden = label === null
    if (label !== null) this.promptLabel.textContent = label
  }

  destroy(): void {
    clearTimeout(this.hideTimer)
    this.message.remove()
    this.prompt.remove()
  }
}
