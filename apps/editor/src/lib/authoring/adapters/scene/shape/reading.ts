/**
 * T5.P01.S02 — the Scene **Shape** reading of the one Ink Pen.
 *
 * Ink stays one tool. This module is the session a contributed reading owns:
 * it receives the pointer and command keys the open Ink task already receives,
 * converts a closed stroke into an outline, pulls the outline's depth, and
 * issues exactly one `create-form` intent. The Stage host owns the contribution
 * list; nothing here is document state, a second selection, history or writer.
 *
 * Two rules keep the preview honest:
 *
 * - **One planner.** Preview and Create both run `planCreateForm`, so the body
 *   drawn in the shared Canvas is the candidate the planner would install —
 *   recentring, winding, support and contact included.
 * - **One validation.** Live validity is `validateProfile` over the converted
 *   outline, and a refusal is the kernel's own issue in words. An invalid
 *   outline offers no Create and retains every point.
 *
 * Derived state (the conversion, its evaluated bounds and the planner's
 * candidate) is refreshed only when an input changes, never per palette frame:
 * a pointer hover repaints the marks, it does not re-plan the object.
 */
import {
	evaluateProfile
} from '@portfolio/geometry-core';
import type { Vec3, WorkingPlane } from '@portfolio/camera-core';
import {
	planCreateForm,
	type SceneOperationResult
} from '@portfolio/project-model/scene-planning';
import type { SceneFormPlane, SceneFormSource } from '@portfolio/project-model';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	datumWorkingPlane,
	type StageAdapterContext,
	type StageGhostMesh,
	type StageInkReadingSession,
	type StageKeyboardIntent,
	type StageOverlayContribution,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { parseExactNumber } from '$lib/authoring/exact-number';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { sceneEntityReference } from '../placement';
import {
	SHAPE_KINDS,
	flipUprightOutline,
	shapeOutline,
	type ShapeKind,
	type ShapeOutlineAnchor,
	type ShapePoint
} from './outline';
import { axisTravelFromRay } from './ray';

/** The material every native primitive is created with. */
export const SHAPE_DEFAULT_MATERIAL = 'plaster-warm' as const;
/** The creator-visible name pattern native primitives use: one plain noun. */
export const SHAPE_DEFAULT_NAME = 'Shape';
/** One upright Sheet the creator aligns by hand until T1's face-frame query lands. */
export type ShapeSheet = { readonly x: number; readonly z: number; readonly yaw: number };
export type ShapeReadingPlane = 'plan' | 'elevation';

export const DEFAULT_SHAPE_DEPTH_METERS = 1;

const PREVIEW_ENTITY_ID = 'shape-preview';
const MIN_DEPTH_METERS = 0.001;
const MAX_DEPTH_METERS = 100;
const TAP_TRAVEL_CSS_PX = 4;
const DEPTH_HANDLE_HIT_CSS_PX = 12;

export type ShapeReadingSnapshot = {
	readonly kind: ShapeKind;
	readonly plane: ShapeReadingPlane;
	readonly sheet: ShapeSheet;
	readonly phase: 'outline' | 'depth';
	readonly points: number;
	readonly canFinish: boolean;
	readonly canCreate: boolean;
	readonly depthText: string;
	readonly depth: number;
	readonly flip: boolean;
	readonly refusal: string | null;
	readonly outlineSize: string | null;
	readonly facts: readonly { readonly label: string; readonly value: string }[];
};

export type ShapeReadingController = {
	readonly setKind: (kind: ShapeKind) => void;
	readonly setPlane: (plane: ShapeReadingPlane) => void;
	readonly setSheet: (patch: Partial<ShapeSheet>) => void;
	readonly finish: () => void;
	readonly backtrack: () => void;
	readonly clear: () => void;
	readonly setDepth: (text: string) => void;
	readonly flip: () => void;
	readonly create: () => void;
};

export type ShapeReadingSurface = {
	snapshot(): ShapeReadingSnapshot;
	readonly controller: ShapeReadingController;
};

