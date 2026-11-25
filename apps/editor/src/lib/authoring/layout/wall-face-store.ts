/**
 * The one live **Face** reading.
 *
 * A6 makes Face an explicit Look action, not a mode: one Wall at a time is
 * faced, and **Put back** returns the Camera to the exact standpoint it had when
 * Face was pressed. The reading holds only that Wall id and the captured
 * standpoint. It never holds a pose computation, never touches the document,
 * history or Save, and is never seen by Preview or a release.
 *
 * The route installs the camera port: it owns the session clock and the
 * reduced-motion rule, so the reading never invents a transition time and the
 * domain module above never reaches the Camera authority directly.
 */
import type { ViewportCameraState } from '@portfolio/camera-core/viewport';

import type { WallFaceFrame } from '$lib/layout/wall-face';

export type WallFaceReading = {
	readonly wallId: string;
	/** The exact settled inspection standpoint Face started from. */
	readonly entry: ViewportCameraState;
};

/**
 * The Camera side of the reading. `standpoint` is the settled state Put back
 * restores; `face` submits the one `face` intent; `putBack` restores the
 * captured state through the Camera session. Each returns whether the Camera
 * accepted, so a refusal is reported rather than assumed.
 */
/**
 * Align (U6): the faced surface's centre and metres, so the route can frame it
 * inside the chrome-free Stage region instead of the whole canvas. Absent for
 * the plain A6 Face, which keeps its conservative whole-canvas frame.
 */
export type WallFaceFit = {
	readonly center: readonly [number, number, number];
	readonly surfaceMeters: readonly [number, number];
};

type FloorBounds = { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };

export type WallFaceCameraPort = {
	standpoint(): ViewportCameraState | null;
	face(frame: WallFaceFrame, fit?: WallFaceFit): boolean;
	/** Plan reading + fit on floor bounds (Align on floor, U6). */
	frameFloor?(bounds: FloorBounds, fit?: WallFaceFit): boolean;
	putBack(entry: ViewportCameraState): boolean;
};

export type WallFaceOutcome =
	| { readonly kind: 'applied' }
	| { readonly kind: 'restored' }
	| { readonly kind: 'refused'; readonly reason: 'no-camera' | 'camera-refused' | 'not-facing' };

class WallFaceStore {
	#reading: WallFaceReading | null = null;
	#port: WallFaceCameraPort | null = null;

	reading(): WallFaceReading | null {
		return this.#reading;
	}

	isActive(wallId: string | null | undefined): boolean {
		return wallId !== null && wallId !== undefined && this.#reading?.wallId === wallId;
	}

	setCameraPort(port: WallFaceCameraPort | null): void {
		this.#port = port;
	}

	/** Face one Wall. A refused Camera writes no reading and moves nothing. */
	face(input: { readonly wallId: string; readonly frame: WallFaceFrame; readonly fit?: WallFaceFit }): WallFaceOutcome {
		const port = this.#port;
		if (port === null) return { kind: 'refused', reason: 'no-camera' };
		const entry = port.standpoint();
		if (entry === null) return { kind: 'refused', reason: 'no-camera' };
		if (!(input.fit === undefined ? port.face(input.frame) : port.face(input.frame, input.fit))) {
			return { kind: 'refused', reason: 'camera-refused' };
		}
		this.#reading = { wallId: input.wallId, entry };
		return { kind: 'applied' };
	}

	/** Frame one Room floor in Plan reading; Put back restores the entry standpoint. */
	faceFloor(input: {
		readonly roomId: string;
		readonly bounds: FloorBounds;
		readonly fit?: WallFaceFit;
	}): WallFaceOutcome {
		const port = this.#port;
		if (port === null || port.frameFloor === undefined) return { kind: 'refused', reason: 'no-camera' };
		const entry = port.standpoint();
		if (entry === null) return { kind: 'refused', reason: 'no-camera' };
		if (!port.frameFloor(input.bounds, input.fit)) return { kind: 'refused', reason: 'camera-refused' };
		this.#reading = { wallId: `floor:${input.roomId}`, entry };
		return { kind: 'applied' };
	}

	/**
	 * Re-frame the live reading (a resized or re-laned Stage). The captured entry
	 * standpoint is kept, so Put back still returns to where Face started.
	 */
	reframe(input: { readonly frame: WallFaceFrame; readonly fit?: WallFaceFit } | { readonly floor: FloorBounds; readonly fit?: WallFaceFit }): WallFaceOutcome {
		if (this.#reading === null) return { kind: 'refused', reason: 'not-facing' };
		const port = this.#port;
		if (port === null) return { kind: 'refused', reason: 'no-camera' };
		const ok =
			'floor' in input
				? port.frameFloor?.(input.floor, input.fit) ?? false
				: input.fit === undefined
					? port.face(input.frame)
					: port.face(input.frame, input.fit);
		return ok ? { kind: 'applied' } : { kind: 'refused', reason: 'camera-refused' };
	}

	/**
	 * Return to the entry standpoint. It is the exact reversal of one Face, so it
	 * stays available after the creator has navigated: Put back returns to where
	 * Face started.
	 */
	putBack(wallId?: string): WallFaceOutcome {
		const reading = this.#reading;
		if (reading === null || (wallId !== undefined && reading.wallId !== wallId)) {
			return { kind: 'refused', reason: 'not-facing' };
		}
		const port = this.#port;
		if (port === null) return { kind: 'refused', reason: 'no-camera' };
		if (!port.putBack(reading.entry)) return { kind: 'refused', reason: 'camera-refused' };
		this.#reading = null;
		return { kind: 'restored' };
	}

	/** Drop the reading without touching the Camera: a replacement or a teardown. */
	clear(): void {
		this.#reading = null;
	}
}

export const wallFace = new WallFaceStore();
