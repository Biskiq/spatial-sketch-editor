/**
 * The one live **Slice** reading.
 *
 * Slice is session state: the creator arms it, moves it with the Height Sheet,
 * and puts it back. It is never authored, never saved, never a history entry,
 * never seen by Preview or a release, and Undo never touches it. One reading
 * exists at a time: `set` replaces whatever was live.
 *
 * The store holds **only** the typed reading. Where the cut is comes from the
 * Height Sheet (`resolveSlice`), what it means is Layout's, and how it is drawn
 * belongs to the Stage shell.
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

	/** Start a reading, or replace the live one (one Slice at a time). */
	set(reading: SliceReading): void {
		this.#reading = reading;
	}

	/** Start the Level arm at `depth`, replacing any live reading. */
	level(depth: LevelDepth): void {
		this.#reading = { kind: 'level', depth };
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
