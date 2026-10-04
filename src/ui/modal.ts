// Tracks whether a DOM overlay (page, code lock, end screen) owns the keyboard, so the
// game pauses movement and interaction while one is open.

// Keys that close an overlay (E, Enter) would otherwise also reach the game on the same
// frame and immediately re-trigger an interaction.
const CLOSE_GRACE_MS = 250

let openCount = 0
let lastClosedAt = Number.NEGATIVE_INFINITY

export function modalOpened(): void {
  openCount++
}

export function modalClosed(): void {
  openCount = Math.max(0, openCount - 1)
  lastClosedAt = performance.now()
}

/** True while an overlay is open, and briefly after the last one closes. */
export function modalBlocksInput(): boolean {
  return openCount > 0 || performance.now() - lastClosedAt < CLOSE_GRACE_MS
}
