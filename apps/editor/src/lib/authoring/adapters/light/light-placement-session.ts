/**
 * X8 — the Light placement session.
 *
 * The creation half of Light authoring: the armed Light kind, the hover ghost,
 * the captured press, the held release while its one `create-light` is in
 * flight, the refused-release ghost, the zero-intensity candidate the renderer
 * keeps mounted while Lights is armed, and the task's own lifetime (open, close,
 * rebind, disposal). Placement takes the binding's one gesture lease on press
 * and ends it on release, cancel, task close and disposal; it creates through
 * the registered `create-light` planner only, and its preview is the Stage's
 * session-only light preview, never source.
 *
 * Mark edits of an existing light are the gesture session's; this session reads
 * whether one is captured only to leave the hover ghost off while it drags.
 */
import type { Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterContext,
	StageAdapterServices,
	StageCandidatePreview,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { sceneEntityReference } from '../scene/placement';
import { armedLightKind, clearArmedLight } from '../../look/light-tool.svelte';
import { rotationForLightDirection, spotConeGuide } from '../../look/light-aim';
import { LIGHT_INTENSITY_REFERENCE, lightKindLabel } from '../../look/light-units';
import { formatMeters, lightPlacementBody } from '../../look/light-presentation';
import { add, distance, dot, normalize, pointOf, scale, sub } from './light-math';
import {
	LIGHT_DEFAULT_SPOT_ANGLE,
	LIGHT_TASK,
	lightGlyphAt,
	nextLightName,
	viewportCss,
	type Light
} from './light-subjects';
import {
	LIGHT_REFUSAL_MS,
	type LightInstallWindow,
	type LightLease,
	type LightRefusal
} from './light-session-ports';

const LIGHT_PLACEMENT_DRAG_CSS = 4;

type Placement = {
	readonly startCss: readonly [number, number];
	/** The body from the approved stand-off table. */
	readonly body: Vec3;
	readonly normal: Vec3;
	target: Vec3;
	moved: boolean;
	readonly hit: boolean;
	/** The surface point the placement body was derived from. */
	readonly contact?: Vec3;
};

function createPayload(input: {
	readonly kind: Light['light'];
	readonly name: string;
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly range?: number;
}) {
	const base = {
		light: input.kind,
		name: input.name,
		color: '#ffffff',
		intensity: LIGHT_INTENSITY_REFERENCE,
		castShadow: false,
		position: [...input.position],
		rotation: [...input.rotation]
	};
	return input.kind === 'spot'
		? {
				...base,
				angle: LIGHT_DEFAULT_SPOT_ANGLE,
				...(input.range === undefined ? {} : { range: input.range })
			}
		: base;
}

export type LightPlacementSession = {
	/** A press is captured and has not been released. */
	readonly active: boolean;
	/** The one create is in flight; every further move and click is ignored. */
	readonly placing: boolean;
	/** The Lights task is the open contributed task. */
	readonly taskOpen: boolean;
	/** A new pointer move or press discards a refused release's held ghost. */
	clearRefusal(): void;
	/**
	 * A press while Lights is armed and no mark was admitted: select the light
	 * glyph under the pointer (and disarm) or capture a new placement.
	 */
	press(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** The captured press moved: derive the candidate and mount its preview light. */
	move(intent: StagePointerIntent, adapterContext: StageAdapterContext): void;
	/** Release: end the capture and lease, hold the ghost and start the one create. */
	finish(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** An unpressed move while Lights is armed: the hover ghost and candidate light. */
	hover(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		markGestureActive: boolean
	): boolean;
	candidatePreview(adapterContext: StageAdapterContext): StageCandidatePreview[];
	/** The task instrument: records the open task and zeroes the candidate. */
	instrument(task: { readonly kind: string }): { summary: string; view: undefined } | null;
	/** Forget the capture and the hover ghost (cancel, release). */
	drop(): void;
	/** Mount the zero-intensity candidate while Point or Spot is armed. */
	zeroCandidate(): void;
	/**
	 * The host closed the task. Only an armed task that really was open, outside
	 * its own install, is a disarm; the opening notification of another task is not.
	 */
	closeTask(): void;
	/** The binding ends: forget task, capture and ghost. Disarming is separate. */
	reset(): void;
	/** Disarm unless this binding's own install is in flight. */
	disarmUnlessInstalling(): void;
};

export type LightPlacementDeps = {
	readonly services: StageAdapterServices;
	readonly lease: LightLease;
	readonly refusal: LightRefusal;
	readonly install: LightInstallWindow;
};

export function createLightPlacementSession(deps: LightPlacementDeps): LightPlacementSession {
	const { services, lease, refusal, install } = deps;
	let openTaskKind: string | null = null;
	let placement: Placement | null = null;
	/** The armed hover's last candidate, drawn as a ghost before any press. */
	let hoverPlacement: Placement | null = null;
	/** A released candidate while its one create is in flight; input is ignored. */
	let placing: Placement | null = null;
	/** A refused release: the candidate is held in refusal ink until the next move. */
	let placementRefusal: {
		readonly placement: Placement;
		readonly message: string;
		readonly until: number;
	} | null = null;

	const projectId = (): string => services.stage.snapshot().acceptedRevision.projectId;

	function livePlacementRefusal() {
		if (placementRefusal === null) return null;
		if (Date.now() > placementRefusal.until) {
			placementRefusal = null;
			return null;
		}
		return placementRefusal;
	}

	/**
	 * The placement candidate light. While Point or Spot is armed it stays
	 * mounted at intensity 0 with no valid candidate, so the renderer's light
	 * count changes on arm and disarm rather than on every hover.
	 */
	function previewCandidate(
		kind: 'point' | 'spot',
		position: Vec3 | null,
		rotation: Vec3,
		intensity: number
	): Light {
		return {
			kind: 'light',
			light: kind,
			id: 'light-placement-preview',
			name: 'Preview',
			color: '#ffffff',
			intensity,
			castShadow: false,
			position: position === null
				? [0, services.stage.snapshot().domain.datumMeters, 0]
				: [...position],
			rotation: [...rotation],
			...(kind === 'spot' ? { angle: LIGHT_DEFAULT_SPOT_ANGLE } : {})
		} as Light;
	}

	function zeroCandidate(): void {
		const kind = armedLightKind(projectId());
		if (kind !== 'point' && kind !== 'spot') return;
		services.stage.lightPreview()?.setCandidate(
			previewCandidate(kind, null, rotationForLightDirection([0, -1, 0]), 0)
		);
	}

	function placementBodyAt(
		css: readonly [number, number],
		adapterContext: StageAdapterContext
	): Placement | null {
		const ray = adapterContext.ray(viewportCss(css, adapterContext));
		if (ray === null) return null;
		const kind = armedLightKind(projectId());
		if (kind === null) return null;
		const drawn = adapterContext.pickScene(ray);
		let normal: Vec3 = [0, 1, 0];
		if (drawn !== null) {
			normal = normalize(
				drawn.normal === undefined
					? sub(ray.origin, drawn.worldPoint)
					: drawn.normal
			);
			// A surface normal points away from the host; flip one that faces
			// along the press ray so the light body is always in front of it.
			if (dot(normal, ray.direction) > 0) normal = scale(normal, -1);
		}
		const body = lightPlacementBody({
			kind,
			hit: drawn === null ? null : { point: [...drawn.worldPoint], normal },
			datumMeters: adapterContext.snapshot.domain.datumMeters,
			ray
		});
		if (body === null) return null;
		return {
			startCss: [css[0], css[1]],
			body,
			normal,
			target: body,
			moved: false,
			hit: drawn !== null,
			...(drawn === null ? {} : { contact: [...drawn.worldPoint] as Vec3 })
		};
	}

	function placementTargetAt(
		css: readonly [number, number],
		current: Placement,
		adapterContext: StageAdapterContext
	): Vec3 | null {
		const ray = adapterContext.ray(viewportCss(css, adapterContext));
		if (ray === null) return null;
		const drawn = adapterContext.pickScene(ray);
		if (drawn !== null) return [...drawn.worldPoint];
		return pointOf(ray, current.body[1]);
	}

	function updatePlacement(
		css: readonly [number, number],
		adapterContext: StageAdapterContext
	): void {
		if (placement === null) return;
		const target = placementTargetAt(css, placement, adapterContext);
		if (target !== null) placement.target = target;
		if (
			Math.hypot(css[0] - placement.startCss[0], css[1] - placement.startCss[1]) >
			LIGHT_PLACEMENT_DRAG_CSS
		) {
			placement.moved = true;
		}
	}

	async function commitPlacement(
		pending: Placement,
		adapterContext: StageAdapterContext
	): Promise<void> {
		const kind = armedLightKind(projectId()) ?? 'spot';
		const name = nextLightName(adapterContext.snapshot, kind);
		let position: Vec3;
		let rotation: Vec3;
		let range: number | undefined;
		if (kind === 'point') {
			position = pending.body;
			rotation = [0, 0, 0];
		} else {
			position = pending.body;
			const direction = pending.moved
				? normalize(sub(pending.target, pending.body))
				: ([0, -1, 0] as Vec3);
			rotation = rotationForLightDirection(direction);
			// A new Spot is Unlimited. Press-drag aims it; it never invents a
			// cutoff, because Reach is a cutoff the author sets on purpose.
		}
		const payload = createPayload({ kind, name, position, rotation, range });
		const allocatedId = `light-${crypto.randomUUID()}`;
		install.open();
		try {
			const outcome = await services.authoring.accept({
				version: 1,
				kind: 'create-light',
				operationId: crypto.randomUUID(),
				expectedRevision: adapterContext.snapshot.acceptedRevision,
				targets: [],
				payload: payload as never,
				capturedInputs: [],
				allocatedIds: [{ kind: 'scene-entity', id: allocatedId }]
			});
			if (outcome.kind === 'installed') {
				const reference = sceneEntityReference(
					allocatedId,
					services.stage.snapshot().domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
			} else if (outcome.kind === 'refused') {
				// D11: a refused placement must say so rather than end silently.
				refusal.note(outcome.message);
				placementRefusal = {
					placement: pending,
					message: outcome.message,
					until: Date.now() + LIGHT_REFUSAL_MS
				};
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'The light could not be placed.';
			refusal.note(message);
			placementRefusal = { placement: pending, message, until: Date.now() + LIGHT_REFUSAL_MS };
		} finally {
			placing = null;
			// The committed or refused pose is no longer the hover candidate; the
			// next move derives a fresh one, so no stale chip survives the release.
			hoverPlacement = null;
			install.close();
			services.stage.lightPreview()?.setCandidate(null);
			if (openTaskKind === LIGHT_TASK) zeroCandidate();
			services.stage.notifySurfaceChange();
		}
	}

	return {
		get active() {
			return placement !== null;
		},
		get placing() {
			return placing !== null;
		},
		get taskOpen() {
			return openTaskKind === LIGHT_TASK;
		},
		clearRefusal() {
			placementRefusal = null;
		},
		press(intent, adapterContext) {
			// The plan gives an admitted mark priority over both the emitter
			// glyph and a new placement while Lights is armed.
			const glyph = lightGlyphAt(intent.css, adapterContext);
			if (glyph !== null) {
				const reference = sceneEntityReference(
					glyph.light.id,
					adapterContext.snapshot.domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				clearArmedLight();
				services.stage.closeTask();
				return true;
			}
			const nextPlacement = placementBodyAt(intent.css, adapterContext);
			if (nextPlacement === null) return false;
			if (!lease.acquire(intent.evaluationId, 'light-place')) return false;
			placement = nextPlacement;
			hoverPlacement = null;
			const kind = armedLightKind(projectId());
			if (kind === 'point' || kind === 'spot') {
				services.stage.lightPreview()?.setCandidate(
					previewCandidate(kind, nextPlacement.body, rotationForLightDirection([0, -1, 0]), LIGHT_INTENSITY_REFERENCE)
				);
			}
			services.stage.notifySurfaceChange();
			return true;
		},
		move(intent, adapterContext) {
			if (placement === null) return;
			updatePlacement(intent.css, adapterContext);
			const kind = armedLightKind(projectId());
			if (kind === 'point' || kind === 'spot') {
				const direction = kind === 'spot' && placement.moved
					? normalize(sub(placement.target, placement.body))
					: ([0, -1, 0] as Vec3);
				services.stage.lightPreview()?.setCandidate(
					previewCandidate(kind, placement.body, rotationForLightDirection(direction), LIGHT_INTENSITY_REFERENCE)
				);
			}
		},
		finish(intent, adapterContext) {
			const pending = placement;
			if (pending === null) return false;
			placement = null;
			lease.release();
			// Hold the drawn ghost under a Placing… chip until the one create
			// settles; pointer moves and clicks are ignored meanwhile. The payload
			// is the pose the last move drew.
			placing = pending;
			void commitPlacement(pending, adapterContext);
			return true;
		},
		hover(intent, adapterContext, markGestureActive) {
		// A new pointer move starts a fresh candidate after a refused release.
		placementRefusal = null;
		if (
			openTaskKind !== LIGHT_TASK ||
			placement !== null ||
			markGestureActive ||
			intent.phase !== 'move'
		) return false;
		const kind = armedLightKind(projectId());
		if (kind !== 'point' && kind !== 'spot') return false;
		const next = placementBodyAt(intent.css, adapterContext);
		hoverPlacement = next;
		const preview = services.stage.lightPreview();
		if (preview !== null) {
			preview.setCandidate(
				next === null
					? previewCandidate(kind, null, rotationForLightDirection([0, -1, 0]), 0)
					: previewCandidate(
							kind,
							next.body,
							rotationForLightDirection([0, -1, 0]),
							LIGHT_INTENSITY_REFERENCE
						)
			);
		}
		services.stage.notifySurfaceChange();
		return true;
		},
		candidatePreview(adapterContext) {
		const previews: StageCandidatePreview[] = [];
		const kind = armedLightKind(projectId()) ?? 'spot';
		const refused = livePlacementRefusal();
		const active = placing ?? refused?.placement ?? placement ?? hoverPlacement;
		if (active === null) {
			if (openTaskKind === LIGHT_TASK) {
				previews.push({
					id: 'light-placement',
					role: 'subject',
					segments: [],
					labels: [{
						world: [0, adapterContext.snapshot.domain.datumMeters, 0],
						text: 'Point at a surface'
					}],
					polygons: []
				});
			}
			return previews;
		}
		const contact = active.contact ?? [active.body[0], adapterContext.snapshot.domain.datumMeters, active.body[2]] as Vec3;
		const segments: [Vec3, Vec3][] = [
			[active.body, contact],
			[add(contact, [0.08, 0, 0]), add(contact, [-0.08, 0, 0])],
			[add(contact, [0, 0, 0.08]), add(contact, [0, 0, -0.08])]
		];
		// The emitter glyph: a small horizontal ring at the body.
		for (let index = 0; index < 8; index += 1) {
			const a = (index / 8) * Math.PI * 2;
			const b = ((index + 1) / 8) * Math.PI * 2;
			segments.push([
				[active.body[0] + Math.cos(a) * 0.07, active.body[1], active.body[2] + Math.sin(a) * 0.07],
				[active.body[0] + Math.cos(b) * 0.07, active.body[1], active.body[2] + Math.sin(b) * 0.07]
			]);
		}
		if (kind === 'spot') {
			const aimed = active.moved;
			const direction = aimed
				? normalize(sub(active.target, active.body))
				: ([0, -1, 0] as Vec3);
			const reach = aimed
				? Math.max(0.05, distance(active.body, active.target))
				: Math.max(0.2, active.body[1] - (active.contact?.[1] ?? adapterContext.snapshot.domain.datumMeters));
			const guide = spotConeGuide({
				position: active.body,
				rotation: rotationForLightDirection(direction),
				halfAngle: LIGHT_DEFAULT_SPOT_ANGLE,
				range: reach
			});
			segments.push(...guide.edges.slice(0, 2).map((edge): [Vec3, Vec3] => [edge[0], edge[1]]));
			for (let index = 0; index < guide.capRing.length; index += 1) {
				segments.push([
					guide.capRing[index]!,
					guide.capRing[(index + 1) % guide.capRing.length]!
				]);
			}
		}
		const labels = [{
			world: active.body,
			text: placing !== null
				? 'Placing…'
				: refused !== null
					? refused.message
					: active.moved
						? 'Release on what it should light'
						: active.hit
							? `${lightKindLabel(kind)} · click to place · Esc cancels`
							: 'Point at a surface'
		}];
		if (placing === null && refused === null && active.moved && kind === 'spot') {
			labels.push({
				world: active.target,
				text: `Aim · ${formatMeters(distance(active.body, active.target))}`
			});
		}
		previews.push({
			id: 'light-placement',
			role: refused === null ? 'subject' : 'refused',
			segments,
			labels,
			polygons: []
		});
		return previews;
		},
		instrument(task) {
			openTaskKind = task.kind;
			if (task.kind !== LIGHT_TASK) return null;
			placementRefusal = null;
			const kind = armedLightKind(projectId()) ?? 'spot';
			if (kind === 'point' || kind === 'spot') zeroCandidate();
			return {
				summary: `Place ${lightKindLabel(kind)}`,
				view: undefined
			};
		},
		drop() {
			placement = null;
			hoverPlacement = null;
		},
		zeroCandidate,
		closeTask() {
			// Opening a task also notifies the previous task owner. Only an armed
			// task that really was open is a disarm; the opening notification is not.
			if (openTaskKind === LIGHT_TASK && !install.isOpen) clearArmedLight();
			openTaskKind = null;
			placement = null;
			hoverPlacement = null;
		},
		reset() {
			openTaskKind = null;
			placement = null;
			hoverPlacement = null;
		},
		disarmUnlessInstalling() {
			if (!install.isOpen) clearArmedLight();
		}
	};
}
