import { countWork } from './p2311-perf';
/** Runtime-only proof of deeply immutable plain JSON, shared by parse/capture and generated-source readers. No source
 * identity, revision, admission verdict or serialized field is represented here. */
const IMMUTABLE_JSON = new WeakSet<object>();
export function hasImmutableJsonProof(value: object): boolean { return IMMUTABLE_JSON.has(value); }
/** Called after an owning boundary freezes its children, bottom up. A shallow
 * freeze, accessor or exotic object can never mint this proof. */
export function rememberImmutableJsonNode(value: object): boolean {
	if (IMMUTABLE_JSON.has(value)) return true;
	if (!Object.isFrozen(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	const keys = Reflect.ownKeys(value);
	if (Array.isArray(value) && prototype !== Array.prototype) return false;
	if (Array.isArray(value) && (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length')) return false;
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
	for (const key of keys) {
		countWork('immutability:property-proof-test');
		if (typeof key !== 'string') return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
		if (!descriptor.enumerable && !(Array.isArray(value) && key === 'length')) return false;
		if (!('value' in descriptor)) return false;
		const child = descriptor.value;
		if (typeof child === 'function' || typeof child === 'symbol' || typeof child === 'bigint') return false;
		if (child !== null && typeof child === 'object' && !IMMUTABLE_JSON.has(child)) return false;
	}
	IMMUTABLE_JSON.add(value); return true;
}
