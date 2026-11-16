/**
 * The one live Slice reading.
 *
 * Temporary **session** state, not a document: one reading at a time, replaced when
 * the creator arms Slice again, ended by Put back, Escape, a replaced project, a
 * route teardown or the lens leaving World. It survives tool changes, selection,
 * Plan ↔ 3D, a Preview round trip, Lift and Undo/Redo — because none of those are
 * the reading's owner.
 *
 * It is never serialized, creates no history entry and is never read by visitor or
 * release code: the module lives under `authoring/`, which the visitor boundary tests
 * already exclude, and it exports no writer other than the store.
 *
 * **SL1 only.** A reading is `{ kind: 'level', depth }`; SL2 replaces it with a drawn
 * arm through `set`, and nothing here knows what a drawn cut is.
 */
import type { LevelDepth, SliceReading } from './slice-cut';

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

	/** Narrow or widen the live Level reading's depth. A no-op when Slice is off. */
	setDepth(depth: LevelDepth): void {
		const reading = this.#reading;
		if (reading === null) return;
		this.#reading = { ...reading, depth };
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
