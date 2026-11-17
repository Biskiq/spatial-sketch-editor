/**
 * The live effective cutaway, for consumers that are not Svelte components.
 *
 * The route derives the effective set (classified, minus the selection hosts and
 * the sticky releases, masked by Whole/hold/Plan) and writes it here; the plain
 * pick providers and the Slice's scene predicate read it lazily, on the pointer.
 * One writer, one reader, no second classification — the same shape as
 * `slice-resolved.ts` and `liftedSourcesNow`.
 *
 * Not reactive on purpose: it is read inside a pointer event, never in a template.
 */
export type ResolvedCutaway = {
	/** The Walls the Canvas actually cuts (already masked and already closed by D12). */
	readonly wallIds: ReadonlySet<string>;
	/** The horizontal stub top every cut Wall shares. */
	readonly stubTopY: number;
};

let current: ResolvedCutaway | null = null;

/** Called by the route whenever the effective set changes (including to null). */
export function setResolvedCutaway(resolved: ResolvedCutaway | null): void {
	current = resolved;
}

/** The live effective set exactly as the Canvas received it; null when whole. */
export function resolvedCutawayNow(): ResolvedCutaway | null {
	return current;
}
