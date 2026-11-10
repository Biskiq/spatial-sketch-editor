/**
 * C3 checkpoint 5 — the one live unfold context, as a session store.
 *
 * Runes make the Card scrubber, the Stage sheet and the adapter actions read
 * the same state. Entry **never moves the Camera**: the current pose is the one
 * the creator chose, and the Card's existing Bring into view is the explicit
 * framing action. Peeling, face changes and edits never write the Camera. Put
 * back therefore writes no Camera intent either; it only folds the sheet.
 * Session state survives an accepted edit's adapter rebind; it is cleared only
 * by Put back, subject removal or a replaced document.
 */
import type { CompiledPhysicalWall } from '@portfolio/layout-core';
import type { InspectionPose, ViewportReading } from '@portfolio/camera-core';

import {
	createWallUnfoldState,
	flipWallUnfoldSide,
	isStraightCompiledWall,
	refoldWallUnfold,
	setWallUnfoldAmount,
	wallUnfoldSideAngle,
	type WallUnfoldState
} from '$lib/layout/wall-unfold';
import type { WallUnfoldPick } from '$lib/layout/wall-unfold-pick';

export type WallUnfoldCameraRequest = {
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
	/**
	 * The one live face transform: a world-Y angle around the fixed pin. The
	 * Stage sheet, picks, station mapping and edge drags all read this value.
	 */
	presentationAngle = $state(0);
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
	#sideFrame: number | null = null;

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
			readonly insideSide?: 1 | -1;
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
			insideSide: options.insideSide,
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
		this.#cancelSideFrame();
		this.presentationAngle = wallUnfoldSideAngle(state.side);
		// D5 — entry changes no Camera at all: no fit, no orientation change. The
		// current pose is preserved and Bring into view remains the explicit action.
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
		// A scrub is deliberate input: stop an entry/exit fold where it is so the
		// sheet follows the hand instead of fighting the animation.
		this.#cancelFrame();
		this.state = setWallUnfoldAmount(this.state, amount);
		this.#notify();
	}

	flip(_wall: CompiledPhysicalWall): void {
		if (this.state === null) return;
		// D6 — the side is a display reading change, never a camera move.
		this.state = flipWallUnfoldSide(this.state);
		this.#animateSide(this.state.side);
	}

	refold(wall: CompiledPhysicalWall): void {
		this.exit(wall);
	}

	exit(wall?: CompiledPhysicalWall): void {
		if (this.state === null) return;
		this.#cancelSideFrame();
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

	/** The settled angle for a face, choosing the half-turn from the current pose. */
	#sideTarget(side: 1 | -1): number {
		const base = wallUnfoldSideAngle(side);
		const current = this.presentationAngle;
		const turns = Math.round((current - base) / (Math.PI * 2));
		let target = base + turns * Math.PI * 2;
		if (Math.abs(target - current) <= 1e-9) target += Math.PI * 2;
		// A tie is a half-turn either way; continue in the current direction so a
		// rapid double flip completes the physical turn instead of snapping back.
		if (Math.abs(target - current - Math.PI) <= 1e-9 && target < current) target += Math.PI * 2;
		return target;
	}

	#animateSide(side: 1 | -1): void {
		this.#cancelSideFrame();
		const target = this.#sideTarget(side);
		const reducedMotion = typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reducedMotion || typeof requestAnimationFrame !== 'function') {
			this.presentationAngle = target;
			return;
		}
		const from = this.presentationAngle;
		const start = performance.now();
		const step = (now: number): void => {
			const progress = Math.min(1, (now - start) / 260);
			this.presentationAngle = from + (target - from) * smoothstep(progress);
			if (progress < 1) this.#sideFrame = requestAnimationFrame(step);
			else this.#sideFrame = null;
		};
		this.#sideFrame = requestAnimationFrame(step);
	}

	#cancelSideFrame(): void {
		if (this.#sideFrame !== null && typeof cancelAnimationFrame === 'function') {
			cancelAnimationFrame(this.#sideFrame);
		}
		this.#sideFrame = null;
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
		const fromU = this.state?.u ?? target;
		const start = performance.now();
		const step = (now: number): void => {
			if (this.state === null || this.state.wallId !== wallId) return;
			const progress = Math.min(1, (now - start) / (FOLD_SECONDS * 1000));
			const eased = smoothstep(progress);
			// Refold from the amount on screen, not from an assumed fully open
			// sheet: a partial scrub must not jump before Put back folds it.
			this.state = { ...this.state, u: fromU + (target - fromU) * eased };
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
