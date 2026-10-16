/**
 * One strict shape reader for the shared foundation interfaces.
 *
 * F.1 references (`references-v1`) and F.3 channels (`inspection-v1`) are
 * persisted/cross-domain formats, so their validators reject unknown keys,
 * non-finite numbers, empty identities and unsupported versions instead of
 * tolerating them. Both grammars are the same primitive one (a strict tagged
 * object with opaque ids and finite numbers), so the reader lives here once
 * rather than twice (`apps/editor/tests/README.md` rule 7).
 *
 * The reader never throws and never coerces: a defect is recorded with its path
 * and code, and the caller decides whether the result is blocking.
 */

export type ShapeIssue = { path: string; code: string; message: string };

/**
 * A validator result. `ignoredOptionalExtensions` names the declared optional
 * extensions this reader does not support: they are ignored, and because an
 * extension entry carries no payload they cannot alter core identity.
 */
export type ShapeValidation<T> =
	| { success: true; value: T; ignoredOptionalExtensions: readonly string[] }
	| { success: false; issues: readonly ShapeIssue[] };

/** An optional-value reader: `null`/`undefined` read as absent. */
export function isAbsent(input: unknown): boolean {
	return input === null || input === undefined;
}

export class ShapeReader {
	readonly issues: ShapeIssue[] = [];

	problem(path: string, code: string, message: string): void {
		this.issues.push({ path, code, message });
	}

	/** A plain object (not an array, not null) with exactly the allowed keys. */
	object(input: unknown, path: string, allowedKeys: readonly string[]): Record<string, unknown> | null {
		if (typeof input !== 'object' || input === null || Array.isArray(input)) {
			this.problem(path, 'not-an-object', `${path} must be an object`);
			return null;
		}
		const record = input as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			if (!allowedKeys.includes(key)) this.problem(`${path}.${key}`, 'unknown-key', `${path}.${key} is not part of the format`);
		}
		return record;
	}

	/** A nonempty string with no surrounding whitespace instability. */
	string(input: unknown, path: string): string | null {
		if (typeof input !== 'string' || input.trim() === '') {
			this.problem(path, 'invalid-string', `${path} must be a nonempty string`);
			return null;
		}
		return input;
	}

	/** A stable opaque identity: a nonempty string, never a parsed display label. */
	opaqueId(input: unknown, path: string): string | null {
		const value = this.string(input, path);
		if (value !== null && /\s/.test(value)) {
			this.problem(path, 'invalid-identity', `${path} must be a stable id without whitespace`);
			return null;
		}
		return value;
	}

	/** A nullable opaque identity; `null` is an explicit absence, not a fabricated value. */
	nullableOpaqueId(input: unknown, path: string): string | null | undefined {
		if (isAbsent(input)) return null;
		return this.opaqueId(input, path) ?? undefined;
	}

	boolean(input: unknown, path: string): boolean | null {
		if (typeof input !== 'boolean') {
			this.problem(path, 'invalid-boolean', `${path} must be a boolean`);
			return null;
		}
		return input;
	}

	number(input: unknown, path: string): number | null {
		if (typeof input !== 'number' || !Number.isFinite(input)) {
			this.problem(path, 'non-finite-number', `${path} must be a finite number`);
			return null;
		}
		return input;
	}

	/** A finite number that is at least `minimum`, optionally strictly greater. */
	numberAtLeast(input: unknown, path: string, minimum: number, exclusive: boolean): number | null {
		const value = this.number(input, path);
		if (value === null) return null;
		if (exclusive ? value <= minimum : value < minimum) {
			this.problem(path, 'out-of-range', `${path} must be ${exclusive ? 'greater than' : 'at least'} ${minimum}`);
			return null;
		}
		return value;
	}

	/** A non-negative integer (run epochs, generations and counters are monotonic integers). */
	integerAtLeast(input: unknown, path: string, minimum: number): number | null {
		if (typeof input !== 'number' || !Number.isInteger(input) || input < minimum) {
			this.problem(path, 'invalid-integer', `${path} must be an integer >= ${minimum}`);
			return null;
		}
		return input;
	}

	/** An array of opaque ids. */
	opaqueIdArray(input: unknown, path: string): string[] | null {
		if (!Array.isArray(input)) {
			this.problem(path, 'not-an-array', `${path} must be an array`);
			return null;
		}
		const values: string[] = [];
		for (const [index, entry] of input.entries()) {
			const value = this.opaqueId(entry, `${path}[${index}]`);
			if (value === null) return null;
			values.push(value);
		}
		return values;
	}

	/** A finite numeric triple (a project-world vector or origin in meters). */
	vector3(input: unknown, path: string): [number, number, number] | null {
		if (!Array.isArray(input) || input.length !== 3) {
			this.problem(path, 'invalid-vector', `${path} must be a three-number array`);
			return null;
		}
		const values: number[] = [];
		for (const [index, entry] of input.entries()) {
			const value = this.number(entry, `${path}[${index}]`);
			if (value === null) return null;
			values.push(value);
		}
		return [values[0]!, values[1]!, values[2]!];
	}

	/** A tag from a closed vocabulary. */
	tag(input: unknown, path: string, allowed: readonly string[]): string | null {
		if (typeof input !== 'string' || !allowed.includes(input)) {
			this.problem(path, 'unknown-tag', `${path} must be one of ${allowed.join(' | ')}`);
			return null;
		}
		return input;
	}
}
