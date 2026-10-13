/**
 * The exact-bit key of one Room-label eligibility grid, and the exact-bit hashing every
 * key and digest in this area is built from.
 *
 * WHY THIS IS ITS OWN MODULE. The key is a PRODUCT concern: the shipped placer keys a
 * bounded cache of derived grid candidates by it, so two passes over the same geometry do
 * not walk the same grid twice. It used to live in `p23b-m1-room-label-arm.ts`, which is
 * the M1 BEFORE/AFTER arm INSTRUMENT — it measures the placer, so the dependency must run
 * instrument → product and never the other way, and a shipped cache keyed by a function
 * that lives with a DEV-only arm is one instrument deletion away from a broken product.
 * This module is what the two of them share instead: the placer imports the key, and the
 * instrument imports the key AND the primitives (its result digests are built from the
 * SAME machinery on purpose — "the two passes placed the same labels" has to mean it to
 * the last bit, and a second implementation could drift).
 *
 * THE HASHING IS EXACT-BIT, ON PURPOSE. Every coordinate contributes all 64 of its bits,
 * never a rounded copy: rounding would turn two different grids into one key, and for a
 * cache that is the one direction that must not happen — a rounded key would hand one
 * geometry's candidates to another geometry. Two independent 32-bit FNV-1a accumulators
 * are carried over the same words, so a key is 64 bits wide in `low-high` base-36 form;
 * a collision needs both accumulators to collide at once, and the string form is what
 * lets a key be a `Map` key and be printed in a capture without re-deriving anything.
 *
 * ONE ACCUMULATOR, NEVER HELD ACROSS A CALL. `HASH_ACCUMULATOR` is module state so the
 * walk allocates nothing; every entry point RESETS it and every exit reads it, and no
 * caller may hold a partially-fed accumulator across another hash. That was the contract
 * when this code lived in the instrument, and it is the contract here.
 */

/**
 * The exact-bit hash of one eligibility grid's inputs, structurally. It is exactly what
 * `freeSpaceCandidates` in the placer is handed, which is what determines the grid
 * completely: the cell budget comes from the projected polygon's own bounding box, the
 * inside test from the polygon's rows, and the eligibility from the polygon, the mask and
 * the centre. Two builds with equal inputs therefore have equal grids — the grid reads
 * nothing else — which is what makes an input-equal key a sound cache key.
 */
export type RoomLabelGridInputs = {
	polygonScreen: readonly (readonly [number, number])[];
	mask: {
		protectedEdges: readonly { points: readonly (readonly [number, number])[]; clearancePx: number }[];
		obstacles: readonly { polygon: readonly (readonly [number, number])[]; clearancePx: number }[];
		acquisition: readonly {
			center: readonly [number, number];
			radiusPx: number;
			clearancePx: number;
		}[];
		activeText: readonly {
			rect: { minX: number; minY: number; maxX: number; maxY: number };
			clearancePx: number;
		}[];
	};
	centerScreen: readonly [number, number];
};

const HASH_WORDS = new Float64Array(1);
const HASH_VIEW = new Uint32Array(HASH_WORDS.buffer);
const HASH_ACCUMULATOR = new Uint32Array(2);

/** Start a hash: the same seeds every entry point uses, so a key and a digest agree. */
export function exactBitHashReset(): void {
	HASH_ACCUMULATOR[0] = 2166136261;
	HASH_ACCUMULATOR[1] = 32452843;
}

/** Feed one 32-bit word. */
export function exactBitHashWord(word: number): void {
	HASH_ACCUMULATOR[0] = Math.imul(HASH_ACCUMULATOR[0]! ^ word, 16777619) >>> 0;
	HASH_ACCUMULATOR[1] = Math.imul(HASH_ACCUMULATOR[1]! ^ word, 2246822519) >>> 0;
}

/** Feed one number over all 64 of its bits — the exponent and mantissa as written. */
export function exactBitHashNumber(value: number): void {
	HASH_WORDS[0] = value;
	exactBitHashWord(HASH_VIEW[0]!);
	exactBitHashWord(HASH_VIEW[1]!);
}

/** Close the hash and read it as the `low-high` base-36 string every key here is. */
export function exactBitHashDigest(): string {
	return `${HASH_ACCUMULATOR[0]!.toString(36)}-${HASH_ACCUMULATOR[1]!.toString(36)}`;
}

/** One polyline: its point count, then every coordinate's exact bits. */
function hashPoints(points: readonly (readonly [number, number])[]): void {
	exactBitHashWord(points.length);
	for (const point of points) {
		exactBitHashNumber(point[0]);
		exactBitHashNumber(point[1]);
	}
}

/**
 * The key of one grid build: every input, in order, including the counts that separate
 * one shape of mask from another. `centerScreen` and the mask clearances are hashed as
 * well as the geometry, because the grid's eligibility reads all of them.
 *
 * WHAT IT DELIBERATELY DOES NOT COVER, stated because a cache turns an omission into a
 * wrong answer: the distance ENGINE. The placer has two (`seeded` and the legacy
 * `pruned`), and this key is the SHIPPED one's — the shipped path always builds `seeded`,
 * so an input-equal key is an engine-equal key there. A caller that ever routes a
 * different engine through a cache keyed here would be reusing the wrong grid; the DEV
 * arms bypass the cache precisely so that cannot happen.
 */
export function roomLabelGridKey(inputs: RoomLabelGridInputs): string {
	exactBitHashReset();
	hashPoints(inputs.polygonScreen);
	exactBitHashNumber(inputs.centerScreen[0]);
	exactBitHashNumber(inputs.centerScreen[1]);
	const { protectedEdges, obstacles, acquisition, activeText } = inputs.mask;
	exactBitHashWord(protectedEdges.length);
	for (const edge of protectedEdges) {
		hashPoints(edge.points);
		exactBitHashNumber(edge.clearancePx);
	}
	exactBitHashWord(obstacles.length);
	for (const obstacle of obstacles) {
		hashPoints(obstacle.polygon);
		exactBitHashNumber(obstacle.clearancePx);
	}
	exactBitHashWord(acquisition.length);
	for (const zone of acquisition) {
		exactBitHashNumber(zone.center[0]);
		exactBitHashNumber(zone.center[1]);
		exactBitHashNumber(zone.radiusPx);
		exactBitHashNumber(zone.clearancePx);
	}
	exactBitHashWord(activeText.length);
	for (const text of activeText) {
		exactBitHashNumber(text.rect.minX);
		exactBitHashNumber(text.rect.minY);
		exactBitHashNumber(text.rect.maxX);
		exactBitHashNumber(text.rect.maxY);
		exactBitHashNumber(text.clearancePx);
	}
	return exactBitHashDigest();
}
