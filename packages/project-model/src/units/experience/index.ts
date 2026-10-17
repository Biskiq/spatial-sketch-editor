/**
 * The shared Experience runtime preparation (AM-6, T3.P01.S06), behind the same
 * inactive `./units` subpath as the F.2 envelope it reads.
 *
 * Lowering, the one interpreter and the semantic companion are runtime-safe and
 * have no editor, renderer, Svelte or Three dependency. Nothing here activates a
 * source or runtime: `T3.P01.S04` owns the cutover and every editor/Preview
 * caller.
 */

export * from './lowering';
export * from './interpreter';
export * from './companion';
export * from './policy';
