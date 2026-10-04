// Watches the player over time and decides when the narrator should help: lingering
// near the next step, going too long without progress, and time warnings. Hint text
// always comes from the blueprint's ladder, so help is never invented.

import type { GameEvent } from '../shared/contract.ts'
import type { GameState } from './state.ts'

/** Initial implementation choices. */
const STUCK_AFTER_MS = 25_000
const NEAR_AFTER_MS = 4_000
const NEAR_RANGE_PX = 56
/** Must step this far away before another "near" hint for the same spot. */
const NEAR_RESET_RANGE_PX = 96
const TIME_WARNINGS_S = [120, 60, 30] as const

export type WatcherEvent = Pick<GameEvent, 'type' | 'objectId' | 'objectName' | 'hint' | 'hintLevel' | 'detail'>

export class PlayerWatcher {
  private readonly state: GameState
  private readonly emit: (event: WatcherEvent) => void
  private readonly hintLevels = new Map<string, number>()
  private readonly warned = new Set<number>()
  private sinceProgressMs = 0
  private nearMs = 0
  private nearArmed = true

  constructor(state: GameState, emit: (event: WatcherEvent) => void) {
    this.state = state
    this.emit = emit
  }

  /** Call when the player makes real progress (finds, unlocks, reads something new). */
  noteProgress(): void {
    this.sinceProgressMs = 0
  }

  /**
   * @param distanceToNextStep pixels from the player to the next intended step's object,
   * or undefined if there is none.
   */
  update(deltaMs: number, distanceToNextStep: number | undefined): void {
    if (this.state.status !== 'playing') return

    const secondsLeft = this.state.timeRemainingMs / 1000
    for (const threshold of TIME_WARNINGS_S) {
      if (secondsLeft <= threshold && !this.warned.has(threshold)) {
        // Warn once per threshold, and only for the most urgent one crossed.
        TIME_WARNINGS_S.filter((t) => t >= threshold).forEach((t) => this.warned.add(t))
        this.emit({ type: 'time_warning', detail: `${threshold} seconds left` })
        return
      }
    }

    if (distanceToNextStep !== undefined) {
      if (distanceToNextStep > NEAR_RESET_RANGE_PX) this.nearArmed = true
      if (this.nearArmed && distanceToNextStep <= NEAR_RANGE_PX) {
        this.nearMs += deltaMs
        if (this.nearMs >= NEAR_AFTER_MS) {
          this.nearMs = 0
          this.nearArmed = false
          this.hint('near_solution')
          return
        }
      } else {
        this.nearMs = 0
      }
    }

    this.sinceProgressMs += deltaMs
    if (this.sinceProgressMs >= STUCK_AFTER_MS) {
      this.sinceProgressMs = 0
      this.hint('stuck')
    }
  }

  private hint(type: 'near_solution' | 'stuck'): void {
    const targetId = this.state.nextStepId()
    if (!targetId) return
    const ladder = this.state.blueprint.hints.find((h) => h.targetId === targetId)
    if (!ladder || ladder.lines.length === 0) return
    const level = this.hintLevels.get(targetId) ?? 0
    const index = Math.min(level, ladder.lines.length - 1)
    this.hintLevels.set(targetId, level + 1)
    // No objectId/objectName: they would reveal the answer before the ladder does.
    this.emit({ type, hint: ladder.lines[index], hintLevel: index })
  }
}
