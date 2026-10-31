/**
 * R217.S17A — drawing an object from the Objects panel.
 *
 * The Scene binding routes a press here while a Box, Round or Free tile is armed
 * in its Place task. One gesture has one result:
 *
 * - **Box, Round:** a click creates the standard form; a drag creates the form its
 *   two corners span, on release.
 * - **Free:** a click adds a corner, a drag adds a smooth run, and closing on the
 *   start, Enter or Finish creates the form.
 *
 * Two rules keep the preview honest:
 *
 * - **One planner.** Preview and commit both run `create-form`'s `planCreateForm`,
 *   so the body shown is the candidate the planner would install, support and
 *   contact included. On a Room floor or on the explicit datum, the answer is the
 *   same one at both moments.
 * - **One validation.** Live validity is `validateProfile` over the converted
 *   outline, and a refusal is the kernel's own issue in words. A refused Free
 *   draft keeps every point.
 *
 * Nothing here is document state, a second selection, history or writer.
 */
import type { Vec3 } from '@portfolio/camera-core';
import {
	planCreateForm,
	type SceneOperationResult
} from '@portfolio/project-model/scene-planning';
import type { SceneFormEntity } from '@portfolio/project-model';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	datumWorkingPlane,
	type StageAdapterContext,
	type StageGhostMesh,
	type StageKeyboardIntent,
	type StageOverlayContribution,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { snapDraftingPoint } from '$lib/authoring/stage/stage-drafting';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import {
	MIN_SHAPE_EDGE_METERS,
	freeOutline,
	shapeOutline,
	standardOutline,
	type ShapeKind,
	type ShapeOutlineAnchor,
	type ShapeOutlineResult,
	type ShapePoint
} from './outline';

/** The material every native primitive is created with. */
export const SHAPE_DEFAULT_MATERIAL = 'plaster-warm' as const;
/** The creator-visible name pattern native primitives use: one plain noun. */
export const SHAPE_DEFAULT_NAME = 'Shape';
/** The height a tile creates; the Card and the Height ray change it afterwards. */
export const DEFAULT_SHAPE_HEIGHT_METERS = 1;

const PREVIEW_ENTITY_ID = 'shape-preview';
/** Above this travel a press is a drag; exactly this travel is still a click. */
const TAP_TRAVEL_CSS_PX = 4;
const CLOSE_CSS_PX = 12;
const CLOSE_COARSE_CSS_PX = 22;
const SIMPLIFY_CSS_PX = 6;

type Candidate = Extract<SceneOperationResult, { kind: 'candidate' }>;
type Lease = ReturnType<StageAdapterServices['stage']['acquireGesture']>;

type Press = {
	readonly evaluationId: string;
	readonly lease: Lease;
	readonly css: readonly [number, number];
	readonly start: ShapePoint;
	readonly raw: ShapePoint;
	/** Unsnapped samples of a Free run; empty until the press becomes a drag. */
	samples: ShapePoint[];
	dragging: boolean;
};

type Plan = {
	readonly conversion: ShapeOutlineResult;
	readonly candidate: Candidate | null;
	readonly refusal: string | null;
};

export type ObjectDrawHooks = {
	readonly tile: () => ShapeKind;
	/** The words for a press the drawn geometry hides, or `null` when it lands. */
	readonly pressRefusal: (context: StageAdapterContext, css: readonly [number, number]) => string | null;
	/** Called at commit start; its result completes the install that follows. */
	readonly beginCommit: () => (entityId: string) => void;
	readonly drawingStarted: () => void;
	readonly changed: () => void;
};

export type ObjectDrawSession = {
	pointer(intent: StagePointerIntent, context: StageAdapterContext): boolean;
	hover(intent: StagePointerIntent, context: StageAdapterContext): boolean;
	key(intent: StageKeyboardIntent): boolean;
	/** Create the armed standard form at one exact X/Z. */
	placeAt(x: number, z: number): Promise<string | null>;
	/** Close the Free draft: the coarse-pointer path, and Enter. */
	finish(): void;
	canFinish(): boolean;
	overlay(context: StageAdapterContext): readonly StageOverlayContribution[];
	ghosts(): readonly StageGhostMesh[];
	candidatePreview(context: StageAdapterContext): DrawPreview | null;
	hasWork(): boolean;
	refusal(): string | null;
	/** Drop the live press and draft; the tile stays armed. */
	cancel(): void;
};

export type DrawPreview = {
	readonly entity: SceneFormEntity | null;
	readonly refused: boolean;
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly label: { readonly world: Vec3; readonly text: string } | null;
	readonly snap: Vec3 | null;
};