let published: { surface: ShapeReadingSurface; revision: number } | null = null;

export function shapeReadingSurface(): ShapeReadingSurface | null {
	return published?.surface ?? null;
}

export function shapeReadingSurfaceRevision(): number {
	return published?.revision ?? 0;
}

/** The plane a stroke is drawn on. The owner supplies the frame; Camera intersects it. */
export function shapeWorkingPlane(
	plane: ShapeReadingPlane,
	sheet: ShapeSheet,
	datumMeters: number
): WorkingPlane {
	if (plane === 'plan') return datumWorkingPlane(datumMeters);
	return {
		originMeters: [sheet.x, datumMeters, sheet.z],
		// Local +Z is the extrusion direction, exactly as an elevation form stores it.
		normal: [Math.sin(sheet.yaw), 0, Math.cos(sheet.yaw)],
		yawRadians: sheet.yaw + Math.PI / 2,
		datumMeters,
		supportedLocalExtent: null
	};
}

/** The sheet's local U axis in world space (the elevation form's local +X). */
export function shapeSheetRight(sheet: ShapeSheet): Vec3 {
	return [Math.cos(sheet.yaw), 0, -Math.sin(sheet.yaw)];
}

/** World point on the drawing plane -> sheet-local `(u, v)`. */
export function shapeLocalPoint(
	plane: ShapeReadingPlane,
	sheet: ShapeSheet,
	datumMeters: number,
	world: Vec3
): ShapePoint {
	if (plane === 'plan') return { u: world[0], v: world[2] };
	const right = shapeSheetRight(sheet);
	const dx = world[0] - sheet.x;
	const dz = world[2] - sheet.z;
	return { u: dx * right[0] + dz * right[2], v: world[1] - datumMeters };
}

type Candidate = Extract<SceneOperationResult, { kind: 'candidate' }>;

type Derived = {
	readonly conversion: ReturnType<typeof shapeOutline> | null;
	readonly bounds: ReturnType<typeof outlineBounds>;
	readonly candidate: Candidate | null;
	readonly plannerRefusal: string | null;
};

/**
 * One live Shape reading. The session is created by the Scene binding and
 * disposed by the Layout binding's task lifecycle; it owns no accepted source.
 */
