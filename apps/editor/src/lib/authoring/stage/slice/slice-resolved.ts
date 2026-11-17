/**
 * The live resolved Slice, for consumers that are not Svelte components.
 *
 * The reading (`sliceReading`) stores **what kind of cut** was asked for; resolving
 * it needs the Sheet height and the level datum, which the route holds. The pick
 * providers are plain modules created by an adapter factory, so they cannot read a
 * route's `$derived` value directly.
 *
 * This mirror is the same shape as `liftedSourcesNow`: the route writes the value
 * it already computed for the Canvas, and `layout.adapter.ts` reads it lazily, on the
 * pointer. One writer, one reader, no second derivation of a cut.
 *
 * Not reactive on purpose: it is read inside a pointer event, never in a template.
 */
import type { ResolvedSlice } from './slice-cut';

let current: ResolvedSlice | null = null;

/** Called by the route whenever its resolved reading changes (including to null). */
export function setResolvedSlice(resolved: ResolvedSlice | null): void {
	current = resolved;
}

/** The live reading, exactly as the Stage Canvas received it; null when Slice is off. */
export function resolvedSliceNow(): ResolvedSlice | null {
	return current;
}
