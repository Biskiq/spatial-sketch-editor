/** Equality strategies compared by the P23B.6 S3 advisory probe. */
export function s1DeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
		return false;
	}
	if (Array.isArray(left) !== Array.isArray(right)) return false;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
		if (!s1DeepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])) {
			return false;
		}
	}
	return true;
}

export function jsonStringDeepEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
