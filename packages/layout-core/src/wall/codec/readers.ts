import { countWork } from '../../kernel/work-observer';
import { hasImmutableJsonProof } from '../../kernel/immutable-json';
import type { LayoutDocumentIssue } from '../../plan/issue';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { JsonRecord, ParsedValue } from './schema';
import { ID_PATTERN } from './schema';

// Only a value already deeply immutable WHEN validated may enter this cache.
// A mutable parser output could be changed before a later freeze, so merely
// remembering "the parser once produced this object" would be unsound.
const NORMALIZED_FROZEN_ELEMENTS = new Map<unknown, WeakSet<object>>();

function sameNormalizedValue(a: unknown, b: unknown): boolean {
 if (Object.is(a, b)) return true;
 if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
 const keys = Object.keys(a), other = Object.keys(b);
 if (keys.length !== other.length) return false;
 for (let i = 0; i < keys.length; i += 1) {
  countWork('validation:frozen-element-compare-property');
  const key = keys[i]!;
  if (key !== other[i] || !sameNormalizedValue((a as JsonRecord)[key], (b as JsonRecord)[key])) return false;
 }
 return true;
}


export function parseArray<T>(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
	parser: (value: unknown, path: string, issues: LayoutDocumentIssue[]) => ParsedValue<T>
): T[] | undefined {
	if (!Array.isArray(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an array');
		return undefined;
	}
	let proven = NORMALIZED_FROZEN_ELEMENTS.get(parser);
	if (!proven) { proven = new WeakSet(); NORMALIZED_FROZEN_ELEMENTS.set(parser, proven); }
	const values = input.map((value, index) => {
		countWork('validation:layout-array-entry');
		const immutable = value !== null && typeof value === 'object' && hasImmutableJsonProof(value);
		if (immutable && proven.has(value)) { countWork('validation:frozen-element-hit'); return value as T; }
		const before = issues.length, parsed = parser(value, `${path}[${index}]`, issues);
		if (immutable && parsed !== undefined && issues.length === before && sameNormalizedValue(value, parsed)) {
			proven.add(value); countWork('validation:frozen-element-shared'); return value as T;
		}
		return parsed;
	});
	return values.every((value): value is T => value !== undefined) ? values : undefined;
}


export function readRecord(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): JsonRecord | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an object');
		return undefined;
	}
	return input;
}


export function isRecord(input: unknown): input is JsonRecord {
	return typeof input === 'object' && input !== null && !Array.isArray(input);
}


export function assertAllowedKeys(
	record: JsonRecord,
	allowedKeys: readonly string[],
	path: string,
	issues: LayoutDocumentIssue[]
): void {
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(record)) {
		countWork('validation:layout-field-key');
		if (!allowed.has(key)) {
			addIssue(issues, `${path}.${key}`, 'unknown_key', `Unknown key '${key}'`);
		}
	}
}


export function readString(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): string | undefined {
	if (typeof input !== 'string') {
		addIssue(issues, path, 'invalid_type', 'Expected a string');
		return undefined;
	}
	return input;
}


export function readNonEmptyString(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): string | undefined {
	const value = readString(input, path, issues);
	if (value !== undefined && value.trim().length === 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a non-empty string');
		return undefined;
	}
	return value;
}


export function readId(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): string | undefined {
	const value = readString(input, path, issues);
	if (value !== undefined && !ID_PATTERN.test(value)) {
		addIssue(issues, path, 'invalid_id', 'Expected an ID matching /^[A-Za-z0-9][A-Za-z0-9._:-]*$/');
		return undefined;
	}
	return value;
}


export function readNumber(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	if (typeof input !== 'number' || !Number.isFinite(input)) {
		addIssue(issues, path, 'invalid_number', 'Expected a finite number');
		return undefined;
	}
	return input;
}


/** The ledger cursor is a non-negative integer (allocation index). */
export function readNonNegativeInteger(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	if (typeof input !== 'number' || !Number.isInteger(input) || input < 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a non-negative integer');
		return undefined;
	}
	return input;
}


export function readPositiveNumber(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	const value = readNumber(input, path, issues);
	if (value !== undefined && value <= 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a number greater than zero');
		return undefined;
	}
	return value;
}


export function readNonNegativeNumber(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	const value = readNumber(input, path, issues);
	if (value !== undefined && value < 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a number greater than or equal to zero');
		return undefined;
	}
	return value;
}


export function readVec2(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): LayoutVec2 | undefined {
	if (!Array.isArray(input) || input.length !== 2) {
		addIssue(issues, path, 'invalid_type', 'Expected a 2-number vector');
		return undefined;
	}
	const x = readNumber(input[0], `${path}[0]`, issues);
	const y = readNumber(input[1], `${path}[1]`, issues);
	return x === undefined || y === undefined ? undefined : [x, y];
}


export function readVec3(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): [number, number, number] | undefined {
	if (!Array.isArray(input) || input.length !== 3) {
		addIssue(issues, path, 'invalid_type', 'Expected a 3-number vector');
		return undefined;
	}
	const x = readNumber(input[0], `${path}[0]`, issues);
	const y = readNumber(input[1], `${path}[1]`, issues);
	const z = readNumber(input[2], `${path}[2]`, issues);
	return x === undefined || y === undefined || z === undefined ? undefined : [x, y, z];
}


export function readPositiveVec3(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): [number, number, number] | undefined {
	const vector = readVec3(input, path, issues);
	if (!vector) return undefined;
	if (vector.some((value) => value <= 0)) {
		addIssue(issues, path, 'invalid_value', 'Expected every dimension to be greater than zero');
		return undefined;
	}
	return vector;
}


export function readEnum<T extends string>(
	input: unknown,
	path: string,
	values: readonly T[],
	issues: LayoutDocumentIssue[]
): T | undefined {
	const value = readString(input, path, issues);
	if (value === undefined) return undefined;
	if (!values.includes(value as T)) {
		addIssue(issues, path, 'unsupported_value', `Expected one of: ${values.join(', ')}`);
		return undefined;
	}
	return value as T;
}


export function validateUniqueIds<T>(
	values: T[],
	path: string,
	issues: LayoutDocumentIssue[],
	getId: (value: T) => string
): void {
	const seen = new Set<string>();
	for (const [index, value] of values.entries()) {
		countWork('validation:layout-unique-id-entry');
		const id = getId(value);
		if (seen.has(id)) {
			addIssue(issues, `${path}[${index}].id`, 'duplicate_id', `Duplicate ID '${id}'`);
		}
		seen.add(id);
	}
}


export function addIssue(
	issues: LayoutDocumentIssue[],
	path: string,
	code: string,
	message: string
): void {
	issues.push({ path, code, message });
}


export function invalidJsonMessage(error: unknown, json: string): string {
	const message = error instanceof Error ? error.message : 'Invalid JSON';
	const match = /position (\d+)/.exec(message);
	if (!match) return 'Invalid JSON';
	const offset = Number(match[1]);
	const before = json.slice(0, offset);
	const line = before.split('\n').length;
	const column = offset - before.lastIndexOf('\n');
	return `Invalid JSON near line ${line}, column ${column}.`;
}
