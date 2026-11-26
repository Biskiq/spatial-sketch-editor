import type { ViewportRect } from '@portfolio/camera-core/viewport';
import { wallFace, type WallFaceFit } from '../../layout/wall-face-store';
import {
	faceBoundsOf,
	faceScreenAxes,
	planFitBoundsOf,
	planScreenAxes,
	type regionFraming,
} from '../../look/align-chart';
import type { StageFacade } from '../stage-facade';
import { readingIntentClockSeconds } from '../stage-input';
import type { createStageViewing } from '../route/stage-viewing';

export function createWallFaceHost(input: {
	readonly facade: () => StageFacade | null;
	readonly rect: () => ViewportRect | null;
	readonly alignFraming: (
		fit: WallFaceFit,
		axes: ReturnType<typeof faceScreenAxes>,
		rect: ViewportRect,
	) => ReturnType<typeof regionFraming>;
	readonly reducedMotion: () => boolean;
	readonly nowSeconds: () => number;
	readonly submit: ReturnType<typeof createStageViewing>['submit'];
}) {
	function attachCameraPort(): void {
		$effect(() => {
			wallFace.setCameraPort({
				standpoint: () => input.facade()?.camera.state() ?? null,
				face: (frame, fit) => {
					const stage = input.facade();
					const viewport = input.rect();
					if (stage === null || viewport === null) return false;
					// Align (U6): frame the surface inside the chrome-free region, not the
					// whole canvas. Plain Face keeps its conservative whole-canvas frame.
					const axes = faceScreenAxes(frame.look);
					const framing = fit === undefined ? null : input.alignFraming(fit, axes, viewport);
					const result = input.submit(
						framing === null
							? { kind: 'face', bounds: frame.bounds, look: frame.look, rect: viewport }
							: {
									kind: 'face',
									bounds: faceBoundsOf(framing, axes.right),
									look: frame.look,
									rect: viewport,
									paddingFraction: 0,
								},
						readingIntentClockSeconds(input.reducedMotion(), input.nowSeconds()),
					);
					return result?.kind === 'accepted';
				},
				frameFloor: (bounds, fit) => {
					const stage = input.facade();
					const viewport = input.rect();
					if (stage === null || viewport === null) return false;
					const t = readingIntentClockSeconds(input.reducedMotion(), input.nowSeconds());
					const current = stage.camera.state();
					if (current.reading !== 'plan') {
						const flip = input.submit({ kind: 'set-reading', reading: 'plan' }, t);
						if (flip?.kind !== 'accepted') return false;
					}
					// Plan snaps its azimuth to a quarter turn; frame with the axes it lands on.
					const framing =
						fit === undefined
							? null
							: input.alignFraming(fit, planScreenAxes(current.pose.azimuthRadians), viewport);
					const fitted = input.submit(
						framing === null
							? {
									kind: 'fit',
									bounds: {
										min: [bounds.min[0], bounds.min[1], bounds.min[2]],
										max: [bounds.max[0], bounds.max[1], bounds.max[2]],
									},
									rect: viewport,
									paddingFraction: 0.14,
								}
							: {
									kind: 'fit',
									bounds: planFitBoundsOf(framing),
									rect: viewport,
									paddingFraction: 0,
								},
						t,
					);
					return fitted?.kind === 'accepted';
				},
				putBack: (entry) => input.facade()?.camera.restoreStandpoint(entry) ?? false,
			});
			return () => {
				wallFace.setCameraPort(null);
				wallFace.clear();
			};
		});
	}

	attachCameraPort();
	return { attachCameraPort, clear: () => wallFace.clear() };
}
