import { geometryId } from '../types';

/**
 * Canonical **boundary-cycle key** for one oriented wall-reference cycle.
 * This is the single derivation used both by candidate-face
 * extraction (a face key) and by explicit boundary-lineage correspondence (a
 * persisted Room's `boundary` cycle): the token format and the
 * rotation-normalization live in exactly one place, so a face key and a Room
 * lineage key can never diverge.
 *
 * The key is temporarily-scoped evidence only — never persisted as Room
 * identity, and never a Room ID.
 */
export function canonicalBoundaryCycleKey(
	refs: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>,
): string {
	return canonicalFaceKey(keyFloorlessTokens(refs));
}

export function keyFloorlessTokens(
	boundary: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>,
): string[] {
	return boundary.map((ref) => `${ref.wallId}~${ref.direction === 'forward' ? 'F' : 'R'}`);
}

/**
 * Canonical face key from the oriented cycle: rotate so the
 * lexicographically smallest token sequence comes first, then serialize with
 * the collision-safe `geometryId` helper. The reversed cycle is
 * NOT considered — bounded traversal orientation is already canonical.
 */
export function canonicalFaceKey(tokens: readonly string[]): string {
	let smallest: string[] = [...tokens];
	for (let rotation = 1; rotation < tokens.length; rotation += 1) {
		const candidate = [...tokens.slice(rotation), ...tokens.slice(0, rotation)];
		if (candidate.join('|') < smallest.join('|')) {
			smallest = candidate;
		}
	}
	return geometryId(['face', ...smallest]);
}
