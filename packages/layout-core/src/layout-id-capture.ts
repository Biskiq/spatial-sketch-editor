/**
 * T1.P02.S01 §1 — captured, non-reusing Layout identity.
 *
 * Every Layout identity an accepted operation can create today is **captured
 * before evaluation**: the operation carries one fresh opaque nonce as an
 * explicit intent input, and every allocator it reaches derives its id from that nonce
 * plus its own existing seed. The document's occupancy is never an allocation
 * source: it is only the refusal check that a captured id is unused.
 *
 * Consequences this module exists to make structural:
 *
 * - a replayed operation (Redo) derives exactly the ids it captured;
 * - a new edit after Undo carries a new nonce, so it cannot recycle an identity
 *   from the undone branch;
 * - reload needs no cursor, because nothing is derived from document occupancy;
 * - a byte-identical recreation still receives a new id, because its nonce is
 *   new.
 *
 * The nonce is minted outside the undoable document (the editor mints it when it
 * builds the intent). Planning only reads it, which is what keeps planning
 * deterministic and replayable.
 *
 * Pure module: no DOM, no Svelte, no renderer. `mintLayoutIdCapture` is the one
 * impure helper and it is deliberately a separate, explicit call.
 */

/** Captured-input name that carries the operation's identity nonce. */
export const LAYOUT_ID_NONCE_INPUT = 'layout-id-nonce';

/** Captured-input name that carries the planner's working level (`floor.id`). */
export const LAYOUT_WORKING_LEVEL_INPUT = 'layout-working-level';

/**
 * One operation's captured identity. The nonce is opaque: nothing may parse
 * ordering, time or subject out of it.
 */
export type LayoutIdCapture = { readonly nonce: string };

/** A structural captured input, kept local so this module has no F4 dependency. */
export type LayoutCapturedInput = { readonly name: string; readonly value: unknown };

/**
 * The nonce is opaque but must be safe inside a canonical Layout id: it follows
 * the codec's id charset and starts alphanumeric. Eight characters is the floor
 * that makes accidental reuse implausible without making tests unreadable.
 */
const NONCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

/** The canonical-id charset a derived id must satisfy. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** Throw when a captured id is already present in the document. */
export class LayoutIdCollisionError extends Error {
	readonly code = 'captured_id_in_use';
	readonly id: string;

	constructor(id: string) {
		super(`Captured Layout id '${id}' is already in use; capture a fresh identity for this operation`);
		this.name = 'LayoutIdCollisionError';
		this.id = id;
	}
}

/**
 * Mint one fresh capture. The caller (the editor's intent builder) owns this
 * step, so planning itself never mints: a refused operation must waste no
 * identity, and the same intent must replay to the same ids.
 */
export function mintLayoutIdCapture(
	mint: () => string = () => globalThis.crypto.randomUUID()
): LayoutIdCapture {
	const nonce = mint();
	if (!NONCE_PATTERN.test(nonce)) {
		throw new RangeError(`Layout identity nonces must be opaque ids, received '${nonce}'`);
	}
	return { nonce };
}

export function isLayoutIdCapture(value: unknown): value is LayoutIdCapture {
	if (value === null || typeof value !== 'object') return false;
	const nonce = (value as { nonce?: unknown }).nonce;
	return typeof nonce === 'string' && NONCE_PATTERN.test(nonce);
}

/**
 * Derive one Layout id from a capture and the allocator's existing seed.
 *
 * The seed is the allocator's own naming rule (`wall-chain-1`, `room.<face>`,
 * `layout-object-1`, …); the nonce makes the result unique to this captured
 * operation. There is no counter and no occupancy suffix.
 */
export function layoutCapturedId(capture: LayoutIdCapture, seed: string): string {
	if (!isLayoutIdCapture(capture)) {
		throw new RangeError('Layout identity derivation requires a captured nonce');
	}
	const id = `${seed}.${capture.nonce}`;
	if (!ID_PATTERN.test(id)) {
		throw new RangeError(`Derived Layout id '${id}' is not a canonical id`);
	}
	return id;
}

/** Occupancy is only a refusal: a derived id that already exists fails closed. */
export function assertCapturedIdUnused(taken: ReadonlySet<string>, id: string): string {
	if (taken.has(id)) throw new LayoutIdCollisionError(id);
	return id;
}

/** Derive and refuse in one step. Never falls back to a suffix. */
export function allocateCapturedId(
	taken: ReadonlySet<string>,
	seed: string,
	capture: LayoutIdCapture
): string {
	return assertCapturedIdUnused(taken, layoutCapturedId(capture, seed));
}

/** The captured input an intent carries for one capture. */
export function layoutIdCaptureInput(
	capture: LayoutIdCapture
): { readonly name: typeof LAYOUT_ID_NONCE_INPUT; readonly value: string } {
	if (!isLayoutIdCapture(capture)) {
		throw new RangeError('A Layout identity capture must carry a valid nonce');
	}
	return { name: LAYOUT_ID_NONCE_INPUT, value: capture.nonce };
}

/** Read the operation's capture from its explicit intent inputs. */
export function readLayoutIdCapture(
	inputs: readonly LayoutCapturedInput[]
): LayoutIdCapture | null {
	const entry = inputs.find((input) => input.name === LAYOUT_ID_NONCE_INPUT);
	return entry !== undefined && typeof entry.value === 'string' && NONCE_PATTERN.test(entry.value)
		? { nonce: entry.value }
		: null;
}

/** The captured working-level input a planner requires. */
export function layoutWorkingLevelInput(
	levelId: string
): { readonly name: typeof LAYOUT_WORKING_LEVEL_INPUT; readonly value: string } {
	if (typeof levelId !== 'string' || levelId.length === 0) {
		throw new RangeError('A Layout working level must be a non-empty id');
	}
	return { name: LAYOUT_WORKING_LEVEL_INPUT, value: levelId };
}

/** Read the planner's working level from its explicit intent inputs. */
export function readLayoutWorkingLevel(
	inputs: readonly LayoutCapturedInput[]
): string | null {
	const entry = inputs.find((input) => input.name === LAYOUT_WORKING_LEVEL_INPUT);
	return entry !== undefined && typeof entry.value === 'string' && entry.value.length > 0
		? entry.value
		: null;
}
