/**
 * `layout-geometry-keys.ts` — the one encoder for compiled-geometry cache keys
 * (T1.P02.S06 D.1 / H3).
 *
 * A compiled entity's `cacheKey` names the inputs its compiled output depends
 * on. It is compared for equality only (the Floor-support witness check and the
 * tests are the whole consumer inventory), so the contract is **equal iff
 * equal**, not "byte-identical to any earlier format". This encoder meets it
 * with a self-delimiting, escape-free format:
 *
 * ```text
 * <tag><length>:<text>      one part
 *   s  string          n  number        b  boolean
 *   z  null            u  undefined     j  JSON value (objects and arrays)
 *   k  a nested cache key, embedded by reference
 * ```
 *
 * Because every part carries its own length, a nested key is embedded by
 * concatenation: its text is never scanned again, never re-escaped and never
 * re-serialized. `JSON.stringify` used to escape a nested key's every quote at
 * each level, which is the repeated work Bench 1 counted as `cache-key:chars`
 * (a grid-L compile serialized 97 M characters, and 65 ms of the compile was
 * `JSON.stringify`). Bench 1's probe is the evidence; this module is the fix.
 *
 * Data objects (`segment`, an Opening list, a boundary) still go through
 * `JSON.stringify` once, because they are authored-shaped values with no
 * canonical pre-encoding. They are encoded once per entity and reused as a
 * nested key afterwards.
 */
import { countWork } from './p2311-perf';

/** A compiled entity's change-detection key. Opaque; compare for equality only. */
export type CacheKey = string;

const DEPENDENCY = Symbol('layout-geometry-cache-key');

/** A nested cache key, marked so it is embedded as a key rather than a string. */
export type CacheKeyDependency = { readonly [DEPENDENCY]: CacheKey };

/** Wrap an already-built key so an outer key can embed it without re-encoding. */
export function cacheKeyDependency(key: CacheKey): CacheKeyDependency {
	return { [DEPENDENCY]: key };
}

function isDependency(value: unknown): value is CacheKeyDependency {
	return typeof value === 'object' && value !== null && DEPENDENCY in value;
}

/**
 * Encode one part. Every branch is length-prefixed, so the concatenation of
 * parts is uniquely decodable and two different part lists can never produce
 * one key.
 */
function encodePart(part: unknown, out: string[]): void {
	switch (typeof part) {
		case 'string':
			out.push('s', String(part.length), ':', part);
			return;
		case 'number': {
			const text = String(part);
			out.push('n', String(text.length), ':', text);
			return;
		}
		case 'boolean':
			out.push(part ? 'b1:1' : 'b1:0');
			return;
		case 'undefined':
			out.push('u0:');
			return;
		case 'object':
			if (part === null) {
				out.push('z0:');
				return;
			}
			if (isDependency(part)) {
				out.push('k', String(part[DEPENDENCY].length), ':', part[DEPENDENCY]);
				return;
			}
			break;
		default:
			break;
	}
	// Authored-shaped data. One `JSON.stringify` for this part, counted so a
	// census can prove no nested key ever takes this branch.
	const json = JSON.stringify(part) ?? 'null';
	countWork('cache-key:json-chars', json.length);
	out.push('j', String(json.length), ':', json);
}

/** Build one cache key from its parts; the only key constructor in the compiler. */
export function cacheKeyOf(parts: readonly unknown[]): CacheKey {
	const out: string[] = [];
	for (const part of parts) encodePart(part, out);
	const key = out.join('');
	// T1.P02.S06 work counts (inert without an observer): the key's own length and
	// the data characters that had to be re-serialized to build it.
	countWork('cache-key:chars', key.length);
	countWork('cache-key:built');
	return key;
}
