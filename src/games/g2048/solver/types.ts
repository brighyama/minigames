import type { Board, Dir } from '../lib'

/**
 * A pluggable 2048 solver. Implement this interface to swap in your own
 * algorithm (e.g. a trained reinforcement-learning policy) — see
 * `solver/index.ts` for where the active solver is chosen.
 */
export interface Solver {
  /** Human-readable name, shown in the UI while the solver runs. */
  readonly name: string
  /**
   * Pick the next move for the given board. Return `null` when no legal move
   * exists (the game is over). The function must be pure with respect to the
   * board (it may read internal model state but must not mutate `board`).
   */
  chooseMove(board: Board): Dir | null
  /** Optional hook called when a new game starts, for stateful solvers. */
  reset?(): void
}

/** A zero-arg factory that produces a fresh solver instance. */
export type SolverFactory = () => Solver
