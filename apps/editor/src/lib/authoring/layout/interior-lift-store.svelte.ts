/**
 * The one live **Lift** reading.
 *
 * Lift is temporary reading state, not a document: the creator lifts the
 * overheads of one Space (or of everything) to see and work inside, and Put back,
 * Escape, a replaced project or leaving the route ends it. It is never authored,
 * never saved, never a history entry, and never seen by Preview or a release. It
 * never moves the Camera and never changes a light or a shadow.
 *
 * The store holds **only** the scope. Which overheads that scope names is Layout's
 * question (`overheadSourcesOf`), and how a lifted overhead is drawn is the
 * representation's: this module is the shell's half of the split, and nothing
 * here knows what a Room lid is.
 */
import {
	overheadSourcesOf,
	pointInPolygon,
	type CompiledLayoutGeometry,
	type OverheadScope,
	type OverheadSource
} from '@portfolio/layout-core';

export type LiftScope = OverheadScope;

export type LiftReading = { readonly scope: LiftScope };

class InteriorLiftStore {
	#reading = $state<LiftReading | null>(null);

	get reading(): LiftReading | null {
		return this.#reading;
	}

	isActive(): boolean {
		return this.#reading !== null;
	}

	/** Start a Lift reading, or replace the scope of the live one. */
	lift(scope: LiftScope): void {
		this.#reading = { scope };
	}

	/** Narrow or widen the live reading. A no-op when Lift is not on. */
	setScope(scope: LiftScope): void {
		if (this.#reading === null) return;
		this.#reading = { scope };
	}

	/** Put back: end the reading. Named for the control the creator presses. */
	putBack(): void {
		this.#reading = null;
	}

	/** End the reading without a control: a replaced project, or a teardown. */
	clear(): void {
		this.#reading = null;
	}
}

export const interiorLift = new InteriorLiftStore();

/**
 * The overheads the live reading lifts, as Layout names them, or none.
 *
 * The compiled geometry is the caller's: the pick provider holds the snapshot it
 * is picking against, so this function never keeps a second reference to world
 * state that could drift from the document on screen.
 */
export function liftedSourcesNow(compiled: CompiledLayoutGeometry): readonly OverheadSource[] {
	const reading = interiorLift.reading;
	return reading === null ? [] : overheadSourcesOf(compiled, reading.scope);
}

/**
 * The scope a Lift starts with, frozen at entry.
 *
 * The selected Room wins; otherwise, in 3D only, the Room the eye is **occupied**
 * by — its plan polygon contains the eye's XZ and the eye is between its floor and
 * its ceiling. A tie breaks on the smallest Room id so the answer is deterministic.
 * Everything else lifts everything. Later Camera movement never changes it: the
 * scope is the creator's stated one, not a tracker.
 */
export function initialLiftScope(input: {
	readonly selectedRoomId: string | null;
	readonly reading: '3d' | 'plan';
	readonly eye: readonly [number, number, number] | null;
	readonly compiled: CompiledLayoutGeometry;
}): LiftScope {
	if (input.selectedRoomId !== null) return { kind: 'space', roomId: input.selectedRoomId };
	const eye = input.reading === '3d' ? input.eye : null;
	if (eye === null) return { kind: 'all' };
	const point: [number, number] = [eye[0], eye[2]];
	let occupied: string | null = null;
	for (const room of input.compiled.rooms) {
		if (!(room.floorElevation <= eye[1] && eye[1] <= room.ceilingElevation)) continue;
		if (!pointInPolygon(point, room.floorPolygon)) continue;
		if (occupied === null || room.roomId < occupied) occupied = room.roomId;
	}
	return occupied === null ? { kind: 'all' } : { kind: 'space', roomId: occupied };
}
