/**
 * Deep freeze for normalized material values.
 *
 * A definition is immutable: a caller that mutates a returned recipe could give
 * two consumers different bytes for one revision. The reader freezes the whole
 * graph (objects and arrays), so a mutation fails in strict mode instead of
 * silently changing identity. `canonicalUnitJson` also memoizes frozen subtrees,
 * which makes repeated hashing of an unchanged recipe cheap.
 */
export function deepFreeze<T>(value: T): T {
	if (value === null || typeof value !== 'object') return value;
	if (Object.isFrozen(value)) return value;
	Object.freeze(value);
	for (const child of Object.values(value as Record<string, unknown>)) {
		deepFreeze(child);
	}
	return value;
}
