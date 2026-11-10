/**
 * C3 checkpoint 5 — the one live unfold context, as a session store.
 *
 * Runes make the Card scrubber, the Stage sheet and the adapter actions read
 * the same state. Entry preserves the Camera's orientation and may perform one
 * bounded fit; peeling, face changes and edits never write the Camera. Put back
 * asks for the exact entry pose only when entry adjusted the Camera and the
 * creator has not navigated since. Session state survives an accepted edit's
 * adapter rebind; it is cleared only by Put back, subject removal or a replaced
 * document.
 */
import type { CompiledPhysicalWall } from '@portfolio/layout-core';
import type { InspectionPose, ViewportReading } from '@portfolio/camera-core';

import {
	createWallUnfoldState,
	flipWallUnfoldSide,
	isStraightCompiledWall,
	refoldWallUnfold,
	setWallUnfoldAmount,
	wallUnfoldFitBounds,
	type WallUnfoldBounds,
	type WallUnfoldState
} from '$lib/layout/wall-unfold';
import type { WallUnfoldPick } from '$lib/layout/wall-unfold-pick';

export type WallUnfoldCameraRequest =
	| {
			readonly kind: 'fit';
			readonly wallId: string;
			readonly bounds: WallUnfoldBounds;
	  }
	| {
			readonly kind: 'return';
			readonly pose: InspectionPose;
			readonly reading: ViewportReading;
			readonly entryAdjusted: boolean;
			readonly settled: { readonly pose: InspectionPose; readonly reading: ViewportReading } | null;
	  };

type CameraExecutor = (request: WallUnfoldCameraRequest) => boolean;

const DEFAULT_ENTRY = {
	pose: {
		target: [0, 0, 0] as [number, number, number],
		azimuthRadians: 0,
		elevationRadians: Math.PI / 4,
		targetPlaneHeightMeters: 12
	},
	reading: '3d' as const
};

/** The declared camera transition, mirrored here only to time the sheet fold. */
const FOLD_SECONDS = 1;

function smoothstep(value: number): number {
	const amount = Math.min(1, Math.max(0, value));
	return amount * amount * (3 - 2 * amount);
}

class WallUnfoldStore {
	state = $state<WallUnfoldState | null>(null);
	/** The last pointer pick, session-only: it is evidence, never authored data. */
	lastPick = $state<(WallUnfoldPick & { readonly pointerId: number; readonly sequence: number }) | null>(null);
	/** Live sheet Opening drag; display-only until the canonical planner accepts. */
	previewOpening = $state<{
		readonly wallId: string;
		readonly openingId: string;
		readonly offset: number;
		readonly width: number;
	} | null>(null);
	#pickSequence = 0;
	#executor: CameraExecutor | null = null;
	#frame: number | null = null;

	setCameraExecutor(executor: CameraExecutor | null): void {
		this.#executor = executor;
	}

	isActive(wallId: string | null | undefined): boolean {
		return wallId !== null && wallId !== undefined && this.state?.wallId === wallId;
	}

	/** The route records the settled pose entry produced, once. */
	recordSettled(entry: { readonly pose: InspectionPose; readonly reading: ViewportReading }): void {
		if (this.state === null) return;
		this.state = { ...this.state, settled: entry };
	}

	enter(
		wall: CompiledPhysicalWall,
		anchorStation = 0,
		entry?: { readonly pose: InspectionPose; readonly reading: ViewportReading },
		options: {
			readonly side?: 1 | -1;
			readonly floorY?: number;
			readonly straight?: boolean;
		} = {}
	): void {
		this.lastPick = null;
		this.previewOpening = null;
		this.#pickSequence = 0;
		const straight = options.straight ?? isStraightCompiledWall(wall);
		const state = createWallUnfoldState({
			wall,
			anchorStation,
			side: options.side,
			entry: entry ?? this.state?.entry ?? DEFAULT_ENTRY,
			u: straight ? 1 : 0,
			// The cut is display-only, but it must still land on solid Wall rather
			// than inside an Opening's void.
			openings: wall.openings.map((opening) => ({
				start: opening.offset,
				end: opening.offset + opening.width
			}))
		});
		this.state = state;
		// D5 — entry changes no Camera orientation. One bounded fit is allowed;
		// the route records the settled pose after the fit so Put back can tell
		// deliberate navigation from the entry adjustment.
		const fitted = this.#requestFit(wall, state, options.floorY ?? 0);
		if (fitted) this.state = { ...this.state, entryAdjusted: true };
		if (straight) {
			// The straight Wall enters already flat: there is nothing to peel and
			// no artificial unfolding animation.
			this.state = { ...this.state, u: 1 };
			this.#notify();
			return;
		}
		this.animateTo(wall, 1);
	}