function sharp(point: ShapePoint): ShapeOutlineAnchor {
	return { u: point.u, v: point.v, smooth: false };
}

export function createObjectDrawSession(
	services: StageAdapterServices,
	hooks: ObjectDrawHooks
): ObjectDrawSession {
	/** Free's clicked corners and drawn runs, in drawing order; Backspace removes one. */
	let runs: (readonly ShapeOutlineAnchor[])[] = [];
	let press: Press | null = null;
	/** The latest pointer point on the datum, snapped unless Alt suspends it. */
	let pointer: ShapePoint | null = null;
	let refused: string | null = null;
	let plan: Plan | null = null;
	let commitInFlight = false;
	let metersPerCssPixel = 0.01;

	function releasePress(): void {
		if (press?.lease.kind === 'granted' && press.lease.lease.active) press.lease.lease.release();
		press = null;
	}

	function datumPoint(context: StageAdapterContext, css: readonly [number, number]): ShapePoint | null {
		const ray = context.ray([css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top]);
		if (ray === null) return null;
		const hit = context.intersect(ray, datumWorkingPlane(context.snapshot.domain.datumMeters));
		return hit.kind === 'intersected' ? { u: hit.worldPoint[0], v: hit.worldPoint[2] } : null;
	}

	function snapped(context: StageAdapterContext, point: ShapePoint): ShapePoint {
		const [u, v] = snapDraftingPoint([point.u, point.v], context.drafting());
		return { u, v };
	}

	function worldOf(context: StageAdapterContext, point: ShapePoint): Vec3 {
		return [point.u, context.snapshot.domain.datumMeters, point.v];
	}

	/** The one planner answer for one outline; `plan` is what preview and commit read. */
	function planFor(conversion: ShapeOutlineResult): Plan {
		if (conversion.kind === 'refused') return { conversion, candidate: null, refusal: conversion.message };
		const snapshot = services.stage.snapshot();
		const envelope = stageEnvelope(snapshot);
		const result = planCreateForm({
			context: {
				layout: envelope.units.layout.data,
				scene: envelope.units.scene.data,
				sourceContentId: snapshot.sourceContentId
			},
			entityId: PREVIEW_ENTITY_ID,
			plane: 'plan',
			outline: conversion.outline,
			extent: DEFAULT_SHAPE_HEIGHT_METERS,
			position: [0, 0, 0],
			yaw: 0,
			materialId: SHAPE_DEFAULT_MATERIAL,
			name: SHAPE_DEFAULT_NAME
		});
		return result.kind === 'candidate'
			? { conversion, candidate: result, refusal: null }
			: { conversion, candidate: null, refusal: result.message };
	}

	/** The outline the current pointer state would create, or `null` when none is proposed. */
	function liveConversion(): ShapeOutlineResult | null {
		const tile = hooks.tile();
		if (tile === 'free') {
			const drawn = press?.dragging && press.samples.length > 0
				? [...runs, press.samples.map((sample) => ({ u: sample.u, v: sample.v, smooth: true }))]
				: runs;
			return drawn.flat().length >= 3 ? freeOutline(drawn, metersPerCssPixel * SIMPLIFY_CSS_PX) : null;
		}
		if (pointer === null) return null;
		if (press?.dragging) return shapeOutline(tile, press.start, pointer);
		return standardOutline(tile, pointer);
	}

	function refresh(): void {
		const conversion = liveConversion();
		plan = conversion === null ? null : planFor(conversion);
		hooks.changed();
		services.stage.notifySurfaceChange();
	}

	async function commit(conversion: ShapeOutlineResult): Promise<string | null> {
		if (commitInFlight) return null;
		if (conversion.kind === 'refused') {
			refused = conversion.message;
			hooks.changed();
			services.stage.notifySurfaceChange();
			return null;
		}
		const checked = planFor(conversion);
		if (checked.candidate === null) {
			refused = checked.refusal;
			hooks.changed();
			services.stage.notifySurfaceChange();
			return null;
		}
		commitInFlight = true;
		const complete = hooks.beginCommit();
		const newId = globalThis.crypto.randomUUID();
		const snapshot = services.stage.snapshot();
		try {
			const outcome = await services.authoring.accept({
				version: 1,
				kind: 'create-form',
				operationId: globalThis.crypto.randomUUID(),
				expectedRevision: snapshot.acceptedRevision,
				targets: [],
				payload: {
					plane: 'plan',
					outline: conversion.outline,
					extent: DEFAULT_SHAPE_HEIGHT_METERS,
					position: [0, 0, 0],
					yaw: 0,
					materialId: SHAPE_DEFAULT_MATERIAL,
					name: SHAPE_DEFAULT_NAME
				},
				capturedInputs: [],
				allocatedIds: [{ kind: 'scene-entity', id: newId }]
			});
			if (outcome.kind !== 'installed') {
				refused = outcome.kind === 'refused' ? outcome.message : 'The form was not installed; try again.';
				hooks.changed();
				services.stage.notifySurfaceChange();
				return null;
			}
			runs = [];
			pointer = null;
			plan = null;
			refused = null;
			complete(newId);
			return newId;
		} finally {
			commitInFlight = false;
		}
	}

	function closeFree(): void {
		if (runs.flat().length === 0) return;
		const conversion = freeOutline(runs, metersPerCssPixel * SIMPLIFY_CSS_PX);
		void commit(conversion);
	}

	/** Whether a Stage-local point closes on the Free start. */
	function nearStart(context: StageAdapterContext, css: readonly [number, number], coarse: boolean): boolean {
		const start = runs[0]?.[0];
		if (start === undefined) return false;
		const projected = context.project(worldOf(context, start));
		if (projected === null) return false;
		const x = projected[0] - context.evaluation.rect.left;
		const y = projected[1] - context.evaluation.rect.top;
		return Math.hypot(css[0] - x, css[1] - y) <= (coarse ? CLOSE_COARSE_CSS_PX : CLOSE_CSS_PX);
	}

	function release(intent: StagePointerIntent, context: StageAdapterContext, current: Press): boolean {
		const travel = Math.hypot(intent.css[0] - current.css[0], intent.css[1] - current.css[1]);
		const raw = datumPoint(context, intent.css) ?? current.raw;
		const end = snapped(context, raw);
		const tile = hooks.tile();
		// Snapping can hold the start farther from the pointer than the close radius,
		// so landing on the start's own snapped point closes too.
		const first = runs[0]?.[0];
		const closes = nearStart(context, intent.css, intent.coarse === true) ||
			(first !== undefined && end.u === first.u && end.v === first.v);
		releasePress();
		refused = null;
		if (tile === 'free') {
			if (travel > TAP_TRAVEL_CSS_PX) {
				runs = [...runs, current.samples.map((sample) => ({ u: sample.u, v: sample.v, smooth: true }))];
				if (closes) closeFree();
				else refresh();
				return true;
			}
			if (closes && runs.flat().length >= 3) {
				closeFree();
				return true;
			}
			runs = [...runs, [sharp(current.start)]];
			pointer = current.start;
			refresh();
			return true;
		}
		const conversion = travel > TAP_TRAVEL_CSS_PX
			? shapeOutline(tile, current.start, end)
			: standardOutline(tile, current.start);
		void commit(conversion);
		pointer = null;
		refresh();
		return true;
	}

	return {
		pointer(intent, context) {
			metersPerCssPixel = context.evaluation.targetPlaneMetersPerCssPixel > 0
				? context.evaluation.targetPlaneMetersPerCssPixel
				: metersPerCssPixel;
			if (intent.phase === 'down') {
				const occluded = hooks.pressRefusal(context, intent.css);
				if (occluded !== null) {
					refused = occluded;
					hooks.changed();
					services.stage.notifySurfaceChange();
					return false;
				}
				const raw = datumPoint(context, intent.css);
				if (raw === null) {
					refused = 'That press does not land on the Stage datum.';
					hooks.changed();
					services.stage.notifySurfaceChange();
					return false;
				}
				const lease = services.stage.acquireGesture({
					owner: 'scene-draw',
					evaluationId: intent.evaluationId,
					policy: 'cancel-on-reading-change'
				});
				if (lease.kind !== 'granted') {
					refused = `The ${lease.owner} gesture owns the pointer; finish or cancel it first.`;
					hooks.changed();
					services.stage.notifySurfaceChange();
					return false;
				}
				const start = snapped(context, raw);
				press = {
					evaluationId: intent.evaluationId,
					lease,
					css: intent.css,
					start,
					raw,
					samples: [hooks.tile() === 'free' ? start : raw],
					dragging: false
				};
				pointer = start;
				refused = null;
				hooks.drawingStarted();
				refresh();
				return true;
			}
			const current = press;
			if (intent.phase === 'cancel') {
				releasePress();
				pointer = null;
				refresh();
				return true;
			}
			if (current === null) return false;
			if (intent.evaluationId !== current.evaluationId) {
				// A reading flip re-evaluated the projection; the press is stale.
				releasePress();
				pointer = null;
				refresh();
				return true;
			}
			if (intent.phase === 'up') return release(intent, context, current);
			const raw = datumPoint(context, intent.css);
			if (raw !== null) {
				pointer = snapped(context, raw);
				const travel = Math.hypot(intent.css[0] - current.css[0], intent.css[1] - current.css[1]);
				if (travel > TAP_TRAVEL_CSS_PX) current.dragging = true;
				if (current.dragging) current.samples.push(raw);
			}
			refresh();
			return true;
		},
		hover(intent, context) {
			if (press !== null) return false;
			const occluded = hooks.pressRefusal(context, intent.css);
			const raw = occluded === null ? datumPoint(context, intent.css) : null;
			const next = raw === null ? null : snapped(context, raw);
			if (next?.u === pointer?.u && next?.v === pointer?.v) return false;
			pointer = next;
			refused = null;
			refresh();
			return false;
		},
		key(intent) {
			if (intent.kind === 'finish') {
				if (hooks.tile() !== 'free' || runs.length === 0) return false;
				closeFree();
				return true;
			}
			if (intent.kind === 'backtrack') {
				if (runs.length === 0) return false;
				runs = runs.slice(0, -1);
				refused = null;
				refresh();
				return true;
			}
			if (intent.kind === 'cancel') {
				if (press === null && runs.length === 0) return false;
				releasePress();
				runs = [];
				refused = null;
				refresh();
				return true;
			}
			return false;
		},
		placeAt(x, z) {
			const tile = hooks.tile();
			if (tile === 'free') return Promise.resolve(null);
			return commit(standardOutline(tile, { u: x, v: z }));
		},
		finish() {
			closeFree();
		},
		canFinish() {
			return hooks.tile() === 'free' && runs.flat().length >= 3 && plan?.candidate != null;
		},
		overlay(context) {
			const words = refused ?? (press !== null || runs.length > 0 ? plan?.refusal ?? null : null);
			const at = pointer ?? (runs.flat().at(-1) ?? null);
			if (words === null || at === null) return [];
			const css = context.project(worldOf(context, at));
			return css === null ? [] : [{ id: 'scene-draw-refusal', css, label: words }];
		},
		ghosts() {
			const entity = plan?.candidate?.scene.entities.find((entry) => entry.id === PREVIEW_ENTITY_ID);
			if (entity?.kind !== 'form') return [];
			return [{
				id: 'scene-draw-preview',
				center: entity.position as Vec3,
				yaw: entity.rotation[1],
				shape: { kind: 'form', form: entity.form }
			}];
		},
		candidatePreview(context) {
			const tile = hooks.tile();
			const found = plan?.candidate?.scene.entities.find((entry) => entry.id === PREVIEW_ENTITY_ID);
			const entity = found?.kind === 'form' ? found : null;
			const segments: (readonly [Vec3, Vec3])[] = [];
			let label: DrawPreview['label'] = null;
			if (tile === 'free') {
				const drawn = runs.flat();
				for (let index = 1; index < drawn.length; index += 1) {
					segments.push([worldOf(context, drawn[index - 1]!), worldOf(context, drawn[index]!)]);
				}
				const last = drawn.at(-1);
				if (last !== undefined && pointer !== null) {
					segments.push([worldOf(context, last), worldOf(context, pointer)]);
					const dx = pointer.u - last.u;
					const dz = pointer.v - last.v;
					const length = Math.hypot(dx, dz);
					if (length >= MIN_SHAPE_EDGE_METERS) {
						const degrees = (Math.atan2(-dz, dx) * 180) / Math.PI;
						label = { world: worldOf(context, pointer), text: `${length.toFixed(2)} m · ${degrees.toFixed(0)}°` };
					}
				}
			} else if (press?.dragging && pointer !== null) {
				const width = Math.abs(pointer.u - press.start.u);
				const depth = Math.abs(pointer.v - press.start.v);
				label = { world: worldOf(context, pointer), text: `${width.toFixed(2)} × ${depth.toFixed(2)} m` };
			}
			if (entity === null && segments.length === 0 && label === null) return null;
			const invalid = plan !== null && plan.candidate === null;
			if (invalid && plan?.refusal != null && pointer !== null && (press !== null || runs.length > 0)) {
				label = { world: worldOf(context, pointer), text: plan.refusal };
			}
			return {
				entity,
				refused: invalid,
				segments,
				label,
				snap: pointer === null || context.drafting().snapSuspended || !context.drafting().snap
					? null
					: worldOf(context, pointer)
			};
		},
		hasWork() {
			return press !== null || runs.length > 0;
		},
		refusal() {
			return refused;
		},
		cancel() {
			releasePress();
			runs = [];
			pointer = null;
			plan = null;
			refused = null;
		}
	};
}
