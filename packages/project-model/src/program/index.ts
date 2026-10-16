/**
 * `@portfolio/project-model/program` — the standalone `ExecutionProgram@1`
 * codec (AM-6).
 *
 * This entry's import closure is delivery validation only: `./types`, `./validate`
 * and the shared `strict-shape` primitive. It deliberately does not reach the
 * package root barrel, a source codec, the Layout compiler, any Camera evaluator
 * or Three, so a prepared release can import the program codec without pulling
 * authored-source machinery into the delivery path. The closure is proved by a
 * module-graph test rather than by review.
 *
 * `T4.P01.S02` imports this entry for F5 program slots. Nothing here is exported
 * from the package's root barrel.
 */

export * from './types';
export * from './validate';
