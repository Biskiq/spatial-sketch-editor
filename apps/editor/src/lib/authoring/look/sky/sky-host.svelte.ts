import type { ViewportEvaluation } from '@portfolio/camera-core';
import { pointInPolygon } from '@portfolio/layout-core';
import { sunMarkAnchor, WORLD_ENVIRONMENT_GROUND_RADIUS_METERS } from '$lib/render/world-environment';
import { createStagePanelRects } from '../../stage/shell/stage-panel-rects.svelte';
import type { StageAdapterServices } from '../../stage/stage-adapter-host';
import type { StageFacade } from '../../stage/stage-facade';
import type { StageLens } from '../../stage/stage-session';
import { contribution } from '../../workspace/region-ownership';
import { celestialDialModel, placeCelestialDial } from '../celestial-dial';
import { createLookAuthoring, type LookAuthoringHost } from '../look-authoring.svelte';
import { bindSkySession } from '../sky-session.svelte';
import type { SkyBounds, SkyPanel } from './sky-view';

export function createSkyHost(input: {
	readonly look: LookAuthoringHost;
	readonly lens: () => StageLens;
	readonly previewing: () => boolean;
	readonly taskActive: () => boolean;
	readonly toolArmed: () => boolean;
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly bounds: () => SkyBounds;
	readonly services: () => StageAdapterServices | null;
	readonly fading: () => boolean;
}) {
	const skyRects = createStagePanelRects();
	const look = createLookAuthoring(input.look);

	const dialPlacement = $derived.by(() => {
		if (!look.panelOpen || input.lens() !== 'world' || input.previewing() ||
			input.taskActive() || input.toolArmed() || look.studioWhileEditing ||
			look.sky?.preset === 'studio' || !look.sky) return null;
		const evaluation = input.evaluation();
		const facade = input.facade();
		if (evaluation === null || facade === null) return null;
		const stageContentBounds = input.bounds();
		const domain = facade.snapshot().domain;
		const geometry = domain.geometry;
		const datum = domain.datumMeters;
		const boxes = [
			...geometry.walls.map((wall) => wall.bounds3),
			...domain.scene.entities.flatMap((entity) => {
				const bounds = facade.sceneBounds(entity.id);
				return bounds ? [bounds] : [];
			})
		];
		// Client rects: placement tests them against `dialProject`, which is in the
		// viewport frame (`camera.rect`), not the stage-local frame of the marks.
		const obstacles = [skyRects.panel, skyRects.dock, ...skyRects.fixed].flatMap((rect) => {
			if (!rect || rect.width <= 0) return [];
			return [{ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
		});
		const origin = sunMarkAnchor({ bounds: stageContentBounds, groundY: datum + 0.008 });
		return placeCelestialDial(origin, evaluation, obstacles, ([x, , z]) => boxes.some(({ min, max }) =>
			max[1] > datum + 0.05 && min[1] <= datum + 0.3 && x >= min[0] && x <= max[0] && z >= min[2] && z <= max[2]),
		([x, , z]) => geometry.rooms.length === 0 || geometry.rooms.some(({ floorPolygon }) => pointInPolygon([x, z], floorPolygon)), geometry.bounds);
	});
	const dial = $derived(dialPlacement ? celestialDialModel(look.shownSky, dialPlacement) : null);
	function attachSession(): void {
		$effect(() => {
			const services = input.services();
			return services ? bindSkySession(services.stage.session, { look, dial: () => dial }) : undefined;
		});
	}

	function dismiss() {
		if (!look.panelOpen) return 'pass' as const;
		look.setPanelOpen(false);
		document.querySelector<HTMLButtonElement>('[data-stage-environment-control]')?.focus();
		return 'handled' as const;
	}

	function groundReachMeters(): number | undefined {
		return look.sky !== null && look.sky.preset !== 'studio'
			? WORLD_ENVIRONMENT_GROUND_RADIUS_METERS
			: undefined;
	}

	const canvas = contribution<'sky', 'canvas'>()({
		get dial() { return dial; },
		get sky() { return look.stageSky; }
	});
	const overlay = contribution<'sky', 'overlay'>()({
		get celestial() {
			const camera = input.evaluation();
			return dial && camera ? { dial, camera, haze: look.shownSky.haze, owner: look.gesture.owner } : null;
		},
		get marks() { return look.stageMarks; }
	});
	const panels = contribution<'sky', 'panels'>()({
		rects: skyRects,
		get environment(): SkyPanel {
			return input.services() !== null && input.lens() === 'world' ? { look, fading: input.fading() } : null;
		}
	});

	attachSession();
	return {
		canvas, overlay, panels, attachSession, dismiss, groundReachMeters,
		cardStratum: look.cardStratum,
		pickMaterial: look.pickMaterial,
		pickLibraryEntry: look.pickLibraryEntry,
		setStudioWhileEditing: look.setStudioWhileEditing,
		get libraryShelf() { return look.libraryShelf; },
		get studioWhileEditing() { return look.studioWhileEditing; },
		get sky() { return look.sky; }
	};
}
