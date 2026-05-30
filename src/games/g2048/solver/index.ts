// Active-solver registry. To plug in your own algorithm, implement the `Solver`
// interface (see ./types) in its own file and return it from `createSolver()`
// below — nothing else in the game needs to change. You can also keep several
// solvers around and switch between them here.

import { createExpectimaxSolver } from './expectimax'
import type { Solver, SolverFactory } from './types'

export type { Solver, SolverFactory } from './types'

/** Named factories, handy for benchmarking multiple solvers side by side. */
export const solvers: Record<string, SolverFactory> = {
  expectimax: () => createExpectimaxSolver(),
  // myRLSolver: () => createMyRLSolver(),
}

/** The solver the "Watch AI" button uses. Swap this to change the default. */
export function createSolver(): Solver {
  return solvers.expectimax()
}
