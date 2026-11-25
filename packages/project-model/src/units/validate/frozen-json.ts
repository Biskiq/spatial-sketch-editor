import { hasImmutableJsonProof as hasOwnedFrozenJsonProof, rememberImmutableJsonNode as rememberOwnedFrozenJson, countWork } from '@portfolio/layout-core/kernel';
import { type ShapeValidation } from '../../strict-shape';
import { type UnitPayload } from '../types';

export type PayloadReader = (input: unknown) => ShapeValidation<UnitPayload>;

export const DEEPLY_FROZEN_PLAIN_JSON = new WeakSet<object>();

/**
 * Returns true if and only if `value` is deeply frozen plain JSON (plain Object
 * or Array with no getters/setters/symbols/prototype modifications).
 * Verified objects are remembered in `DEEPLY_FROZEN_PLAIN_JSON` for O(1) checks.
 */
export function isDeeplyFrozenPlainJson(value: unknown): value is object {
	if (typeof value !== 'object' || value === null) return false;
	if (DEEPLY_FROZEN_PLAIN_JSON.has(value) || hasOwnedFrozenJsonProof(value)) return true;
	if (!Object.isFrozen(value)) return false;

	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
		return false;
	}

	const descriptors = Object.getOwnPropertyDescriptors(value);
	for (const key of Object.keys(descriptors)) {
		countWork('validation:frozen-property-check');
		const desc = descriptors[key]!;
		if (desc.get !== undefined || desc.set !== undefined) return false;
		const val = desc.value;
		if (typeof val === 'object' && val !== null) {
			if (!isDeeplyFrozenPlainJson(val)) return false;
		}
	}

	DEEPLY_FROZEN_PLAIN_JSON.add(value);
	return true;
}

/**
 * Recursively freezes plain JSON object trees and marks each in `DEEPLY_FROZEN_PLAIN_JSON`.
 */
export function freezePlainJsonSubgraph<T>(value: T): T {
	if (typeof value !== 'object' || value === null) return value;
	if (DEEPLY_FROZEN_PLAIN_JSON.has(value as object)) return value;
	const obj = value as Record<string, unknown>;
	for (const key of Object.keys(obj)) {
		countWork('validation:freeze-property');
		const child = obj[key];
		if (typeof child === 'object' && child !== null) {
			freezePlainJsonSubgraph(child);
		}
	}
	if (!Object.isFrozen(obj)) {
		Object.freeze(obj);
	}
	DEEPLY_FROZEN_PLAIN_JSON.add(obj);
	rememberOwnedFrozenJson(obj);
	return value;
}
