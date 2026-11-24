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
import type { ViewportCameraState } from '@portfolio/camera-core';

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
export type WallFaceCameraPort = {
	standpoint(): ViewportCameraState | null;
	face(frame: WallFaceFrame): boolean;
	/** Plan reading + fit on floor bounds (Align on floor, U6). */
	frameFloor?(bounds: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }): boolean;
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
	face(input: { readonly wallId: string; readonly frame: WallFaceFrame }): WallFaceOutcome {
		const port = this.#port;
		if (port === null) return { kind: 'refused', reason: 'no-camera' };
		const entry = port.standpoint();
		if (entry === null) return { kind: 'refused', reason: 'no-camera' };
		if (!port.face(input.frame)) return { kind: 'refused', reason: 'camera-refused' };
		this.#reading = { wallId: input.wallId, entry };
		return { kind: 'applied' };
	}

	/** Frame one Room floor in Plan reading; Put back restores the entry standpoint. */
	faceFloor(input: {
		readonly roomId: string;
		readonly bounds: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };
	}): WallFaceOutcome {
		const port = this.#port;
		if (port === null || port.frameFloor === undefined) return { kind: 'refused', reason: 'no-camera' };
		const entry = port.standpoint();
		if (entry === null) return { kind: 'refused', reason: 'no-camera' };
		if (!port.frameFloor(input.bounds)) return { kind: 'refused', reason: 'camera-refused' };
		this.#reading = { wallId: `floor:${input.roomId}`, entry };
		return { kind: 'applied' };
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
