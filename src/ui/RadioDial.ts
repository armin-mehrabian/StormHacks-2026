// The radio tuning dial: sweep through the static until a station cuts through. Holding
// the right frequency for a moment locks it in. No penalty for searching: tuning is the
// puzzle, the frequency itself is the clue.

import { PuzzleOverlay } from './PuzzleOverlay.ts'
import type { Submit } from './StoryPuzzles.ts'

const MIN = 88
const MAX = 107.9
/** Within this many MHz the station starts to fade in through the static. */
const SIGNAL_RANGE = 1.5
const LOCK_MS = 800

export interface TunerSound {
  setSignal(signal: number): void
  stop(): void
}

export class RadioDial extends PuzzleOverlay {
  private readonly startTuner: () => TunerSound
  private tuner: TunerSound | undefined
  private lockTimer: ReturnType<typeof setTimeout> | undefined

  /** startTuner begins the static/station sound while the dial is open. */
  constructor(startTuner: () => TunerSound) {
    super('radio-card')
    this.startTuner = startTuner
  }

  show(name: string, target: string, submit: Submit<string>): void {
    const goal = Number(target)
    let frequency = 88 + Math.round(Math.random() * 60) / 10

    const display = document.createElement('div')
    display.className = 'radio-display'
    const meter = document.createElement('div')
    meter.className = 'radio-meter'
    const needle = document.createElement('div')
    needle.className = 'radio-needle'
    meter.append(needle)
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.className = 'radio-slider'
    slider.min = String(MIN)
    slider.max = String(MAX)
    slider.step = '0.1'
    const tip = document.createElement('p')
    tip.className = 'puzzle-question'
    tip.textContent = 'Drag, or ←/→ to tune (Shift for big steps).'

    const update = () => {
      frequency = Math.min(MAX, Math.max(MIN, Math.round(frequency * 10) / 10))
      slider.value = String(frequency)
      display.textContent = `${frequency.toFixed(1)} FM`
      needle.style.left = `${((frequency - MIN) / (MAX - MIN)) * 100}%`
      const signal = Math.max(0, 1 - Math.abs(frequency - goal) / SIGNAL_RANGE)
      this.tuner?.setSignal(signal)
      display.classList.toggle('locked', signal > 0.95)
      clearTimeout(this.lockTimer)
      if (Math.abs(frequency - goal) < 0.05) {
        this.lockTimer = setTimeout(() => {
          if (submit(frequency.toFixed(1))) this.close()
        }, LOCK_MS)
      }
    }
    slider.addEventListener('input', () => {
      frequency = Number(slider.value)
      update()
    })
    const onKey = (event: KeyboardEvent) => {
      if (!this.isOpen) {
        window.removeEventListener('keydown', onKey, { capture: true })
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      event.stopPropagation()
      frequency += (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : 0.1)
      update()
    }
    window.addEventListener('keydown', onKey, { capture: true })

    this.body.replaceChildren(display, meter, slider, tip)
    this.open(name)
    this.tuner = this.startTuner()
    update()
    slider.focus()
  }

  override close(): void {
    clearTimeout(this.lockTimer)
    this.tuner?.stop()
    this.tuner = undefined
    super.close()
  }
}