export function createShapeReadingSession(
	services: StageAdapterServices
): StageInkReadingSession {
	let kind: ShapeKind = 'line';
	let plane: ShapeReadingPlane = 'plan';
	let sheet: ShapeSheet = { x: 0, z: 0, yaw: 0 };
	let points: ShapePoint[] = [];
	let phase: 'outline' | 'depth' = 'outline';
	let outline: readonly ShapeOutlineAnchor[] | null = null;
	let depthText = String(DEFAULT_SHAPE_DEPTH_METERS);
	let depth = DEFAULT_SHAPE_DEPTH_METERS;
	let flipSide = false;
	// A typed depth that failed to parse must not leave the previous value creatable.
	let depthValid = true;
	let refusal: string | null = null;
	let derived: Derived = {
		conversion: null,
		bounds: null,
		candidate: null,
		plannerRefusal: null
	};
	let hoverPoint: ShapePoint | null = null;
	let press: {
		readonly evaluationId: string;
		readonly lease: ReturnType<StageAdapterServices['stage']['acquireGesture']>;
		readonly css: readonly [number, number];
		readonly local: ShapePoint;
	} | null = null;
	let depthDrag: {
		readonly evaluationId: string;
		readonly lease: ReturnType<StageAdapterServices['stage']['acquireGesture']>;
	} | null = null;
	let disposed = false;

	const controller: ShapeReadingController = {
		setKind(next) {
			if (next === kind) return;
			kind = next;
			// The conversion changed; a locked outline no longer means what the points mean.
			if (phase === 'depth') resetToOutline();
			refusal = null;
			refresh();
		},
		setPlane(next) {
			if (next === plane) return;
			if (points.length > 0 || phase === 'depth') {
				refusal = 'Clear the live Shape before changing its sheet.';
				publish();
				services.stage.notifySurfaceChange();
				return;
			}
			plane = next;
			// Points are local to the plane they were drawn on; switching re-reads nothing.
			resetAll();
			refusal = null;
			refresh();
		},
		setSheet(patch) {
			const x = patch.x !== undefined && Number.isFinite(patch.x) ? patch.x : sheet.x;
			const z = patch.z !== undefined && Number.isFinite(patch.z) ? patch.z : sheet.z;
			const yaw = patch.yaw !== undefined && Number.isFinite(patch.yaw) ? patch.yaw : sheet.yaw;
			if (x === sheet.x && z === sheet.z && yaw === sheet.yaw) return;
			if (points.length > 0 || phase === 'depth') {
				refusal = 'Clear the live Shape before changing its sheet.';
				publish();
				services.stage.notifySurfaceChange();
				return;
			}
			sheet = { x, z, yaw };
			// A moved sheet no longer matches the drawn points' world positions.
			resetAll();
			refusal = null;
			refresh();
		},
		finish() {
			if (phase === 'depth') {
				void create();
				return;
			}
			finishOutline();
		},
		backtrack() {
			if (phase === 'depth') {
				resetToOutline();
				refusal = null;
				refresh();
				return;
			}
			if (points.length === 0) return;
			points = points.slice(0, -1);
			refusal = null;
			refresh();
		},
		clear() {
			resetAll();
			refusal = null;
			refresh();
		},
		setDepth(text) {
			const parsed = parseExactNumber(text, depth, (value) => String(value));
			if (!parsed.ok) {
				depthValid = false;
				refusal =
					parsed.reason === 'blank'
						? 'Enter a depth; an empty field is not zero.'
						: 'Depth must be finite.';
				publish();
				return;
			}
			if (parsed.value < MIN_DEPTH_METERS || parsed.value > MAX_DEPTH_METERS) {
				depthValid = false;
				refusal = `Depth must be between ${MIN_DEPTH_METERS} m and ${MAX_DEPTH_METERS} m.`;
				publish();
				return;
			}
			depth = parsed.value;
			depthValid = true;
			depthText = String(parsed.value);
			refusal = null;
			refresh();
		},
		flip() {
			if (plane !== 'elevation') {
				refusal = 'Flip side applies to an upright outline.';
				publish();
				return;
			}
			flipSide = !flipSide;
			refusal = null;
			refresh();
		},
		create() {
			void create();
		}
	};

	const surface: ShapeReadingSurface = { snapshot, controller };
	published = { surface, revision: (published?.revision ?? 0) + 1 };

	function snapshot(): ShapeReadingSnapshot {
		return {
			kind,
			plane,
			sheet,
			phase,
			points: points.length,
			canFinish: derived.conversion?.kind === 'outline',
			canCreate: phase === 'depth' && depthValid && derived.candidate !== null,
			depthText,
			depth,
			flip: flipSide,
			refusal: currentRefusal(),
			outlineSize:
				derived.bounds === null
					? null
					: `${derived.bounds.width.toFixed(3)} × ${derived.bounds.height.toFixed(3)} m`,
			facts: [
				{ label: 'Reading', value: 'Shape' },
				{
					label: 'Sheet',
					value:
						plane === 'plan'
							? 'Floor'
							: `Upright at ${sheet.x.toFixed(2)}, ${sheet.z.toFixed(2)} m · ${((sheet.yaw * 180) / Math.PI).toFixed(1)}°`
				},
				{ label: 'Material', value: SHAPE_DEFAULT_MATERIAL },
				{ label: 'Name', value: SHAPE_DEFAULT_NAME }
			]
		};
	}

	function publish(): void {
		if (disposed) return;
		published = { surface, revision: (published?.revision ?? 0) + 1 };
	}

	/** Recompute everything that only changes when an input changes, then publish. */
	function refresh(): void {
		derived = derive();
		publish();
		if (!disposed) services.stage.notifySurfaceChange();
	}

	/**
	 * The refusal the creator must see now: a typed complaint first, then an
	 * unreadable outline's own reason, then the planner's. An unreadable outline
	 * explains itself before the creator tries to close it; it stays uncreatable.
	 */
	function currentRefusal(): string | null {
		return (
			refusal ??
			(derived.conversion?.kind === 'refused'
				? derived.conversion.message
				: derived.plannerRefusal)
		);
	}

	function derive(): Derived {
		const conversion =
			phase === 'outline' && points.length > 0 ? shapeOutline(kind, points) : null;
		const activeOutline = phase === 'depth' ? outline : conversion?.kind === 'outline' ? conversion.outline : null;
		const bounds = activeOutline === null ? null : outlineBounds(activeOutline);
		let candidate: Candidate | null = null;
		let plannerRefusal: string | null = null;
		if (phase === 'depth' && activeOutline !== null) {
			const result = previewCandidate(services, payloadFor(activeOutline));
			if (result.kind === 'candidate') candidate = result;
			else plannerRefusal = result.message;
		}
		return { conversion, bounds, candidate, plannerRefusal };
	}

	function resetAll(): void {
		points = [];
		outline = null;
		phase = 'outline';
		hoverPoint = null;
		depth = DEFAULT_SHAPE_DEPTH_METERS;
		depthValid = true;
		depthText = String(DEFAULT_SHAPE_DEPTH_METERS);
		flipSide = false;
		releaseLeases();
	}

	function resetToOutline(): void {
		phase = 'outline';
		outline = null;
		hoverPoint = null;
		// The abandoned depth field may hold invalid text; restore the value that
		// is actually in effect so a later Finish cannot show a lie.
		depthText = String(depth);
		depthValid = true;
		releaseLeases();
	}

	function releaseLeases(): void {
		for (const current of [press, depthDrag]) {
			if (current?.lease.kind === 'granted' && current.lease.lease.active) {
				current.lease.lease.release();
			}
		}
		press = null;
		depthDrag = null;
	}

	function finishOutline(): void {
		if (derived.conversion === null || derived.conversion.kind === 'refused') {
			refusal =
				derived.conversion?.kind === 'refused'
					? derived.conversion.message
					: 'Name at least three points before closing the outline.';
			publish();
			return;
		}
		outline = derived.conversion.outline;
		phase = 'depth';
		refusal = null;
		refresh();
	}

	/** The create payload for the current outline, depth and flip. */
	function payloadFor(outlineSource: readonly ShapeOutlineAnchor[]): {
		readonly plane: SceneFormPlane;
		readonly outline: readonly ShapeOutlineAnchor[];
		readonly extent: number;
		readonly position: Vec3;
		readonly yaw: number;
	} {
		const mirrored = plane === 'elevation' && flipSide;
		return {
			plane,
			outline: mirrored ? flipUprightOutline(outlineSource) : outlineSource,
			extent: depth,
			position: plane === 'plan' ? [0, 0, 0] : [sheet.x, 0, sheet.z],
			yaw: plane === 'elevation' ? sheet.yaw + (mirrored ? Math.PI : 0) : 0
		};
	}

	/** The preview candidate's form source and pose, when the planner accepts it. */
	function previewBody(): {
		readonly source: SceneFormSource;
		readonly position: Vec3;
		readonly yaw: number;
	} | null {
		const candidate = derived.candidate;
		if (candidate === null) return null;
		const entity = candidate.scene.entities.find((entry) => entry.id === PREVIEW_ENTITY_ID);
		if (entity?.kind !== 'form') return null;
		return { source: entity.form, position: entity.position as Vec3, yaw: entity.rotation[1] };
	}

	async function create(): Promise<void> {
		if (phase !== 'depth' || outline === null) {
			refusal = 'Close the outline before creating the body.';
			publish();
			return;
		}
		// A depth field that failed to parse leaves the previous number on screen;
		// that number is not what the creator asked for, so it cannot be committed.
		if (!depthValid) {
			refusal ??= 'Enter a valid depth before creating the body.';
			publish();
			return;
		}
		if (derived.candidate === null) {
			refusal = derived.plannerRefusal ?? 'The body cannot be created here.';
			publish();
			return;
		}
		const payload = payloadFor(outline);
		const newId = globalThis.crypto.randomUUID();
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept({
			version: 1,
			kind: 'create-form',
			operationId: globalThis.crypto.randomUUID(),
			expectedRevision: snapshot.acceptedRevision,
			targets: [],
			payload: {
				plane: payload.plane,
				outline: payload.outline,
				extent: payload.extent,
				position: payload.position,
				yaw: payload.yaw,
				materialId: SHAPE_DEFAULT_MATERIAL,
				name: SHAPE_DEFAULT_NAME
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-entity', id: newId }]
		});
		if (outcome.kind === 'refused') {
			refusal = outcome.message;
			publish();
			return;
		}
		if (outcome.kind === 'installed') {
			const reference = sceneEntityReference(
				newId,
				services.stage.snapshot().domain.unitRevisions.scene
			);
			services.stage.setSelection({ ordered: [{ reference }], primary: reference });
		} else {
			refusal = 'The form was not installed; try again.';
			publish();
			return;
		}
		resetAll();
		refusal = null;
		refresh();
	}

	function planeFor(context: StageAdapterContext): WorkingPlane {
		return shapeWorkingPlane(plane, sheet, context.snapshot.domain.datumMeters);
	}

	/** Stage pointer intents are surface-local CSS; Camera rays are viewport CSS. */
	function rayAt(context: StageAdapterContext, css: readonly [number, number]) {
		return context.ray([
			css[0] + context.evaluation.rect.left,
			css[1] + context.evaluation.rect.top
		]);
	}

	function pointAt(
		context: StageAdapterContext,
		css: readonly [number, number]
	): ShapePoint | null {
		const ray = rayAt(context, css);
		if (ray === null) return null;
		const hit = context.intersect(ray, planeFor(context));
		if (hit.kind !== 'intersected') return null;
		return shapeLocalPoint(plane, sheet, context.snapshot.domain.datumMeters, hit.worldPoint);
	}

	/** The world point of a local point, for overlays and the depth ray. */
	function worldOf(context: StageAdapterContext, point: ShapePoint): Vec3 {
		const datum = context.snapshot.domain.datumMeters;
		if (plane === 'plan') return [point.u, datum, point.v];
		const right = shapeSheetRight(sheet);
		return [sheet.x + right[0] * point.u, datum + point.v, sheet.z + right[2] * point.u];
	}

	/** The outline's mid-depth anchor and normal, for the depth handle. */
	function depthAxis(context: StageAdapterContext):
		| { readonly base: Vec3; readonly normal: Vec3; readonly handle: Vec3 }
		| null {
		if (outline === null || derived.bounds === null) return null;
		const bounds = derived.bounds;
		const datum = context.snapshot.domain.datumMeters;
		if (plane === 'plan') {
			const base: Vec3 = [bounds.centreU, datum, bounds.centreV];
			const normal: Vec3 = [0, 1, 0];
			return { base, normal, handle: [base[0], base[1] + depth, base[2]] };
		}
		const right = shapeSheetRight(sheet);
		// The planner rests the form's lowest point on the floor, so the handle's
		// height is the body's midpoint, not the drawn V centre.
		const base: Vec3 = [
			sheet.x + right[0] * bounds.centreU,
			datum + bounds.height / 2,
			sheet.z + right[2] * bounds.centreU
		];
		// Flip side turns the extrusion to the other side of the sheet, so the
		// handle and its ray must sit on the side the body will occupy.
		const sign = flipSide ? -1 : 1;
		const normal: Vec3 = [Math.sin(sheet.yaw) * sign, 0, Math.cos(sheet.yaw) * sign];
		return {
			base,
			normal,
			handle: [
				base[0] + normal[0] * depth,
				base[1] + normal[1] * depth,
				base[2] + normal[2] * depth
			]
		};
	}

	/** Overlay contributions publish viewport CSS; the host translates once to the Stage. */
	function project(context: StageAdapterContext, world: Vec3): readonly [number, number] | null {
		return context.project(world);
	}

	/** Pointer intents are Stage-local pixels; hit tests compare against this space. */
	function projectStage(context: StageAdapterContext, world: Vec3): readonly [number, number] | null {
		const css = project(context, world);
		return css === null ? null : [css[0] - context.evaluation.rect.left, css[1] - context.evaluation.rect.top];
	}

	/**
	 * Plan removes screen travel only when the extruded floor normal points at the
	 * camera. An upright Shape extrudes horizontally, so its world handle still
	 * projects a usable offset even while the camera is in Plan.
	 */
	function usesPlanScreenDepth(context: StageAdapterContext): boolean {
		return context.evaluation.settledReading === 'plan' && plane === 'plan';
	}

	/**
	 * The depth handle's viewport CSS.
	 *
	 * In 3D, and for an upright Shape even in Plan, the handle is the world point
	 * along the depth axis. On the floor in Plan the floor normal points at the
	 * camera, so that world point projects onto the outline's centre and a drag
	 * would have no screen travel. That handle is therefore offset up-screen by
	 * its depth at the evaluated target-plane scale: the pull has visible
	 * feedback, and the same offset is what the hit test uses.
	 */
	function depthHandle(context: StageAdapterContext): readonly [number, number] | null {
		const axis = depthAxis(context);
		if (axis === null) return null;
		if (!usesPlanScreenDepth(context)) return project(context, axis.handle);
		const base = project(context, axis.base);
		if (base === null) return null;
		const metersPerPixel = context.evaluation.targetPlaneMetersPerCssPixel;
		if (!(metersPerPixel > 0)) return base;
		return [base[0], base[1] - depth / metersPerPixel];
	}

	/** The same handle point in Stage-local CSS, the space pointer intents use. */
	function depthHandleStage(context: StageAdapterContext): readonly [number, number] | null {
		const css = depthHandle(context);
		return css === null ? null : [css[0] - context.evaluation.rect.left, css[1] - context.evaluation.rect.top];
	}

	/** Where the pointer ray passes closest to the depth axis, as a positive depth. */
	function depthFromRay(context: StageAdapterContext, css: readonly [number, number]): number | null {
		const axis = depthAxis(context);
		if (axis === null) return null;
		if (usesPlanScreenDepth(context)) {
			// The Plan camera looks down the floor normal: its rays are parallel to
			// the depth axis and have no closest approach. The handle is a screen-space
			// pull, so its vertical travel is the depth at the same target-plane scale.
			const base = projectStage(context, axis.base);
			const metersPerPixel = context.evaluation.targetPlaneMetersPerCssPixel;
			if (base === null || !(metersPerPixel > 0)) return null;
			const along = (base[1] - css[1]) * metersPerPixel;
			return Math.min(MAX_DEPTH_METERS, Math.max(MIN_DEPTH_METERS, along));
		}
		const ray = rayAt(context, css);
		if (ray === null) return null;
		// The drawing plane itself is perpendicular to the axis, so intersecting it
		// would always report zero. The knob lives anywhere along the axis: use the
		// line/line closest point instead.
		const along = axisTravelFromRay({
			origin: axis.base,
			direction: axis.normal,
			rayOrigin: ray.origin,
			rayDirection: ray.direction
		});
		if (along === null) return null;
		return Math.min(MAX_DEPTH_METERS, Math.max(MIN_DEPTH_METERS, along));
	}

	const session: StageInkReadingSession = {
		pointer(intent, context) {
			if (intent.phase === 'down') {
				if (phase === 'depth') {
					const handle = depthHandleStage(context);
					const distance =
						handle === null
							? Infinity
							: Math.hypot(intent.css[0] - handle[0], intent.css[1] - handle[1]);
					if (handle === null || distance > DEPTH_HANDLE_HIT_CSS_PX) {
						// The depth handle is the only direct-manipulation target in this phase;
						// an empty press stays with Stage navigation.
						return false;
					}
					const lease = services.stage.acquireGesture({
						owner: 'scene-shape',
						evaluationId: intent.evaluationId,
						policy: 'cancel-on-reading-change'
					});
					if (lease.kind !== 'granted') {
						refusal = `The ${lease.owner} gesture owns the pointer; finish or cancel it first.`;
						publish();
						return false;
					}
					depthDrag = { evaluationId: intent.evaluationId, lease };
					return true;
				}
				const local = pointAt(context, intent.css);
				if (local === null) {
					refusal = 'That press does not land on the drawing plane.';
					publish();
					return false;
				}
				const lease = services.stage.acquireGesture({
					owner: 'scene-shape',
					evaluationId: intent.evaluationId,
					policy: 'cancel-on-reading-change'
				});
				if (lease.kind !== 'granted') {
					refusal = `The ${lease.owner} gesture owns the pointer; finish or cancel it first.`;
					publish();
					return false;
				}
				press = { evaluationId: intent.evaluationId, lease, css: intent.css, local };
				hoverPoint = local;
				publish();
				return true;
			}
			if (intent.phase === 'cancel') {
				releaseLeases();
				hoverPoint = null;
				publish();
				services.stage.notifySurfaceChange();
				return true;
			}
			if (depthDrag !== null) {
				if (intent.phase === 'move') {
					if (intent.evaluationId !== depthDrag.evaluationId) {
						// A reading flip measured the drag in a projection that is gone.
						releaseLeases();
						refusal = 'The reading changed; pull the depth again.';
						publish();
						return true;
					}
					const next = depthFromRay(context, intent.css);
					if (next !== null) {
						depth = next;
						// The handle named a valid depth: it supersedes invalid typed text.
						depthValid = true;
						depthText = String(next);
						refusal = null;
						refresh();
						return true;
					}
					publish();
					return true;
				}
				releaseLeases();
				refresh();
				return true;
			}
			const current = press;
			if (current === null) return false;
			if (intent.evaluationId !== current.evaluationId) {
				// A reading flip re-evaluated the projection; the press is stale.
				releaseLeases();
				hoverPoint = null;
				publish();
				return true;
			}
			if (intent.phase === 'move') {
				const local = pointAt(context, intent.css);
				if (local !== null) hoverPoint = local;
				publish();
				return true;
			}
			const release = pointAt(context, intent.css) ?? current.local;
			const travel = Math.hypot(intent.css[0] - current.css[0], intent.css[1] - current.css[1]);
			press = null;
			hoverPoint = null;
			if (current.lease.kind === 'granted' && current.lease.lease.active) {
				current.lease.lease.release();
			}
			points = [...points, current.local];
			if (travel > TAP_TRAVEL_CSS_PX) points = [...points, release];
			refusal = null;
			refresh();
			return true;
		},
		hover(intent, context) {
			if (phase !== 'outline') return false;
			const local = pointAt(context, intent.css);
			if (local === null) {
				if (hoverPoint === null) return false;
				hoverPoint = null;
				publish();
				return true;
			}
			hoverPoint = local;
			publish();
			return true;
		},
		key(intent: StageKeyboardIntent) {
			if (intent.kind === 'finish') {
				if (phase === 'depth') {
					void create();
					return true;
				}
				if (points.length < 2) return false;
				finishOutline();
				return true;
			}
			if (intent.kind === 'backtrack') {
				controller.backtrack();
				return true;
			}
			if (intent.kind === 'cancel') {
				if (points.length === 0 && phase === 'outline') return false;
				resetAll();
				refusal = null;
				refresh();
				return true;
			}
			return false;
		},
		hasWork() {
			return points.length > 0 || phase === 'depth';
		},
		cancel() {
			disposed = true;
			releaseLeases();
			if (published?.surface === surface) published = null;
			points = [];
			outline = null;
			hoverPoint = null;
			refusal = null;
			phase = 'outline';
		},
		taskClosed() {
			releaseLeases();
		},
		overlay(context): readonly StageOverlayContribution[] {
			const markers: StageOverlayContribution[] = [];
			if (phase === 'outline') {
				points.forEach((point, index) => {
					const css = project(context, worldOf(context, point));
					if (css === null) return;
					markers.push({
						id: `scene-shape-point-${index}`,
						css,
						label:
							index === 0
								? `Shape start — ${
										kind === 'box' || kind === 'round'
											? 'click the opposite corner'
											: 'click the next point'
									}`
								: `Shape point ${index + 1}`
					});
				});
				if (hoverPoint !== null) {
					const css = project(context, worldOf(context, hoverPoint));
					if (css !== null) {
						markers.push({ id: 'scene-shape-hover', css, label: 'Next Shape point' });
					}
				}
			} else {
				const handle = depthHandle(context);
				if (handle !== null) {
					markers.push({
						id: 'scene-shape-depth',
						css: handle,
						label: `Depth ${depth.toFixed(3)} m — drag along the ray or type it`
					});
				}
			}
			const liveRefusal = currentRefusal();
			if (liveRefusal !== null) {
				const anchor =
					hoverPoint !== null
						? project(context, worldOf(context, hoverPoint))
						: points.length > 0
							? project(context, worldOf(context, points[points.length - 1]!))
							: derived.bounds !== null
								? project(
										context,
										plane === 'plan'
											? [derived.bounds.centreU, context.snapshot.domain.datumMeters, derived.bounds.centreV]
											: [
													sheet.x + shapeSheetRight(sheet)[0] * derived.bounds.centreU,
													context.snapshot.domain.datumMeters + derived.bounds.centreV,
													sheet.z + shapeSheetRight(sheet)[2] * derived.bounds.centreU
												]
									)
								: null;
				if (anchor !== null) {
					markers.push({
						id: 'scene-shape-refusal',
						css: anchor,
						label: liveRefusal
					});
				}
			}
			return markers;
		},
		ghosts(): readonly StageGhostMesh[] {
			if (phase !== 'depth') return [];
			const body = previewBody();
			if (body === null) return [];
			return [
				{
					id: 'scene-shape-preview',
					center: body.position,
					yaw: body.yaw,
					shape: { kind: 'form', form: body.source }
				}
			];
		}
	};

	return session;
}

function previewCandidate(
	services: StageAdapterServices,
	input: {
		readonly plane: SceneFormPlane;
		readonly outline: readonly ShapeOutlineAnchor[];
		readonly extent: number;
		readonly position: Vec3;
		readonly yaw: number;
	}
): SceneOperationResult {
	const snapshot = services.stage.snapshot();
	const envelope = stageEnvelope(snapshot);
	return planCreateForm({
		context: {
			layout: envelope.units.layout.data,
			scene: envelope.units.scene.data,
			sourceContentId: snapshot.sourceContentId
		},
		entityId: PREVIEW_ENTITY_ID,
		plane: input.plane,
		outline: input.outline,
		extent: input.extent,
		position: input.position,
		yaw: input.yaw,
		materialId: SHAPE_DEFAULT_MATERIAL,
		name: SHAPE_DEFAULT_NAME
	});
}

function outlineBounds(outline: readonly ShapeOutlineAnchor[]): {
	readonly width: number;
	readonly height: number;
	readonly centreU: number;
	readonly centreV: number;
} | null {
	try {
		const evaluated = evaluateProfile(
			outline.map((anchor, index) => ({
				key: index + 1,
				u: anchor.u,
				v: anchor.v,
				smooth: anchor.smooth
			}))
		);
		return {
			width: evaluated.bounds.maxU - evaluated.bounds.minU,
			height: evaluated.bounds.maxV - evaluated.bounds.minV,
			centreU: (evaluated.bounds.minU + evaluated.bounds.maxU) / 2,
			centreV: (evaluated.bounds.minV + evaluated.bounds.maxV) / 2
		};
	} catch {
		return null;
	}
}

/** Kept beside the session so the palette can name every kind without importing the kernel. */
export { SHAPE_KINDS };
export type { ShapeOutlineAnchor, ShapeKind, ShapePoint };
