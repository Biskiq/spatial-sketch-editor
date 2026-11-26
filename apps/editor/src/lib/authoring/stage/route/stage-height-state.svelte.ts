import type { StageHeightSheet, StageHeightTick } from '../stage-height-sheet';

export type StageHeightStatePorts = {
	readonly sheet: StageHeightSheet;
	readonly lensWorld: () => boolean;
	readonly reducedMotion: () => boolean;
};

export function createStageHeightState(ports: StageHeightStatePorts) {
	let heightMeters = $state(ports.sheet.height());
	let heightTicks = $state<readonly StageHeightTick[]>([]);
	let heightPins = $state<readonly number[]>(ports.sheet.pins());
	let heightSheetSide = $state<'left' | 'right'>('right');
	let heightPlaneVisible = $state(false);
	let heightPlaneTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		heightMeters = ports.sheet.height();
		heightPins = ports.sheet.pins();
		const unsubscribeHeight = ports.sheet.subscribe('route-height-sheet', (height) => {
			heightMeters = height;
		});
		const unsubscribePins = ports.sheet.subscribePins('route-height-sheet-pins', (pins) => {
			heightPins = pins;
		});
		return () => {
			unsubscribeHeight();
			unsubscribePins();
		};
	});

	$effect(() => () => {
		if (heightPlaneTimer !== null) clearTimeout(heightPlaneTimer);
	});

	$effect(() => {
		// A lens switch can happen after the Sheet already went inactive (for
		// example focus moved to the lens button first), so cancel any live tail
		// on the lens change itself rather than relying on the unmount callback.
		if (ports.lensWorld()) return;
		cancelPlane();
	});

	function cancelPlane(): void {
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
		heightPlaneVisible = false;
	}

	function setTicks(next: readonly StageHeightTick[]): void {
		heightTicks = next;
	}

	function setSide(value: 'left' | 'right'): void {
		heightSheetSide = value;
	}

	function setHeight(heightMetersValue: number, cause: 'drag' | 'key' | 'tick'): void {
		ports.sheet.set(heightMetersValue, cause);
		heightMeters = ports.sheet.height();
	}

	/** Session-only pin creation; pin removal is intentionally unexposed. */
	function addPin(): void {
		ports.sheet.addPin(heightMeters);
		heightPins = ports.sheet.pins();
	}

	function setPlaneActive(active: boolean): void {
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
		// The Sheet is World-lens chrome. Its teardown on a lens switch is not a
		// pointer release: do not leave a tail running behind the Experience lens.
		if (!ports.lensWorld()) {
			heightPlaneVisible = false;
			return;
		}
		if (active) {
			heightPlaneVisible = true;
			return;
		}
		if (ports.reducedMotion()) {
			heightPlaneVisible = false;
			return;
		}
		heightPlaneTimer = setTimeout(() => {
			heightPlaneVisible = false;
			heightPlaneTimer = null;
		}, 1000);
	}

	return {
		get meters() {
			return heightMeters;
		},
		get ticks() {
			return heightTicks;
		},
		get pins() {
			return heightPins;
		},
		get side() {
			return heightSheetSide;
		},
		get planeVisible() {
			return heightPlaneVisible;
		},
		setTicks,
		setSide,
		setHeight,
		addPin,
		setPlaneActive,
		cancelPlane,
	};
}
