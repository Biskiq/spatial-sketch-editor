/**
 * C3 checkpoint 5 — the one live unfold context, as a session store.
 *
 * Runes make the Card scrubber, the Stage sheet and the adapter actions read
 * the same state. The store never writes the camera: it asks a registered
 * **executor** (the spatial route, which owns the inspection ticket) to present
 * a `face` or `set-view` intent through the single Camera authority. Session
 * state survives an accepted edit's adapter rebind; it is cleared only by
 * Refold/Done, subject removal or a replaced document.
 */
import {
	createWallDevelopmentBuffers,
	developmentFaceFrame,
	evaluateWallDevelopment,
	type CompiledPhysicalWall
} from '@portfolio/layout-core';
import type { InspectionPose, ViewportReading } from '@portfolio/camera-core';

import {
	createWallUnfoldState,
	flipWallUnfoldSide,
	prepareWallUnfoldDevelopment,
	refoldWallUnfold,
	setWallUnfoldAmount,
	type WallUnfoldState
} from '$lib/layout/wall-unfold';
import type { WallUnfoldPick } from '$lib/layout/wall-unfold-pick';

export type WallUnfoldCameraRequest =
	| {
			readonly kind: 'face';
			readonly bounds: {
				readonly min: [number, number, number];
				readonly max: [number, number, number];
			};
			readonly look: [number, number, number];
	  }
	| {
			readonly kind: 'return';
			readonly pose: InspectionPose;
			readonly reading: ViewportReading;
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
	#pickSequence = 0;
	#executor: CameraExecutor | null = null;
	#frame: number | null = null;

	setCameraExecutor(executor: CameraExecutor | null): void {
		this.#executor = executor;
	}

	isActive(wallId: string | null | undefined): boolean {
		return wallId !== null && wallId !== undefined && this.state?.wallId === wallId;
	}

	/** The route captures the settled camera it entered from, exactly once. */
	recordEntry(entry: { readonly pose: InspectionPose; readonly reading: ViewportReading }): void {
		if (this.state === null) return;
		this.state = { ...this.state, entry };
	}

	enter(wall: CompiledPhysicalWall, anchorStation = 0): void {
		this.lastPick = null;
		this.#pickSequence = 0;
		const state = createWallUnfoldState({
			wall,
			anchorStation,
			entry: this.state?.entry ?? DEFAULT_ENTRY,
			u: 0
		});
		this.state = state;
		// One `face` transition to the sheet fitted at u = 1; the sheet animates
		// 0 → 1 on the same declared clock and easing.
		this.#requestFace(wall, state);
		this.animateTo(wall, 1);
	}

	setU(wall: CompiledPhysicalWall, amount: number): void {
		if (this.state === null) return;
		this.state = setWallUnfoldAmount(this.state, amount);
		this.#notify();
	}

	flip(wall: CompiledPhysicalWall): void {
		if (this.state === null) return;
		this.state = flipWallUnfoldSide(this.state);
		this.#requestFace(wall, this.state);
	}

	refold(wall: CompiledPhysicalWall): void {
		if (this.state === null) return;
		this.#requestReturn(this.state);
		this.animateTo(wall, 0);
	}

	exit(wall?: CompiledPhysicalWall): void {
		if (this.state === null) return;
		this.lastPick = null;
		this.#requestReturn(this.state);
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
		if (typeof requestAnimationFrame !== 'function') {
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

	#requestFace(wall: CompiledPhysicalWall, state: WallUnfoldState): void {
		const prepared = prepareWallUnfoldDevelopment(state, wall);
		if ('refused' in prepared) return;
		const buffers = createWallDevelopmentBuffers(prepared);
		evaluateWallDevelopment(prepared, state.u, buffers);
		const frame = developmentFaceFrame(prepared, buffers, state.side, {
			thickness: wall.thickness,
			height: wall.height
		});
		if (frame === null) return;
		this.#executor?.({ kind: 'face', bounds: frame.bounds, look: frame.look });
	}

	#requestReturn(state: WallUnfoldState): void {
		if (this.#executor === null) return;
		this.#executor({ kind: 'return', pose: state.entry.pose, reading: state.entry.reading });
	}

	#notify(): void {
		// The Stage sheet reacts to `state`; the Card re-renders through the same
		// rune. Nothing here writes the camera or the document.
	}
}

export const wallUnfold = new WallUnfoldStore();
