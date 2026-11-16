/**
 * Compare a recorded Scene 7 golden value with the current output.
 *
 * Stored Sun angles rebuild a direction through sin/cos, so the last few bits
 * may differ from `main`'s literal tuple. Every number is compared at the
 * plan's authored precision and every other field exactly. A field the current
 * output adds is a mismatch unless its path suffix is named in `allowedNew`
 * (Scene 8's identity mapping), which its own suite then pins.
 */
export const PARITY_TOLERANCE = 1e-9;

/** Fields Scene 8 adds to every textured spec; the golden predates them. */
export const SCENE_8_ADDED_FIELDS: readonly string[] = ['.textures.rotation', '.textures.offset'];

export function parityMismatches(
	recorded: unknown,
	current: unknown,
	path: string,
	out: string[],
	allowedNew: readonly string[] = SCENE_8_ADDED_FIELDS
): void {
	if (typeof recorded === 'number' && typeof current === 'number') {
		const scale = Math.max(1, Math.abs(recorded), Math.abs(current));
		if (Math.abs(recorded - current) > PARITY_TOLERANCE * scale) {
			out.push(`${path}: recorded ${recorded}, current ${current}`);
		}
		return;
	}
	if (Array.isArray(recorded) || Array.isArray(current)) {
		if (!Array.isArray(recorded) || !Array.isArray(current) || recorded.length !== current.length) {
			out.push(`${path}: array shape changed`);
			return;
		}
		for (const [index, value] of recorded.entries()) {
			parityMismatches(value, current[index], `${path}[${index}]`, out, allowedNew);
		}
		return;
	}
	if (recorded !== null && current !== null && typeof recorded === 'object' && typeof current === 'object') {
		const recordedRecord = recorded as Record<string, unknown>;
		const currentRecord = current as Record<string, unknown>;
		for (const key of Object.keys(recordedRecord)) {
			if (!(key in currentRecord)) {
				out.push(`${path}.${key}: recorded field disappeared`);
				continue;
			}
			parityMismatches(recordedRecord[key], currentRecord[key], `${path}.${key}`, out, allowedNew);
		}
		for (const key of Object.keys(currentRecord)) {
			if (key in recordedRecord) continue;
			const added = `${path}.${key}`;
			if (!allowedNew.some((suffix) => added.endsWith(suffix))) out.push(`${added}: field added since the golden`);
		}
		return;
	}
	if (recorded !== current) out.push(`${path}: recorded ${String(recorded)}, current ${String(current)}`);
}
