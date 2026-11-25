import { eyeOfInspectionPose, fovYDegreesOf } from '@portfolio/camera-core';
import { wallUnfoldShouldReturn, wallUnfoldViewCentreStation } from '$lib/layout/wall-unfold';
import { wallUnfold } from '../../layout/wall-unfold-store.svelte';
import { contribution } from '../../workspace/region-ownership';
import type { StageReadSnapshot } from '../accepted-read';
import type { StageSelectionEntry } from '../semantic-selection';
import { createStageUnfoldGestures, selectedCurvedWallOf } from '../route/stage-unfold-gestures.svelte';

export function createUnfoldHost(input: {
	readonly gestures: Omit<Parameters<typeof createStageUnfoldGestures>[0], 'selectedCurvedWall'>;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly selection: () => StageSelectionEntry | null;
}) {
	const selectedCurvedWall = $derived.by(() => {
		const snapshot = input.snapshot();
		return snapshot === null ? null : selectedCurvedWallOf(
			input.selection(),
			snapshot.domain.geometry,
			snapshot.domain.datumMeters,
			input.gestures.evaluation()?.pose.target ?? null,
			wallUnfoldViewCentreStation
		);
	});

	const gestures = createStageUnfoldGestures({
		...input.gestures,
		selectedCurvedWall: () => selectedCurvedWall
	});

	function attachAnchor(): void {
		$effect(() => {
			const candidate = selectedCurvedWall;
			if (candidate !== null) wallUnfold.ensureAnchor(candidate.wall, candidate.defaultStation);
		});
	}

	function attachCameraPort(): void {
		$effect(() => {
			wallUnfold.setCameraExecutor((request) => {
				const stage = input.gestures.facade();
				const current = stage?.evaluation() ?? null;
				if (stage === null || current === null) return false;
				const ticket = stage.inspectionTicket();
				if (ticket === null) return false;
				const camera = stage.camera.state();
				if (!wallUnfoldShouldReturn({
					entryAdjusted: request.entryAdjusted,
					settled: request.settled,
					current: { pose: camera.pose, reading: camera.reading }
				})) return false;
				return stage.requestViewingIntent(
					{
						kind: 'set-view',
						eye: eyeOfInspectionPose(request.pose),
						target: request.pose.target,
						fovYDegrees: fovYDegreesOf(request.pose),
						transition: true
					},
					ticket,
					performance.now() / 1000
				).kind === 'accepted';
			});
			return () => wallUnfold.setCameraExecutor(null);
		});
	}

	const canvas = contribution<'layout-readings', 'canvas'>()({
		get unfoldPinHovered() { return gestures.pinHovered; },
		get unfoldPinActive() { return gestures.sheetPinActive; },
		get unfoldAnchorPin() { return gestures.idlePin?.point ?? null; }
	});

	attachCameraPort();
	return {
		canvas, gestures, attachAnchor, attachCameraPort,
		active: () => wallUnfold.state !== null,
		dispose: gestures.dispose
	};
}
