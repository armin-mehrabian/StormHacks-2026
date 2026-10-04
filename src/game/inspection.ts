// Per-object inspection counts and the repeated-action GameEvent they produce.

import type { GameEvent } from '../shared/contract'

/** Inspections of one object that count as a repeated action. Initial choice, tune freely. */
export const REPEATED_INSPECTION_THRESHOLD = 3

export class InspectionTracker {
  private readonly counts = new Map<string, number>()

  /** Records one inspection and returns the object's new count. */
  inspect(objectId: string): number {
    const count = this.count(objectId) + 1
    this.counts.set(objectId, count)
    return count
  }

  count(objectId: string): number {
    return this.counts.get(objectId) ?? 0
  }
}

/**
 * Returns the event to emit for an inspection, or null. Fires at the threshold and every
 * multiple of it (3, 6, 9...); whether the narrator reacts is not the game's call.
 */
export function repeatedInspectionEvent(roomId: string, objectId: string, count: number): GameEvent | null {
  if (count < REPEATED_INSPECTION_THRESHOLD || count % REPEATED_INSPECTION_THRESHOLD !== 0) return null
  return { type: 'repeated_action', roomId, objectId, count }
}
