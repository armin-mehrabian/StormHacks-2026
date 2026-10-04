// Typed game-event emitter. The game emits GameEvents at meaningful moments;
// consumers (e.g. a later client NarratorManager) subscribe and decide what to do.
// The game never waits on listeners: dispatch is synchronous and fire-and-forget,
// so listeners must start any slow work (network, audio) asynchronously.

import type { GameEvent } from '../shared/contract'

export type GameEventListener = (event: Readonly<GameEvent>) => void

export class GameEventEmitter {
  private readonly listeners = new Set<GameEventListener>()

  /** Registers a listener. Returns a function that unsubscribes it. */
  subscribe(listener: GameEventListener): () => void {
    this.listeners.add(listener)
    return () => this.unsubscribe(listener)
  }

  unsubscribe(listener: GameEventListener): void {
    this.listeners.delete(listener)
  }

  emit(event: GameEvent): void {
    const frozen = Object.freeze({ ...event })
    // Copy so listeners can unsubscribe during dispatch.
    for (const listener of [...this.listeners]) {
      try {
        listener(frozen)
      } catch (error) {
        // A broken listener must never break gameplay or other listeners.
        console.error('[game-events] listener failed', error)
      }
    }
  }
}

/** App-wide emitter shared by the game and its consumers. */
export const gameEvents = new GameEventEmitter()
