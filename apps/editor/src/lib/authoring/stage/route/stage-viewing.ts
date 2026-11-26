import type { ViewingIntent, ViewportRect } from '@portfolio/camera-core/viewport';
import type { FeatureLifecycle } from '../../workspace/protocol';
import { scaleDetentIntent, type StageDraftingPatch } from '../stage-drafting';
import type { StageFacade, StageIntentResult } from '../stage-facade';
import { readingIntentClockSeconds } from '../stage-input';
import type { StageSession } from '../stage-session';
import { readStageContentBounds } from './stage-content-bounds.svelte';
import type { StageInputArbiter } from './stage-input.svelte';
import type { StageShellState } from './stage-shell-state.svelte';

export function createStageViewing(input: {
	readonly facade: () => StageFacade | null;
	readonly rect: () => ViewportRect | null;
	readonly stageInput: () => StageInputArbiter;
	readonly shell: Pick<StageShellState, 'reducedMotion' | 'nowSeconds' | 'patchDrafting'>;
	readonly session: Pick<StageSession, 'gesture'>;
	readonly lifecycle: () => Pick<FeatureLifecycle, 'readingChange'>;
	readonly refresh: () => void;
}) {
	function submit(intent: ViewingIntent, clockSeconds: number): StageIntentResult | null {
		const stage = input.facade();
		if (stage === null) return null;
		if (input.stageInput().drag?.mode === 'adapter' && intent.kind !== 'set-reading') return null;
		const first = stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
		if (first.kind !== 'superseded') return first;
		stage.acquireInspection('exclusive');
		return stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
	}

	function setReading(reading: '3d' | 'plan'): void {
		input.lifecycle().readingChange(reading);
	}

	function submitReading(reading: '3d' | 'plan'): void {
		submit(
			{ kind: 'set-reading', reading },
			readingIntentClockSeconds(input.shell.reducedMotion, input.shell.nowSeconds()),
		);
	}

	function endPressForReading(): void {
		const stageInput = input.stageInput();
		const session = input.session;
		const facade = input.facade();
		const rect = input.rect();
		if (stageInput.drag !== null && session.gesture() === null) {
			if (stageInput.drag.mode === 'adapter' && facade !== null) {
				const css: [number, number] = [
					stageInput.drag.x - (rect?.left ?? 0),
					stageInput.drag.y - (rect?.top ?? 0),
				];
				input.refresh();
				const id = facade.evaluationId();
				if (id !== null) facade.pointerIntent({ phase: 'move', css, evaluationId: id });
			}
			stageInput.interrupt('reading-change');
		}
	}

	function patchDrafting(patch: StageDraftingPatch): void {
		input.shell.patchDrafting(patch);
	}

	function requestScaleDetent(ratio: number): void {
		const stage = input.facade();
		const viewport = input.rect();
		if (stage === null || viewport === null || viewport.height <= 0) return;
		const settledHeight = stage.camera.state().pose.targetPlaneHeightMeters;
		const intent = scaleDetentIntent(ratio, settledHeight / viewport.height);
		if (intent !== null) submit(intent, input.shell.nowSeconds());
	}

	function fit(): void {
		const stage = input.facade();
		const rect = input.rect();
		if (stage === null || rect === null) return;
		const bounds = readStageContentBounds(stage);
		if (bounds === null) return;
		submit(
			{ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect },
			input.shell.nowSeconds(),
		);
	}

	function zoomIn(): void {
		zoom(1 / 1.25);
	}

	function zoomOut(): void {
		zoom(1.25);
	}

	function bringIntoView(target: readonly [number, number, number]): void {
		submit(
			{ kind: 'bring-into-view', target: [target[0], target[1], target[2]] },
			input.shell.nowSeconds(),
		);
	}

	function zoom(scale: number): void {
		submit({ kind: 'zoom', scale }, input.shell.nowSeconds());
	}

	function pan(dx: number, dy: number): void {
		const rect = input.rect();
		if (rect === null) return;
		submit({ kind: 'pan', deltaCss: [dx, dy], rect }, input.shell.nowSeconds());
	}

	function orbit(dAzimuth: number, dElevation: number): void {
		submit(
			{ kind: 'orbit', deltaAzimuthRadians: dAzimuth, deltaElevationRadians: dElevation },
			input.shell.nowSeconds(),
		);
	}

	return {
		submit,
		setReading,
		submitReading,
		endPressForReading,
		patchDrafting,
		requestScaleDetent,
		fit,
		zoomIn,
		zoomOut,
		bringIntoView,
		zoom,
		pan,
		orbit,
	};
}
