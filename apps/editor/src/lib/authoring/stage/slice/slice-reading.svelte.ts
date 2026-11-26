/**
 * The one live Slice reading.
 *
 * Temporary **session** state, not a document: one reading at a time, replaced when
 * the creator arms Slice again or draws a second segment, ended by Put back, Escape,
 * a replaced project, a route teardown or the lens leaving World. It survives tool
 * changes, selection, Plan ↔ 3D, a Preview round trip, Lift and Undo/Redo — because
 * none of those are the reading's owner.
 *
 * It is never serialized, creates no history entry and is never read by visitor or
 * release code: the module lives under `authoring/`, which the visitor boundary tests
 * already exclude, and it exports no writer other than the store.
 *
 * **SL2** adds the drawn arm. `drawn` replaces any live reading, exactly as a new
 * Level does; endpoint/line/depth edits update that reading in place.
 */
import type { LevelDepth, SliceDrawnSide, SliceReading, SliceVec2 } from './slice-cut';

class SliceReadingStore {
	#reading = $state<SliceReading | null>(null);

	get reading(): SliceReading | null {
		return this.#reading;
	}

	isActive(): boolean {
		return this.#reading !== null;
	}

	/** Replace any live reading: there is one Slice at a time. */
	set(reading: SliceReading): void {
		this.#reading = reading;
	}

	/** Arm Level: no reading becomes To the floor; an existing one is replaced. */
	level(depth: LevelDepth = { kind: 'to-floor' }): void {
		this.#reading = { kind: 'level', depth };
	}

	/** Place or replace the one drawn reading. */
	drawn(input: {
		readonly start: SliceVec2;
		readonly end: SliceVec2;
		readonly hidden: SliceDrawnSide;
		readonly depthMeters: number;
	}): void {
		this.#reading = { kind: 'drawn', ...input };
	}

	/** Narrow or widen the live Level reading's depth. A no-op when not Level. */
	setDepth(depth: LevelDepth): void {
		const reading = this.#reading;
		if (reading === null || reading.kind !== 'level') return;
		this.#reading = { ...reading, depth };
	}

	/** Reverse which side of the one drawn segment is removed. A no-op otherwise. */
	flipDrawn(): void {
		const reading = this.#reading;
		if (reading === null || reading.kind !== 'drawn') return;
		this.#reading = {
			...reading,
			hidden: reading.hidden === 'left' ? 'right' : 'left',
		};
	}

	/** Move the drawn depth ray. A no-op when not drawn. */
	setDrawnDepth(depthMeters: number): void {
		const reading = this.#reading;
		if (reading === null || reading.kind !== 'drawn' || !Number.isFinite(depthMeters)) return;
		this.#reading = { ...reading, depthMeters };
	}

	/** Move/resize the one drawn segment without changing its side or depth. */
	setDrawnSegment(input: { readonly start: SliceVec2; readonly end: SliceVec2 }): void {
		const reading = this.#reading;
		if (reading === null || reading.kind !== 'drawn') return;
		if (![input.start[0], input.start[1], input.end[0], input.end[1]].every(Number.isFinite))
			return;
		this.#reading = { ...reading, start: input.start, end: input.end };
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

export const sliceReading = new SliceReadingStore();
