/**
 * X2 / decomposition contract W — Artwork placement and direct manipulation.
 *
 * This controller owns the route's Artwork gesture lifetime: the armed placement
 * ghost, the drop handler, and the captured move/turn/corner-resize operation.
 * The planners and helpers remain the authorities:
 * `artworkPlacement`, `resizeArtworkAtRay`, `artworkFitsWall`, the hanging-guide
 * projection and the existing `artworkCommand` acceptance boundary. It owns no
 * image lease, material store, renderer resource or second acceptance writer.
 *
 * **One captured operation.** A resize acquires exactly one
 * `artwork-resize` gesture lease, captures the pointer and refuses the press;
 * every termination (release, pointer cancel, lost capture, Escape, lens/task
 * interruption, source replacement, disposal) releases that lease exactly once
 * and clears the ghost. Late asset work belongs to the authoring owner and is
 * cancelled by `cancel()`; it can never commit after a cancellation because its
 * own request is aborted and its acceptance compares the live services.
 *
 * A `.svelte.ts` controller is created in the route's effect scope. It accepts
 * typed reads/callbacks only; it never imports the route, the acceptance host or
 * a renderer.
 */
import { Vector3 } from 'three';
import {
	pointerRay,
	type PointerRay,
	type ViewportEvaluation,
	type ViewportRect
} from '@portfolio/camera-core';
import type { ArtworkLibraryEntry, SceneArtworkEntity } from '@portfolio/project-model';
import { ARTWORK_TRANSFORM } from '@portfolio/project-model/scene-planning';
import { artworkPlanePoint, resizeArtworkAtRay, type ArtworkCorner } from '$lib/authoring/artwork/artwork-resize';
import { artworkHangingGuides, snapArtworkHeight } from '$lib/authoring/artwork/artwork-hanging';
import { artworkCommand } from '$lib/authoring/artwork/artwork-command';
import { artworkPlacement, isArtworkWallFace } from '$lib/authoring/artwork/artwork-placement';
import {
	artworkBackWallHit,
	artworkFitsWall,
	artworkIsHung,
	artworkOuterSize,
	artworkWallIsCurved
} from '$lib/authoring/artwork/artwork-wall-move';
import { createArtworkAuthoring } from '$lib/authoring/artwork/artwork-authoring.svelte';
import type { ProjectApi } from '$lib/platform/project-persistence';
import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import type { StageAdapterServices } from '../stage-adapter-host';
import type { StageCandidatePreviewView, StageFacade } from '../stage-facade';
import type { StagePressTracker } from '../stage-input';

export type StageArtworkResizeDrag = {
	readonly entity: SceneArtworkEntity;
	readonly mode: ArtworkCorner | 'move' | 'turn';
	readonly pointerId: number;
	readonly startX: number;
	readonly startPoint: Vector3 | null;
	readonly shift: boolean;
	readonly hung: boolean;
	lastPassing: SceneArtworkEntity | null;
	blocked: boolean;
	readonly lease: Extract<ReturnType<StageFacade['acquireGesture']>, { kind: 'granted' }>['lease'];
};

export type StageArtworkInteractionInput = {
	readonly api: ProjectApi | null;
	readonly services: () => StageAdapterServices | null;
	/** The route's placement gate: World lens, no Preview, no unfolded sheet. */
	readonly canEdit: () => boolean;
	readonly isSaved: () => boolean;
	readonly selected: () => SceneArtworkEntity | null;
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly rect: () => ViewportRect | null;
	readonly measure: () => ViewportRect;
	readonly stageElement: () => HTMLElement | undefined;
	readonly pickVisibleFace: ScenePickSource['pickVisibleFace'];
	readonly press: StagePressTracker;
	readonly capturePointer: (target: Element, pointerId: number) => boolean;
	readonly onNotice: (message: string) => void;
	readonly onSelect: (services: StageAdapterServices, id: string) => void;
	/** The shell's Select command, run before an imported file is placed. */
	readonly selectTool: () => void;
};

export type StageArtworkInteraction = ReturnType<typeof createStageArtworkInteraction>;

