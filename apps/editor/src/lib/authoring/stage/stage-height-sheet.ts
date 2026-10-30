/**
 * R217.S06 — the Height Sheet's one height fact.
 *
 * The Sheet is **host-owned session view state**, never source: a height, its
 * pins and the subscribers a consumer registers. It imports no consumer and no
 * domain: Layout, Scene and a future Slice each publish a tick or subscribe to
 * the fact through their own role, and the host only merges and announces it.
 *
 * The height is metres above the level datum. It resets on a project
 * replacement, is never serialized, creates no F4 entry and can never make the
 * project dirty. A later Slice registers another role here without changing who
 * owns the height.
 */
import { PLAN_DEFAULT_CUT_HEIGHT_METERS } from './plan-parameters';

/** Two declared surfaces closer than this are one tick, not a stack. */
export const HEIGHT_TICK_MERGE_TOLERANCE_METERS = 0.005;

/** One height a consumer can snap to: the floor datum or a found surface. */
export type StageHeightTick = {
	readonly kind: 'datum' | 'found';
	readonly heightMeters: number;
	readonly label: string;
};

/** What moved the height, for the control's own presentation. */
export type StageHeightCause = 'drag' | 'key' | 'tick';

type HeightListener = {
	readonly role: string;
	readonly onHeight: (heightMeters: number) => void;
};

type PinListener = {
	readonly role: string;
	readonly onPins: (pins: readonly number[]) => void;
};

export type StageHeightSheet = {
	/** Metres above the floor datum. */
	height(): number;
	/** Set the height; a non-finite value is ignored and a negative one clamps to the datum. */
	set(heightMeters: number, cause: StageHeightCause): void;
	/** Session pins, ascending. Never project source and never persisted. */
	pins(): readonly number[];
	addPin(heightMeters: number): void;
	removePin(heightMeters: number): void;
	/** The inclusive upper bound of the height fact. */
	maxHeightMeters(): number;
	/**
	 * Update the bound when the known surfaces change. The current height is not
	 * moved by a bound change: only a creator action or a replacement moves it.
	 */
	setMaxHeightMeters(heightMeters: number): void;
	/**
	 * Register one consumer by its own role. The role is diagnostics, not a
	 * filter: every subscriber receives every height change.
	 */
	subscribe(role: string, onHeight: (heightMeters: number) => void): () => void;
	/**
	 * Register a pin consumer. Pins change without a height change (a reset can
	 * clear them at the same height), so the chrome cannot derive them from the
	 * height notification alone.
	 */
	subscribePins(role: string, onPins: (pins: readonly number[]) => void): () => void;
	/** A project replacement's reset: datum height, no pins, same subscription. */
	reset(): void;
};

function finiteNonNegative(value: number): boolean {
	return Number.isFinite(value) && value >= 0;
}

function sameHeight(a: number, b: number): boolean {
	return Math.abs(a - b) <= HEIGHT_TICK_MERGE_TOLERANCE_METERS;
}

/**
 * One height fact per session.
 *
 * A subscriber that throws is skipped, exactly as an adapter contributor is
 * elsewhere in the host: the Sheet is read by the Stage's own plan consumer and
 * a UI, and one broken consumer must not stop the others from seeing the height.
 */