	setOpeningPreview(preview: {
		readonly wallId: string;
		readonly openingId: string;
		readonly offset: number;
		readonly width: number;
	} | null): void {
		this.previewOpening = preview;
	}

	setU(wall: CompiledPhysicalWall, amount: number): void {
		if (this.state === null) return;
		this.state = setWallUnfoldAmount(this.state, amount);
		this.#notify();
	}

	flip(_wall: CompiledPhysicalWall): void {
		if (this.state === null) return;
		// D6 — the side is a display reading change, never a camera move.
		this.state = flipWallUnfoldSide(this.state);
	}

	refold(wall: CompiledPhysicalWall): void {
		this.exit(wall);
	}

	exit(wall?: CompiledPhysicalWall): void {
		if (this.state === null) return;
		this.lastPick = null;
		this.previewOpening = null;
		const state = this.state;
		this.#requestReturn(state);
		if (wall !== undefined) {
			this.animateTo(wall, 0, () => {
				this.state = null;
			});
		} else {
			this.state = null;
		}
	}

	/** Record the canonical attribution a live Stage press resolved. */
	recordPick(pick: WallUnfoldPick, pointerId: number): void {
		this.lastPick = { ...pick, pointerId, sequence: ++this.#pickSequence };
	}

	/** Cancel exactly to the canonical mesh without leaving the context. */
	cancelScrub(wall: CompiledPhysicalWall): void {
		if (this.state === null) return;
		this.#cancelFrame();
		this.state = refoldWallUnfold(this.state);
		this.#notify();
	}

	private animateTo(wall: CompiledPhysicalWall, target: 1 | 0, after?: () => void): void {
		this.#cancelFrame();
		const reducedMotion = typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reducedMotion || typeof requestAnimationFrame !== 'function') {
			if (this.state !== null) this.state = { ...this.state, u: target };
			after?.();
			return;
		}
		const wallId = wall.wallId;
		const start = performance.now();
		const step = (now: number): void => {
			if (this.state === null || this.state.wallId !== wallId) return;
			const progress = Math.min(1, (now - start) / (FOLD_SECONDS * 1000));
			const eased = smoothstep(progress);
			this.state = { ...this.state, u: target === 1 ? eased : 1 - eased };
			this.#notify();
			if (progress < 1) {
				this.#frame = requestAnimationFrame(step);
			} else {
				this.#frame = null;
				after?.();
			}
		};
		this.#frame = requestAnimationFrame(step);
	}

	#cancelFrame(): void {
		if (this.#frame !== null && typeof cancelAnimationFrame === 'function') {
			cancelAnimationFrame(this.#frame);
		}
		this.#frame = null;
	}

	#requestFit(wall: CompiledPhysicalWall, state: WallUnfoldState, floorY: number): boolean {
		if (this.#executor === null) return false;
		return this.#executor({
			kind: 'fit',
			wallId: wall.wallId,
			bounds: wallUnfoldFitBounds({ wall, state, floorY })
		});
	}

	#requestReturn(state: WallUnfoldState): void {
		if (this.#executor === null) return;
		this.#executor({
			kind: 'return',
			pose: state.entry.pose,
			reading: state.entry.reading,
			entryAdjusted: state.entryAdjusted === true,
			settled: state.settled ?? null
		});
	}

	#notify(): void {
		// The Stage sheet reacts to `state`; the Card re-renders through the same
		// rune. Nothing here writes the camera or the document.
	}
}

export const wallUnfold = new WallUnfoldStore();
