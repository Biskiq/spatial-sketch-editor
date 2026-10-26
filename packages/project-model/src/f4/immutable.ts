import { countWork } from '@portfolio/layout-core';
import { hasOwnedFrozenJsonProof, rememberOwnedFrozenJson } from '../json-immutability';

// A private proof of capture, not Object.isFrozen (which is only shallow).
// Only plain JSON graphs produced by this boundary qualify. In particular a
// frozen Map/Date/typed array is never treated as an immutable captured graph.


/** Capture owned data before it can cross an async boundary or be published. */
export function immutableF4Data<T>(input: T): T {
	if (input !== null && typeof input === 'object' && hasOwnedFrozenJsonProof(input)) {
		countWork('f4:captured-root-reused');
		return input;
	}
	countWork('f4:clone');
	// Existing captured subgraphs already belong to this boundary and cannot
	// change. Preserve them while detaching every new plain-data container.
	// Accessors/exotic objects keep native structuredClone semantics, including
	// aliases; the preflight never invokes an accessor before falling back.
	const captured = canShareCapturedJson(input, new WeakSet())
		? cloneJson(input, new WeakMap())
		: structuredClone(input);
	freezeCaptured(captured);
	return captured;
}

function isPlain(input: object): boolean {
	const prototype = Object.getPrototypeOf(input);
	return Array.isArray(input) || prototype === Object.prototype || prototype === null;
}

function canShareCapturedJson(input: unknown, seen: WeakSet<object>): boolean {
	if (input === null || typeof input !== 'object') return typeof input !== 'function' && typeof input !== 'symbol';
	if (hasOwnedFrozenJsonProof(input) || seen.has(input)) return true;
	if (!isPlain(input)) return false;
	seen.add(input);
	for (const key of Object.keys(input)) {
		countWork('f4:capture-preflight-property');
		const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
		if (!('value' in descriptor) || !canShareCapturedJson(descriptor.value, seen)) return false;
	}
	return true;
}

function cloneJson<T>(input: T, seen: WeakMap<object, unknown>): T {
	if (input === null || typeof input !== 'object') return input;
	if (hasOwnedFrozenJsonProof(input)) { countWork('f4:captured-subgraph-reused'); return input; }
	const previous = seen.get(input);
	if (previous) return previous as T;
	const clone: Record<string, unknown> | unknown[] = Array.isArray(input) ? new Array(input.length) : {};
	seen.set(input, clone);
	for (const key of Object.keys(input)) {
		Object.defineProperty(clone, key, { value: cloneJson((input as Record<string, unknown>)[key], seen), enumerable: true, configurable: true, writable: true });
	}
	return clone as T;
}

function freezeCaptured(input: unknown): boolean {
	if (input === null || typeof input !== 'object') return true;
	if (hasOwnedFrozenJsonProof(input)) return true;
	countWork('f4:clone-object');
	countWork('f4:freeze-object');
	const values = Object.values(input);
	countWork('f4:clone-property-slots', values.length);
	let plain = isPlain(input);
	for (const value of values) if (!freezeCaptured(value)) plain = false;
	Object.freeze(input);
	if (plain) rememberOwnedFrozenJson(input);
	return plain;
}

/** Freeze data already owned by this boundary. Never freezes caller-owned data. */
export function freezeF4Data<T>(input: T): T {
	if (input !== null && typeof input === 'object' && !Object.isFrozen(input)) {
		countWork('f4:freeze-object');
		const values = Object.values(input);
		countWork('f4:freeze-property-slots', values.length);
		for (const value of values) freezeF4Data(value);
		Object.freeze(input);
		// Only data properties whose object children have this private proof may
		// become shared capture inputs. A shallow external freeze proves nothing.
		if (isPlain(input) && values.every((value) => value === null || typeof value !== 'object' || hasOwnedFrozenJsonProof(value)) &&
			Object.keys(input).every((key) => 'value' in Object.getOwnPropertyDescriptor(input, key)!)) rememberOwnedFrozenJson(input);
	}
	return input;
}