export function createStageHeightSheet(
	options: { readonly defaultHeightMeters?: number; readonly maxHeightMeters?: number } = {}
): StageHeightSheet {
	const initial =
		options.defaultHeightMeters !== undefined && finiteNonNegative(options.defaultHeightMeters)
			? options.defaultHeightMeters
			: PLAN_DEFAULT_CUT_HEIGHT_METERS;
	let maximum =
		options.maxHeightMeters !== undefined && !Number.isNaN(options.maxHeightMeters)
			? Math.max(0, options.maxHeightMeters)
			: Number.POSITIVE_INFINITY;
	let heightValue = Math.min(initial, maximum);
	let pinsValue: number[] = [];
	const listeners: HeightListener[] = [];
	const pinListeners: PinListener[] = [];

	function clamp(value: number): number {
		return Math.min(maximum, Math.max(0, value));
	}

	function notify(previous: number): void {
		if (heightValue === previous) return;
		for (const listener of [...listeners]) {
			try {
				listener.onHeight(heightValue);
			} catch {
				// One consumer's failure must not strand the others.
			}
		}
	}

	function notifyPins(): void {
		const pins = [...pinsValue];
		for (const listener of [...pinListeners]) {
			try {
				listener.onPins(pins);
			} catch {
				// One consumer's failure must not strand the others.
			}
		}
	}

	return {
		height: () => heightValue,
		set(value, _cause) {
			if (!Number.isFinite(value)) return;
			const previous = heightValue;
			heightValue = clamp(value);
			notify(previous);
		},
		pins: () => [...pinsValue],
		addPin(value) {
			if (!finiteNonNegative(value)) return;
			if (pinsValue.some((pin) => sameHeight(pin, value))) return;
			pinsValue = [...pinsValue, value].sort((a, b) => a - b);
			notifyPins();
		},
		removePin(value) {
			if (!Number.isFinite(value)) return;
			const next = pinsValue.filter((pin) => !sameHeight(pin, value));
			if (next.length === pinsValue.length) return;
			pinsValue = next;
			notifyPins();
		},
		maxHeightMeters: () => maximum,
		setMaxHeightMeters(value) {
			if (Number.isNaN(value) || value < 0) return;
			maximum = value;
		},
		subscribe(role, onHeight) {
			const listener: HeightListener = { role, onHeight };
			listeners.push(listener);
			return () => {
				const index = listeners.indexOf(listener);
				if (index >= 0) listeners.splice(index, 1);
			};
		},
		subscribePins(role, onPins) {
			const listener: PinListener = { role, onPins };
			pinListeners.push(listener);
			return () => {
				const index = pinListeners.indexOf(listener);
				if (index >= 0) pinListeners.splice(index, 1);
			};
		},
		reset() {
			const previous = heightValue;
			heightValue = Math.min(initial, maximum);
			pinsValue = [];
			notify(previous);
			notifyPins();
		}
	};
}

/**
 * Merge owner-declared ticks into one ordered set.
 *
 * The host computes no surface: it sorts, keeps exactly one floor datum and
 * merges declared heights within 5 mm. A datum wins its group so a Layout floor
 * and a Scene floor bound can never both present a `found` tick at the same
 * height. Labels stay the owner's own words.
 */
export function mergeStageHeightTicks(
	ticks: readonly StageHeightTick[]
): readonly StageHeightTick[] {
	const usable = ticks.filter(
		(tick) => finiteNonNegative(tick.heightMeters) && tick.label.length > 0
	);
	const sorted = [...usable].sort((a, b) => {
		if (a.heightMeters !== b.heightMeters) return a.heightMeters - b.heightMeters;
		if (a.kind !== b.kind) return a.kind === 'datum' ? -1 : 1;
		return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
	});
	const merged: StageHeightTick[] = [];
	let group: StageHeightTick[] = [];
	const flush = (): void => {
		if (group.length === 0) return;
		const datum =
			group.find((tick) => tick.kind === 'datum' && tick.heightMeters === 0) ??
			group.find((tick) => tick.kind === 'datum');
		const label = datum?.label ?? group.reduce((best, tick) => (tick.label < best ? tick.label : best), group[0]!.label);
		merged.push({
			kind: datum === undefined ? 'found' : 'datum',
			heightMeters: datum?.heightMeters ?? group[0]!.heightMeters,
			label
		});
		group = [];
	};
	for (const tick of sorted) {
		if (group.length > 0 && !sameHeight(tick.heightMeters, group[0]!.heightMeters)) flush();
		group.push(tick);
	}
	flush();
	return merged;
}