export function createStageArtworkInteraction(input: StageArtworkInteractionInput) {
	const authoring = createArtworkAuthoring({
		api: input.api,
		services: input.services,
		canEdit: input.canEdit,
		isSaved: input.isSaved,
		notice: input.onNotice,
		select: input.onSelect
	});

	let resize = $state.raw<StageArtworkResizeDrag | null>(null);
	let resizeGhost = $state.raw<SceneArtworkEntity | null>(null);
	let resizeBlocked = $state(false);
	/** The pointer's local Stage point, the fallback anchor for an Artwork need chip. */
	let placementCss = $state<readonly [number, number] | null>(null);

	/**
	 * T2 §5.7 — the Artwork placement lifecycle's one Stage chip. The ghost's
	 * projected centre anchors Click / Placing / refusal text; before any pose
	 * exists the chip follows the pointer (or the Stage centre on arming).
	 */
	const placementCandidate = $derived.by<StageCandidatePreviewView | null>(() => {
		const prompt = authoring.placementPrompt;
		const reading = input.evaluation();
		const currentRect = input.rect();
		const stage = input.facade();
		if (prompt === null || reading?.renderedReading !== '3d' || currentRect === null) return null;
		const ghost = authoring.ghost;
		const id = stage?.evaluationId() ?? null;
		let projectedCss: readonly [number, number] | null = null;
		if (ghost !== null && stage !== null && id !== null) {
			const projected = stage.projectWorld(
				[
					ghost.position[0],
					ghost.position[1] + artworkOuterSize(ghost).height / 2,
					ghost.position[2]
				] as const,
				id
			);
			if (projected.kind === 'projected' && projected.visibility === 'visible') {
				projectedCss = [projected.css[0] - currentRect.left, projected.css[1] - currentRect.top];
			}
		}
		const css = projectedCss ?? placementCss ?? ([currentRect.width / 2, currentRect.height * 0.42] as const);
		return {
			id: 'artwork-placement-chip',
			role: prompt.refused ? ('refused' as const) : ('subject' as const),
			polygons: [],
			segments: [],
			labels: [{ css, text: prompt.text }]
		};
	});

	/** The one live proposal that can carry hanging guides: placement or Move. */
	const hangingCandidate = $derived.by<SceneArtworkEntity | null>(() => {
		const active = resize;
		if (active !== null) return active.mode === 'move' ? resizeGhost : null;
		return authoring.ghost;
	});

	function cancelResize(): void {
		resize?.lease.release();
		resize = null;
		resizeGhost = null;
		resizeBlocked = false;
	}

	function wallHit(ray: PointerRay) {
		const stage = input.facade();
		if (stage === null) return null;
		const snapshot = stage.snapshot();
		return input.pickVisibleFace(ray, snapshot.domain.scene,
			(candidate) => isArtworkWallFace(candidate, snapshot.domain.geometry));
	}

	function isHungNow(entity: SceneArtworkEntity): boolean {
		return artworkIsHung(entity.position, entity.rotation[1], wallHit);
	}

	function startsWallBound(entity: SceneArtworkEntity): boolean {
		const stage = input.facade();
		if (stage === null) return false;
		const snapshot = stage.snapshot();
		const back = artworkBackWallHit(entity.position, entity.rotation[1], wallHit);
		if (back === null || back.wallId === undefined || back.distanceMeters > 0.01) return false;
		return artworkFitsWall(
			entity.position, entity.rotation[1], artworkOuterSize(entity), back.wallId, wallHit,
			{ curved: artworkWallIsCurved(back, snapshot.domain.geometry) }
		);
	}

	function startResize(event: PointerEvent, mode: ArtworkCorner | 'move' | 'turn'): void {
		const stage = input.facade();
		const entity = input.selected();
		const evaluationId = stage?.evaluationId();
		const stageEl = input.stageElement();
		if (event.button !== 0 || stage === null || !entity || !evaluationId || stageEl == null) return;
		event.preventDefault();
		event.stopPropagation();
		const acquired = stage.acquireGesture({ owner: 'artwork-resize', evaluationId, policy: 'cancel-on-reading-change' });
		if (acquired.kind !== 'granted') return;
		if (!input.capturePointer(stageEl, event.pointerId)) { acquired.lease.release(); return; }
		input.press.refuse(event.pointerId);
		const reading = input.evaluation();
		const ray = reading === null ? null : pointerRay([event.clientX, event.clientY], reading, reading.token);
		const startPoint = mode === 'move' && ray?.kind === 'ray' ? artworkPlanePoint(entity, ray.ray) : null;
		// An already-overhanging Artwork starts in free move (fix.md §7.3), while a
		// hung Artwork that still fits follows its wall.
		const hung = mode === 'move' && startsWallBound(entity);
		resize = {
			entity, mode, startPoint, startX: event.clientX, pointerId: event.pointerId,
			shift: event.shiftKey, hung, lastPassing: hung ? entity : null, blocked: false,
			lease: acquired.lease
		};
	}

	function readResize(event: PointerEvent): SceneArtworkEntity | null {
		const drag = resize;
		const reading = input.evaluation();
		if (!drag?.lease.active || reading === null || drag.pointerId !== event.pointerId) return null;
		const stage = input.facade();
		if (stage === null) return null;
		const snapshot = stage.snapshot();
		const ray = pointerRay([event.clientX, event.clientY], reading, reading.token);
		if (drag.mode === 'turn') {
			const rotation = [...drag.entity.rotation] as SceneArtworkEntity['rotation'];
			rotation[1] += (event.clientX - drag.startX) * Math.PI / 360;
			return { ...drag.entity, rotation };
		}
		if (ray.kind !== 'ray') return null;
		if (drag.mode === 'move') {
			// A plain drag follows whatever wall face is under the pointer. Shift
			// keeps the historical free-plane move (used to pull Artwork off a wall).
			if (!drag.shift) {
				const hit = wallHit(ray.ray);
				if (hit !== null && hit.wallId !== undefined) {
					const forward = new Vector3(...reading.target).sub(new Vector3(...reading.eye)).normalize().toArray();
					const pose = artworkPlacement(ray.ray, hit, snapshot.domain.datumMeters, reading.eye, forward, snapshot.domain.geometry);
					if (pose !== null) {
						const placed = { ...drag.entity, ...pose };
						const guides = artworkHangingGuides(snapshot.domain.scene, placed, snapshot.domain.datumMeters);
						const candidate = { ...placed, position: snapArtworkHeight(placed.position, guides).position };
						const fits = artworkFitsWall(
							candidate.position, candidate.rotation[1], artworkOuterSize(drag.entity),
							hit.wallId, wallHit,
							{ curved: artworkWallIsCurved(hit, snapshot.domain.geometry) }
						);
						if (fits) {
							drag.lastPassing = candidate;
							drag.blocked = false;
							return candidate;
						}
						drag.blocked = true;
						// A hung Artwork never leaves its wall: freeze at the last pose
						// whose whole outer frame fitted and refuse when there is none.
						return drag.lastPassing;
					}
				}
				if (drag.lastPassing !== null) {
					// A gap, doorway or the floor holds the last pose without an edge tag.
					drag.blocked = false;
					return drag.lastPassing;
				}
			}
			const point = artworkPlanePoint(drag.entity, ray.ray);
			if (!point || !drag.startPoint) return null;
			drag.blocked = false;
			const candidate = {
				...drag.entity,
				position: point.sub(drag.startPoint).add(new Vector3(...drag.entity.position)).toArray() as SceneArtworkEntity['position']
			};
			const guides = artworkHangingGuides(snapshot.domain.scene, candidate, snapshot.domain.datumMeters);
			return { ...candidate, position: snapArtworkHeight(candidate.position, guides).position };
		}
		return resizeArtworkAtRay(drag.entity, drag.mode, ray.ray);
	}

	async function finishResize(event: PointerEvent): Promise<void> {
		const drag = resize;
		const services = input.services();
		const candidate = readResize(event);
		cancelResize();
		if (!drag || !candidate || !services) return;
		const changed = (a: readonly number[], b: readonly number[]) => a.some((value, i) => Math.abs(value - b[i]!) > 1e-7);
		if (!changed([candidate.widthMeters, ...candidate.position, ...candidate.rotation],
			[drag.entity.widthMeters, ...drag.entity.position, ...drag.entity.rotation])) return;
		const result = await artworkCommand(services, ARTWORK_TRANSFORM,
			drag.mode === 'turn' ? { rotation: candidate.rotation }
				: drag.mode === 'move' ? { position: candidate.position }
				: { position: candidate.position, widthMeters: candidate.widthMeters },
			{ target: candidate.id, expectedRevision: drag.lease.acceptedRevision });
		if (input.services() === services && result.kind === 'refused') input.onNotice(result.message);
	}

	function poseAt(event: MouseEvent) {
		const stage = input.facade();
		const reading = input.evaluation();
		if (!input.canEdit() || stage === null || reading === null || reading.renderedReading !== '3d') return null;
		const ray = pointerRay([event.clientX, event.clientY], reading, reading.token);
		if (ray.kind !== 'ray') return null;
		const snapshot = stage.snapshot();
		const hit = input.pickVisibleFace(ray.ray, snapshot.domain.scene,
			(candidate) => isArtworkWallFace(candidate, snapshot.domain.geometry));
		const forward = new Vector3(...reading.target).sub(new Vector3(...reading.eye)).normalize().toArray();
		return artworkPlacement(ray.ray, hit, snapshot.domain.datumMeters, reading.eye, forward, snapshot.domain.geometry);
	}

	/** The one pointer-move branch: captured resize, then the armed placement ghost. */
	function pointerMove(event: PointerEvent): void {
		if (resize?.pointerId === event.pointerId) {
			resizeGhost = readResize(event);
			resizeBlocked = resize.blocked;
			return;
		}
		if (!authoring.armed) return;
		const currentRect = input.rect();
		if (currentRect !== null) {
			placementCss = [event.clientX - currentRect.left, event.clientY - currentRect.top];
		}
		if (event.buttons === 0) authoring.move(poseAt(event));
	}

	/** A captured Artwork resize owns this release; `false` falls through. */
	function pointerUp(event: PointerEvent): boolean {
		if (resize?.pointerId !== event.pointerId) return false;
		void finishResize(event);
		return true;
	}

	function pointerCancel(event: PointerEvent): boolean {
		if (resize?.pointerId !== event.pointerId) return false;
		cancelResize();
		return true;
	}

	function lostCapture(event: PointerEvent): boolean {
		if (resize?.pointerId !== event.pointerId) return false;
		cancelResize();
		return true;
	}

	/** Escape cancels the live resize first, then the armed placement. */
	function escape(): boolean {
		if (resize !== null) {
			cancelResize();
			return true;
		}
		if (authoring.armed || authoring.importing) {
			authoring.cancel();
			input.onNotice('');
			return true;
		}
		return false;
	}

	function acceptsDrop(transfer: DataTransfer | null): boolean {
		return input.canEdit() && transfer !== null && [...transfer.items].some((item) =>
			item.kind === 'file' && ['', 'image/png', 'image/jpeg', 'image/webp'].includes(item.type));
	}

	function drop(event: DragEvent): void {
		if (!acceptsDrop(event.dataTransfer)) return;
		event.preventDefault();
		input.selectTool();
		void authoring.importFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	/** The armed placement owns this click; `false` falls through to selection. */
	function click(event: MouseEvent): boolean {
		if (!authoring.armed) return false;
		const reading = input.evaluation();
		if (reading?.renderedReading !== '3d') input.onNotice('Switch to 3D to place Artwork.');
		else void authoring.place(poseAt(event));
		return true;
	}

	function leave(): void {
		authoring.move(null);
	}

	function arm(entry: ArtworkLibraryEntry): void {
		authoring.arm(entry);
	}

	return {
		get armed(): ArtworkLibraryEntry | null {
			return authoring.armed;
		},
		get ghost(): SceneArtworkEntity | null {
			return authoring.ghost;
		},
		get importing(): boolean {
			return authoring.importing;
		},
		get placing(): boolean {
			return authoring.placing;
		},
		get placementPrompt() {
			return authoring.placementPrompt;
		},
		get resize(): StageArtworkResizeDrag | null {
			return resize;
		},
		get resizeGhost(): SceneArtworkEntity | null {
			return resizeGhost;
		},
		get resizeBlocked(): boolean {
			return resizeBlocked;
		},
		get hangingCandidate(): SceneArtworkEntity | null {
			return hangingCandidate;
		},
		get placementCandidate(): StageCandidatePreviewView | null {
			return placementCandidate;
		},
		get card() {
			return authoring.card;
		},
		arm,
		cancel(): void {
			authoring.cancel();
		},
		cancelResize,
		dispose(): void {
			authoring.cancel();
			cancelResize();
		},
		startResize,
		pointerMove,
		pointerUp,
		pointerCancel,
		lostCapture,
		escape,
		acceptsDrop,
		drop,
		click,
		leave,
		isHungNow,
		/** The Corpus Canvas presents the live resize ghost before the authoring ghost. */
		movePlacement: (pose: Parameters<typeof authoring.move>[0]) => authoring.move(pose),
		importFiles: (files: File[]) => authoring.importFiles(files),
		replaceFile: authoring.replaceFile
	};
}
