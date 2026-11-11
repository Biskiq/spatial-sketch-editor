/**
 * T2.S3 — the Light domain adapter.
 *
 * The Scene adapter owns the Scene planners and the camera-free model; this
 * adapter owns only the light surface: light subjects and picking, the
 * session's one placement arm, the body/aim/reach/beam marks, the Card and the
 * Stage guide. It writes only through the registered `create-light`,
 * `update-light` and `duplicate-light` planners; it never edits the Scene.
 *
 * A spot's target mark is a fixed 1.5 m aim point and its cutoff is a separate
 * reach. Creation places the body 0.02 m along the pressed surface's normal and
 * puts the authored cutoff 0.5 m beyond the released target, so the target sits
 * inside the cone rather than on a zero-attenuation cutoff.
 */
import type { SceneEntity, SceneLightEntity, Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterServices,
	StageReadSnapshot
} from '$lib/authoring/stage/stage-adapter-host';
import type {
	StageAdapter,
	StageAdapterContext,
	StageAdapterFactory,
	StageCardAction,
	StageCandidatePreview,
	StageCardFact,
	StageCardSubject,
	StageHandleDescriptor,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import { sceneEntityReference } from './scene/placement';
import { acceptFormCommand } from './scene/form-card-command';
import { armedLightKind, clearArmedLight } from '../look/light-tool.svelte';
import {
	LIGHT_AIM_GUIDE_METERS,
	lightForward,
	LIGHT_GUIDE_MAX_ANGLE,
	rotationForLightDirection,
	spotConeGuide
} from '../look/light-aim';
import {
	formatBrightness,
	lightKindLabel,
	LIGHT_INTENSITY_REFERENCE,
	radiansToDegrees,
	spotCutoffForTargetDistance
} from '../look/light-units';
import {
	artworkLightBounds,
	horizontalFront,
	pictureSpotRecipe,
	unionLightItBounds,
	washRecipe,
	type LightItBounds,
	type LightItRecipeOutcome
} from '../look/light-recipes';
import LightCardFields from './light/LightCardFields.svelte';

const LIGHT_TASK = 'light-place';
const LIGHT_PICK_CSS = 18;
const LIGHT_DEFAULT_SPOT_ANGLE = Math.PI / 6;
const LIGHT_SURFACE_STANDOFF_METERS = 0.02;
const LIGHT_WORKING_HEIGHT_METERS = 1.5;
const LIGHT_PLACEMENT_DRAG_CSS = 4;

type Light = SceneLightEntity;
type GestureKind =
	| 'move'
	| 'aim'
	| 'range'
	| 'angle'
	| 'penumbra'
	| 'azimuth'
	| 'elevation';

type Gesture = {
	readonly kind: GestureKind;
	readonly entity: Light;
	/** Point Reach ring: datum when the sphere reaches it, otherwise light height. */
	readonly pointRangePlaneY?: number;
};

/** Stage pointer intent coordinates are local; Camera rays include the surface offset. */
function viewportCss(
	css: readonly [number, number],
	context: StageAdapterContext
): [number, number] {
	return [css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top];
}

type Placement = {
	readonly startCss: readonly [number, number];
	/** The body: the surface hit plus 0.02 m along its normal, or working height. */
	readonly body: Vec3;
	readonly normal: Vec3;
	target: Vec3;
	moved: boolean;
};

function isLight(entity: { readonly kind?: string } | undefined): entity is Light {
	return entity?.kind === 'light';
}

function selectedLight(context: StageAdapterContext): Light | null {
	const selection = context.selectionState().primary;
	if (selection === null || selection.domain !== 'scene') return null;
	if (selection.subject.kind !== 'entity') return null;
	const entity = stageScene(context.snapshot).entities.find(
		(candidate) => candidate.id === selection.subject.id
	);
	return isLight(entity) ? entity : null;
}

/** A range is optional on point/spot and absent on directional; one accessor. */
function lightRange(light: Light): number | undefined {
	return 'range' in light ? light.range : undefined;
}

function lightById(snapshot: StageReadSnapshot, id: string): Light | null {
	const entity = stageScene(snapshot).entities.find((candidate) => candidate.id === id);
	return isLight(entity) ? entity : null;
}

/** The light glyph under a Stage-local point, using the same 18 px target as selection. */
function lightGlyphAt(
	css: readonly [number, number],
	context: StageAdapterContext
): { readonly light: Light; readonly distance: number } | null {
	const viewport = viewportCss(css, context);
	const candidates: { readonly light: Light; readonly distance: number }[] = [];
	for (const entity of stageScene(context.snapshot).entities.filter(isLight)) {
		const projected = context.project(entity.position);
		if (projected === null) continue;
		const distance = Math.hypot(projected[0] - viewport[0], projected[1] - viewport[1]);
		if (distance <= LIGHT_PICK_CSS) candidates.push({ light: entity, distance });
	}
	if (candidates.length === 0) return null;
	const ray = context.ray(viewport);
	const occluder = ray === null ? null : context.pickScene(ray);
	let nearest: { readonly light: Light; readonly distance: number } | null = null;
	for (const candidate of candidates) {
		const { light } = candidate;
		if (
			ray !== null &&
			occluder !== null &&
			!(occluder.kind === 'entity' && occluder.entityId === light.id)
		) {
			const depth = dot(sub(light.position, ray.origin), ray.direction);
			if (depth > 0 && occluder.distanceMeters < depth - LIGHT_SURFACE_STANDOFF_METERS) {
				continue;
			}
		}
		if (nearest === null || candidate.distance < nearest.distance) nearest = candidate;
	}
	return nearest;
}

function nextEntityName(snapshot: StageReadSnapshot, base: string): string {
	const names = new Set(stageScene(snapshot).entities.map((entity) => entity.name));
	if (!names.has(base)) return base;
	for (let index = 2; index < 10_000; index += 1) {
		const candidate = `${base} ${index}`;
		if (!names.has(candidate)) return candidate;
	}
	return `${base} ${Date.now()}`;
}

function nextLightName(snapshot: StageReadSnapshot, kind: Light['light']): string {
	return nextEntityName(snapshot, lightKindLabel(kind));
}

function entityById(snapshot: StageReadSnapshot, id: string): SceneEntity | null {
	return stageScene(snapshot).entities.find((candidate) => candidate.id === id) ?? null;
}

function cloneLight(light: Light): Light {
	return {
		...light,
		position: [...light.position] as Vec3,
		rotation: [...light.rotation] as Vec3
	} as Light;
}

function pointOf(ray: { origin: Vec3; direction: Vec3 }, planeY: number): Vec3 | null {
	const denominator = ray.direction[1];
	if (Math.abs(denominator) < 1e-9) return null;
	const distance = (planeY - ray.origin[1]) / denominator;
	if (!(distance > 0) || !Number.isFinite(distance)) return null;
	return [
		ray.origin[0] + ray.direction[0] * distance,
		planeY,
		ray.origin[2] + ray.direction[2] * distance
	];
}

function horizontalDistance(from: Vec3, to: Vec3): number {
	return Math.hypot(to[0] - from[0], to[2] - from[2]);
}

function distance(from: Vec3, to: Vec3): number {
	return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
}

function dot(left: Vec3, right: Vec3): number {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function sub(left: Vec3, right: Vec3): Vec3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scale(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function normalize(value: Vec3): Vec3 {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-9)) return [0, -1, 0];
	return [value[0] / length, value[1] / length, value[2] / length];
}

function rayPlane(ray: { origin: Vec3; direction: Vec3 }, point: Vec3, normal: Vec3): Vec3 | null {
	const denominator = dot(ray.direction, normal);
	if (Math.abs(denominator) < 1e-9) return null;
	const t = dot(sub(point, ray.origin), normal) / denominator;
	if (!(t > 0) || !Number.isFinite(t)) return null;
	return add(ray.origin, scale(ray.direction, t));
}

/**
 * Closest point on the light's forward axis to the pointer ray.
 *
 * Reach is an axis extent. A plane through the light perpendicular to forward
 * would project to one point on that plane and can never produce a length.
 */
function closestAxisPoint(
	ray: { origin: Vec3; direction: Vec3 },
	origin: Vec3,
	axis: Vec3
): { readonly point: Vec3; readonly distanceAlongAxis: number } | null {
	const w0 = sub(origin, ray.origin);
	const a = dot(ray.direction, ray.direction);
	const b = dot(ray.direction, axis);
	const c = dot(axis, axis);
	const d = dot(ray.direction, w0);
	const e = dot(axis, w0);
	const denominator = a * c - b * b;
	if (Math.abs(denominator) < 1e-9) return null;
	const distanceAlongAxis = (b * d - a * e) / denominator;
	return {
		point: add(origin, scale(axis, distanceAlongAxis)),
		distanceAlongAxis
	};
}

function lightAngles(rotation: Vec3): { readonly azimuth: number; readonly elevation: number } {
	const forward = lightForward(rotation);
	return {
		azimuth: Math.atan2(-forward[0], -forward[2]),
		elevation: Math.asin(clamp(forward[1], -1, 1))
	};
}

function directionForAngles(azimuth: number, elevation: number): Vec3 {
	const horizontal = Math.cos(elevation);
	return normalize([
		-Math.sin(azimuth) * horizontal,
		Math.sin(elevation),
		-Math.cos(azimuth) * horizontal
	]);
}

function lightPayload(light: Light) {
	return {
		light: light.light,
		name: light.name,
		color: light.color,
		intensity: light.intensity,
		castShadow: light.castShadow,
		position: [...light.position],
		rotation: [...light.rotation],
		...(light.light === 'spot'
			? {
					angle: light.angle,
					...(lightRange(light) === undefined ? {} : { range: lightRange(light)! }),
					...(light.penumbra === undefined ? {} : { penumbra: light.penumbra })
				}
			: light.light === 'point'
				? { ...(lightRange(light) === undefined ? {} : { range: lightRange(light)! }) }
				: {})
	};
}

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

type SceneBounds = { readonly min: Vec3; readonly max: Vec3 };

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function nearestPointInBounds(point: Vec3, bounds: SceneBounds): Vec3 {
	return [
		clamp(point[0], bounds.min[0], bounds.max[0]),
		clamp(point[1], bounds.min[1], bounds.max[1]),
		clamp(point[2], bounds.min[2], bounds.max[2])
	];
}

function boundsCorners(bounds: SceneBounds): Vec3[] {
	return [
		[bounds.min[0], bounds.min[1], bounds.min[2]],
		[bounds.min[0], bounds.min[1], bounds.max[2]],
		[bounds.min[0], bounds.max[1], bounds.min[2]],
		[bounds.min[0], bounds.max[1], bounds.max[2]],
		[bounds.max[0], bounds.min[1], bounds.min[2]],
		[bounds.max[0], bounds.min[1], bounds.max[2]],
		[bounds.max[0], bounds.max[1], bounds.min[2]],
		[bounds.max[0], bounds.max[1], bounds.max[2]]
	];
}

/** A light illuminates an object only when it reaches its bounds, not its centre. */
function illuminates(light: Light, bounds: SceneBounds): boolean {
	if (light.light === 'directional') return true;
	const range = lightRange(light);
	if (light.light === 'point') {
		if (range === undefined) return true;
		return distance(light.position, nearestPointInBounds(light.position, bounds)) <= range;
	}
	return boundsCorners(bounds).some((corner) => {
		if (range !== undefined && distance(light.position, corner) > range) return false;
		const direction = lightForward(light.rotation);
		const toPoint = sub(corner, light.position);
		const distanceAlong = dot(toPoint, direction);
		if (!(distanceAlong > 0)) return false;
		const perpendicular = Math.hypot(
			toPoint[0] - direction[0] * distanceAlong,
			toPoint[1] - direction[1] * distanceAlong,
			toPoint[2] - direction[2] * distanceAlong
		);
		return Math.atan2(perpendicular, distanceAlong) <= light.angle;
	});
}

type LightItSelectionRecipe = LightItRecipeOutcome;

/**
 * S7's selection recipe: one Picture spot for one Artwork, otherwise one Wash
 * over the union of every selected subject's evaluated bounds. A multi-selection
 * never produces one light per object, and a light in the selection is refused
 * rather than silently ignored.
 */
function lightItSelectionRecipe(services: StageAdapterServices): LightItSelectionRecipe {
	const snapshot = services.stage.snapshot();
	const selection = services.stage.selectionState();
	if (selection.ordered.length === 0) {
		return { kind: 'refused', message: 'Select Artwork or an object before using Light it.' };
	}
	const targets: { readonly entity: SceneEntity; readonly bounds: LightItBounds }[] = [];
	for (const entry of selection.ordered) {
		if (entry.reference.domain !== 'scene' || entry.reference.subject.kind !== 'entity') {
			return {
				kind: 'refused',
				message: 'Light it works on Scene Artwork and objects, not on that selection.'
			};
		}
		const entity = entityById(snapshot, entry.reference.subject.id);
		if (entity === null) {
			return { kind: 'refused', message: 'A selected subject is no longer in this Scene.' };
		}
		if (entity.kind === 'light') {
			return { kind: 'refused', message: 'A light cannot be lit; select Artwork or an object.' };
		}
		const bounds =
			entity.kind === 'artwork'
				? artworkLightBounds(entity)
				: services.stage.sceneBounds(entity.id);
		if (bounds === null) {
			return { kind: 'refused', message: `${entity.name} has no evaluated bounds yet.` };
		}
		targets.push({ entity, bounds });
	}
	const primaryId = selection.primary?.subject.id;
	const primary = targets.find((target) => target.entity.id === primaryId) ?? targets[0]!;
	if (targets.length === 1 && primary.entity.kind === 'artwork') {
		return pictureSpotRecipe(primary.entity);
	}
	const bounds = unionLightItBounds(targets.map((target) => target.bounds));
	if (bounds === null) {
		return { kind: 'refused', message: 'The selection has no bounds to light.' };
	}
	return washRecipe({ bounds, front: horizontalFront(primary.entity.rotation) });
}

function lightItDetail(entity: SceneEntity, selectedCount: number): string {
	if (selectedCount > 1) {
		return 'Places one Wash covering every selected subject. It is not grouped. One undo.';
	}
	return entity.kind === 'artwork'
		? 'Places a Picture spot 1.4 m in front and 30° above, fitted to the Artwork. It is not grouped. One undo.'
		: 'Places a Wash fitted to the object’s evaluated bounds. It is not grouped. One undo.';
}

function lightItAction(
	services: StageAdapterServices,
	subject: StageCardSubject
): StageCardAction | null {
	if (subject.reference?.domain !== 'scene') return null;
	const snapshot = services.stage.snapshot();
	const entity = entityById(snapshot, subject.sourceId);
	if (entity === null || entity.kind === 'light') return null;
	const selectedCount = services.stage.selectionState().ordered.length;
	return {
		id: 'light-it',
		label: 'Light it',
		detail: lightItDetail(entity, selectedCount),
		async run() {
			const prepared = lightItSelectionRecipe(services);
			if (prepared.kind === 'refused') return { kind: 'refused', message: prepared.message };
			const live = services.stage.snapshot();
			const allocatedId = `light-${crypto.randomUUID()}`;
			const { recipe } = prepared;
			let outcome: Awaited<ReturnType<typeof services.authoring.accept>>;
			try {
				outcome = await services.authoring.accept({
					version: 1,
					kind: 'create-light',
					operationId: crypto.randomUUID(),
					expectedRevision: live.acceptedRevision,
					targets: [],
					payload: {
						light: 'spot',
						name: nextEntityName(live, recipe.name),
						color: recipe.color,
						intensity: recipe.intensity,
						castShadow: recipe.castShadow,
						position: [...recipe.position],
						rotation: [...recipe.rotation],
						angle: recipe.angle,
						range: recipe.range
					} as never,
					capturedInputs: [],
					allocatedIds: [{ kind: 'scene-entity', id: allocatedId }]
				});
			} finally {
				services.stage.notifySurfaceChange();
			}
			if (outcome.kind === 'installed') {
				const reference = sceneEntityReference(
					allocatedId,
					services.stage.snapshot().domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				return { kind: 'accepted' };
			}
			return outcome.kind === 'refused'
				? { kind: 'refused', message: outcome.message }
				: { kind: 'no-op' };
		}
	};
}

function lightFacts(light: Light): readonly StageCardFact[] {
	const target = add(
		light.position,
		scale(lightForward(light.rotation), LIGHT_AIM_GUIDE_METERS)
	);
	return [
		{ label: 'Kind', value: lightKindLabel(light.light), fieldId: 'kind' },
		{
			label: 'Position',
			value: `${light.position[0].toFixed(2)} · ${light.position[1].toFixed(2)} · ${light.position[2].toFixed(2)} m`,
			fieldId: 'position'
		},
		{
			label: 'Aim',
			value: `${target[0].toFixed(2)} · ${target[1].toFixed(2)} · ${target[2].toFixed(2)} m`,
			fieldId: 'aim'
		},
		{
			label: 'Brightness',
			value: formatBrightness(light.intensity, light.light),
			fieldId: 'brightness'
		},
		...(lightRange(light) === undefined
			? []
			: [{ label: 'Reach', value: `${lightRange(light)!.toFixed(2)} m`, fieldId: 'reach' }]),
		...(light.light === 'spot'
			? [
					{
						label: 'Beam',
						value: `${radiansToDegrees(light.angle).toFixed(1)}° half-angle`,
						fieldId: 'angle'
					}
				]
			: []),
		{
			label: 'Shadow',
			value: light.castShadow ? 'On' : 'Off',
			fieldId: 'shadow'
		}
	];
}

export const createAdapter: StageAdapterFactory = (services) => {
	const adapter: StageAdapter = {
		id: 'light',
		requiredCapabilities: ['stage-instrument-v1'],
		plannerKinds: ['create-light', 'update-light', 'duplicate-light', 'delete-one', 'set-name'],
		bind(context): ReturnType<NonNullable<StageAdapter['bind']>> {
			const source = stageScene(context.snapshot);
			let openTaskKind: string | null = null;
			let gesture: Gesture | null = null;
			let placement: Placement | null = null;
			let rearmingAfterInstall = false;
			let lease: ReturnType<StageAdapterServices['stage']['acquireGesture']> | null = null;

			function releaseLease(): void {
				if (lease?.kind === 'granted' && lease.lease.active) lease.lease.release();
				lease = null;
			}

			function acquireLease(
				evaluationId: string,
				owner: 'light-place' | 'light-marks'
			): boolean {
				const acquisition = services.stage.acquireGesture({
					owner,
					evaluationId,
					policy: 'cancel-on-reading-change'
				});
				if (acquisition.kind !== 'granted') return false;
				lease = acquisition;
				return true;
			}

			const projectId = (): string => services.stage.snapshot().acceptedRevision.projectId;

			function effectiveLight(adapterContext: StageAdapterContext): Light | null {
				return gesture?.entity ?? selectedLight(adapterContext);
			}

			function placementBodyAt(
				css: readonly [number, number],
				adapterContext: StageAdapterContext
			): Placement | null {
				const ray = adapterContext.ray(viewportCss(css, adapterContext));
				if (ray === null) return null;
				let body: Vec3;
				let normal: Vec3;
				const drawn = adapterContext.pickScene(ray);
				if (drawn !== null) {
					normal =
						drawn.normal === undefined
							? normalize(sub(ray.origin, drawn.worldPoint))
							: normalize(drawn.normal);
					// A surface normal points away from the host; flip one that faces
					// along the press ray so the light body is always in front of it.
					if (dot(normal, ray.direction) > 0) normal = scale(normal, -1);
					body = add(drawn.worldPoint, scale(normal, LIGHT_SURFACE_STANDOFF_METERS));
				} else {
					const point = pointOf(
						ray,
						adapterContext.snapshot.domain.datumMeters + LIGHT_WORKING_HEIGHT_METERS
					);
					if (point === null) return null;
					body = point;
					normal = [0, 1, 0];
				}
				return {
					startCss: [css[0], css[1]],
					body,
					normal,
					target: body,
					moved: false
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

			function beginGesture(
				handleId: string | undefined,
				adapterContext: StageAdapterContext
			): Gesture | null {
				const entity = selectedLight(adapterContext);
				if (entity === null) return null;
				const kind: GestureKind | null =
					handleId === 'light-body'
						? 'move'
						: handleId === 'light-aim'
							? 'aim'
							: handleId === 'light-range' || handleId === 'light-reach'
								? 'range'
								: handleId === 'light-angle'
									? 'angle'
									: handleId === 'light-penumbra'
										? 'penumbra'
										: handleId === 'light-azimuth'
											? 'azimuth'
											: handleId === 'light-elevation'
												? 'elevation'
												: null;
				if (kind === null) return null;
				if (kind === 'range' && entity.light === 'point') {
					const height = Math.max(0, entity.position[1] - adapterContext.snapshot.domain.datumMeters);
					const range = lightRange(entity);
					const supportPlaneReached = range === undefined || range >= height;
					return {
						kind,
						entity: cloneLight(entity),
						pointRangePlaneY: supportPlaneReached
							? adapterContext.snapshot.domain.datumMeters
							: entity.position[1]
					};
				}
				return { kind, entity: cloneLight(entity) };
			}

			function updateGesture(
				intent: StagePointerIntent,
				adapterContext: StageAdapterContext
			): void {
				if (gesture === null) return;
				const ray = adapterContext.ray(viewportCss(intent.css, adapterContext));
				if (ray === null) return;
				const current = gesture.entity;
				if (gesture.kind === 'move') {
					const point = pointOf(ray, current.position[1]);
					if (point !== null) current.position = [point[0], current.position[1], point[2]];
					return;
				}
				if (gesture.kind === 'aim') {
					const drawn = adapterContext.pickScene(ray);
					const rayPoint =
						drawn?.worldPoint ??
						add(
							ray.origin,
							scale(
								ray.direction,
								Math.max(LIGHT_AIM_GUIDE_METERS, distance(current.position, ray.origin))
							)
						);
					current.rotation = rotationForLightDirection(sub(rayPoint, current.position));
					if (current.light === 'spot') {
						(current as { range?: number }).range = Math.max(
							0.1,
							spotCutoffForTargetDistance(distance(current.position, rayPoint))
						);
					}
					return;
				}
				const forward = lightForward(current.rotation);
				if (gesture.kind === 'range' && current.light === 'point') {
					const planeY =
						gesture.pointRangePlaneY ?? adapterContext.snapshot.domain.datumMeters;
					const point = pointOf(ray, planeY);
					if (point !== null) {
						(current as { range?: number }).range = Math.max(
							0.1,
							planeY === adapterContext.snapshot.domain.datumMeters
								? distance(current.position, point)
								: horizontalDistance(current.position, point)
						);
					}
					return;
				}
				if (gesture.kind === 'range') {
					const axis = closestAxisPoint(ray, current.position, forward);
					if (axis === null) return;
					(current as { range?: number }).range = Math.max(0.1, axis.distanceAlongAxis);
					return;
				}
				if (gesture.kind === 'angle' && current.light === 'spot') {
					const range = lightRange(current);
					const capDistance =
						range !== undefined && range > 0 ? range : LIGHT_AIM_GUIDE_METERS;
					const capCenter = add(current.position, scale(forward, capDistance));
					const point = rayPlane(ray, capCenter, forward);
					if (point === null) return;
					const radius = distance(point, capCenter);
					(current as { angle: number }).angle = Math.min(
						Math.PI,
						Math.max(0.001, Math.atan2(radius, capDistance))
					);
					return;
				}
				if (gesture.kind === 'penumbra' && current.light === 'spot') {
					const range = lightRange(current);
					const capDistance = range !== undefined && range > 0 ? range : LIGHT_AIM_GUIDE_METERS;
					const capCenter = add(current.position, scale(forward, capDistance));
					const capRadius = Math.tan(current.angle) * capDistance;
					if (!(capRadius > 1e-6)) return;
					const point = rayPlane(ray, capCenter, forward);
					if (point === null) return;
					(current as { penumbra: number }).penumbra = clamp(
						distance(point, capCenter) / capRadius,
						0,
						1
					);
					return;
				}
				if (gesture.kind === 'azimuth') {
					const point = pointOf(ray, adapterContext.snapshot.domain.datumMeters);
					if (point === null) return;
					const angles = lightAngles(current.rotation);
					const azimuth = Math.atan2(
						-(point[0] - current.position[0]),
						-(point[2] - current.position[2])
					);
					current.rotation = rotationForLightDirection(
						directionForAngles(azimuth, angles.elevation)
					);
					return;
				}
				if (gesture.kind === 'elevation') {
					const worldMark: Vec3 = [0, adapterContext.snapshot.domain.datumMeters, 0];
					const horizontal = normalize([forward[0], 0, forward[2]]);
					const normal: Vec3 = [horizontal[2], 0, -horizontal[0]];
					const point = rayPlane(ray, worldMark, normal);
					if (point === null) return;
					const angles = lightAngles(current.rotation);
					const elevation = Math.atan2(
						point[1] - worldMark[1],
						horizontalDistance(worldMark, point)
					);
					current.rotation = rotationForLightDirection(
						directionForAngles(angles.azimuth, elevation)
					);
				}
			}

			async function commitGesture(
				current: Gesture,
				adapterContext: StageAdapterContext
			): Promise<void> {
				const entity = current.entity;
				const update =
					current.kind === 'move'
						? { position: [...entity.position] }
						: current.kind === 'aim'
							? {
									rotation: [...entity.rotation],
									...(entity.light === 'spot'
										? { range: lightRange(entity) ?? LIGHT_AIM_GUIDE_METERS }
										: {})
								}
							: current.kind === 'range'
								? { range: lightRange(entity) ?? (entity.light === 'point' ? 3 : 5) }
								: current.kind === 'penumbra'
									? { penumbra: entity.light === 'spot' ? (entity.penumbra ?? 0) : 0 }
									: current.kind === 'angle'
										? { angle: entity.light === 'spot' ? entity.angle : LIGHT_DEFAULT_SPOT_ANGLE }
										: { rotation: [...entity.rotation] };
				rearmingAfterInstall = true;
				try {
					await acceptFormCommand(
						services,
						adapterContext.snapshot,
						entity.id,
						'update-light',
						{ entityId: entity.id, ...update } as never
					);
				} finally {
					rearmingAfterInstall = false;
					services.stage.notifySurfaceChange();
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
				if (kind === 'directional') {
					position = [0, adapterContext.snapshot.domain.datumMeters, 0];
					rotation = rotationForLightDirection([0, -1, 0]);
				} else if (kind === 'point') {
					position = pending.body;
					rotation = [0, 0, 0];
				} else {
					position = pending.body;
					const direction = pending.moved
						? normalize(sub(pending.target, pending.body))
						: ([0, -1, 0] as Vec3);
					rotation = rotationForLightDirection(direction);
					if (pending.moved) {
						range = spotCutoffForTargetDistance(
							distance(pending.body, pending.target)
						);
					}
				}
				const payload = createPayload({ kind, name, position, rotation, range });
				const allocatedId = `light-${crypto.randomUUID()}`;
				rearmingAfterInstall = true;
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
					}
				} finally {
					rearmingAfterInstall = false;
					services.stage.notifySurfaceChange();
				}
			}

			function sceneBoundsUnion(): SceneBounds | null {
				let union: SceneBounds | null = null;
				for (const entity of stageScene(services.stage.snapshot()).entities) {
					if (isLight(entity)) continue;
					const bounds = services.stage.sceneBounds(entity.id);
					if (bounds === null) continue;
					union =
						union === null
							? { min: [...bounds.min] as Vec3, max: [...bounds.max] as Vec3 }
							: {
									min: [
										Math.min(union.min[0], bounds.min[0]),
										Math.min(union.min[1], bounds.min[1]),
										Math.min(union.min[2], bounds.min[2])
									],
									max: [
										Math.max(union.max[0], bounds.max[0]),
										Math.max(union.max[1], bounds.max[1]),
										Math.max(union.max[2], bounds.max[2])
									]
								};
				}
				return union;
			}

			function guideReachFor(light: Light): number {
				const authored = lightRange(light);
				if (authored !== undefined) return authored;
				const bounds = sceneBoundsUnion();
				if (bounds === null) return light.light === 'directional' ? 10 : 5;
				if (light.light === 'point') return Math.max(1, distance(bounds.min, bounds.max) / 2);
				if (light.light === 'spot') {
					return Math.max(
						1,
						...boundsCorners(bounds).map((corner) => distance(light.position, corner))
					);
				}
				return Math.max(1, distance(bounds.min, bounds.max));
			}

			function directionalBoxSegments(light: Light, bounds: SceneBounds | null): [Vec3, Vec3][] {
				if (bounds === null) return [];
				const center: Vec3 = [
					(bounds.min[0] + bounds.max[0]) / 2,
					(bounds.min[1] + bounds.max[1]) / 2,
					(bounds.min[2] + bounds.max[2]) / 2
				];
				const forward = lightForward(light.rotation);
				const reference: Vec3 = Math.abs(forward[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
				const right = normalize([
					forward[1] * reference[2] - forward[2] * reference[1],
					forward[2] * reference[0] - forward[0] * reference[2],
					forward[0] * reference[1] - forward[1] * reference[0]
				]);
				const up = normalize([
					right[1] * forward[2] - right[2] * forward[1],
					right[2] * forward[0] - right[0] * forward[2],
					right[0] * forward[1] - right[1] * forward[0]
				]);
				let minRight = Infinity, maxRight = -Infinity, minUp = Infinity, maxUp = -Infinity;
				for (const corner of boundsCorners(bounds)) {
					const offset = sub(corner, center);
					const r = dot(offset, right);
					const u = dot(offset, up);
					minRight = Math.min(minRight, r);
					maxRight = Math.max(maxRight, r);
					minUp = Math.min(minUp, u);
					maxUp = Math.max(maxUp, u);
				}
				const depth = distance(bounds.min, bounds.max);
				const rectangle = [
					add(center, add(scale(right, minRight), scale(up, minUp))),
					add(center, add(scale(right, maxRight), scale(up, minUp))),
					add(center, add(scale(right, maxRight), scale(up, maxUp))),
					add(center, add(scale(right, minRight), scale(up, maxUp)))
				];
				const segments: [Vec3, Vec3][] = [];
				for (const offset of [scale(forward, depth / 2), scale(forward, -depth / 2)]) {
					for (let index = 0; index < 4; index += 1) {
						segments.push([
							add(rectangle[index]!, offset),
							add(rectangle[(index + 1) % 4]!, offset)
						]);
					}
				}
				for (let index = 0; index < 4; index += 1) {
					segments.push([
						add(rectangle[index]!, scale(forward, depth / 2)),
						add(rectangle[index]!, scale(forward, -depth / 2))
					]);
				}
				return segments;
			}

			function guideSegments(
				light: Light,
				datumMeters: number,
				derivedReach: number
			): {
				readonly segments: readonly (readonly [Vec3, Vec3])[];
				readonly derivedSegments: readonly (readonly [Vec3, Vec3])[];
			} {
				const segments: [Vec3, Vec3][] = [];
				const derivedSegments: [Vec3, Vec3][] = [];
				if (light.light === 'spot') {
					const guide = spotConeGuide({
						position: light.position,
						rotation: light.rotation,
						halfAngle: light.angle,
						range: lightRange(light) ?? derivedReach
					});
					for (const edge of guide.edges) segments.push([edge[0], edge[1]]);
					for (let index = 0; index < guide.capRing.length; index += 1) {
						segments.push([
							guide.capRing[index]!,
							guide.capRing[(index + 1) % guide.capRing.length]!
						]);
					}
				} else if (light.light === 'point') {
					const range = lightRange(light);
					const height = Math.max(0, light.position[1] - datumMeters);
					const ringRadius =
						range === undefined ? derivedReach : range >= height ? Math.sqrt(range * range - height * height) : range;
					const ringY = range !== undefined && range < height ? light.position[1] : datumMeters;
					const ring: Vec3[] = [];
					for (let index = 0; index < 64; index += 1) {
						const angle = (index / 64) * Math.PI * 2;
						ring.push([
							light.position[0] + Math.cos(angle) * ringRadius,
							ringY,
							light.position[2] + Math.sin(angle) * ringRadius
						]);
					}
					for (let index = 0; index < ring.length; index += 1) {
						(ringRadius === derivedReach && range === undefined ? derivedSegments : segments).push([
							ring[index]!,
							ring[(index + 1) % ring.length]!
						]);
					}
					derivedSegments.push([
						light.position,
						[light.position[0], ringY, light.position[2]]
					]);
				} else {
					segments.push([
						light.position,
						add(light.position, scale(lightForward(light.rotation), LIGHT_AIM_GUIDE_METERS))
					]);
				}
				return { segments, derivedSegments };
			}

			function duplicateActionFor(light: Light): StageCardAction {
				return {
					id: 'light-duplicate',
					label: 'Duplicate light',
					group: 'secondary',
					detail: `Add one copy of ${light.name} at +0.5 m X/Z. Undo removes it.`,
					async run() {
						const allocatedId = `light-${crypto.randomUUID()}`;
						const outcome = await acceptFormCommand(
							services,
							services.stage.snapshot(),
							light.id,
							'duplicate-light',
							{ entityId: light.id },
							allocatedId
						);
						if (outcome.kind === 'installed') {
							const reference = sceneEntityReference(
								allocatedId,
								services.stage.snapshot().domain.unitRevisions.scene
							);
							services.stage.setSelection({ ordered: [{ reference }], primary: reference });
						}
						return outcome.kind === 'refused'
							? { kind: 'refused', message: outcome.message }
							: outcome.kind === 'no-op'
								? { kind: 'no-op' }
								: { kind: 'accepted' };
					}
				};
			}

			function deleteActionFor(light: Light): StageCardAction {
				return {
					id: 'light-delete',
					label: 'Delete light',
					destructive: true,
					detail: `Remove ${light.name}. Undo restores it.`,
					async run() {
						const outcome = await acceptFormCommand(
							services,
							services.stage.snapshot(),
							light.id,
							'delete-one',
							{ entityId: light.id }
						);
						return outcome.kind === 'refused'
							? { kind: 'refused', message: outcome.message }
							: outcome.kind === 'no-op'
								? { kind: 'no-op' }
								: { kind: 'accepted' };
					}
				};
			}

			const binding: ReturnType<NonNullable<StageAdapter['bind']>> = {
				hostTools: ['erase'],
				pressWhenNoTask: true,
				tasks: [
					{
						id: LIGHT_TASK,
						taskKind: LIGHT_TASK,
						label: 'Lights',
						targetRef: null,
						// Marks beat placement: the selected light can be edited immediately
						// after the install without a second trip to the dock.
						marksWhileOpen: true,
						order: 40
					}
				],
				subjects: source.entities.filter(isLight).map((entity) => ({
					id: `scene:entity:${entity.id}`,
					label: entity.name,
					reference: sceneEntityReference(entity.id, context.snapshot.domain.unitRevisions.scene),
					worldPoint: entity.position
				})),
				pick(candidate, live) {
					const nearest = lightGlyphAt(candidate.css, live);
					if (nearest === null) return null;
					return {
						hit: {
							sourceId: nearest.light.id,
							sourceKind: 'entity',
							reference: sceneEntityReference(
								nearest.light.id,
								live.snapshot.domain.unitRevisions.scene
							),
							worldPoint: [...nearest.light.position]
						},
						refusal: null,
						depthMeters: null,
						planLayer: null,
						cssDistance: nearest.distance
					};
				},
				eraseAction(hit) {
					if (hit.reference?.domain !== 'scene') return null;
					const light = lightById(services.stage.snapshot(), hit.sourceId);
					return light === null
						? { kind: 'refused', message: 'That light cannot be erased.' }
						: { kind: 'action', action: deleteActionFor(light), confirm: false };
				},
				keyIntent(intent, adapterContext) {
					if (intent.kind !== 'delete') return false;
					const light = selectedLight(adapterContext);
					if (light === null) return false;
					void deleteActionFor(light).run();
					return true;
				},
				handles(adapterContext) {
					const light = effectiveLight(adapterContext);
					if (light === null) return [];
					const forward = lightForward(light.rotation);
					const datum = adapterContext.snapshot.domain.datumMeters;
					const range = lightRange(light);
					if (light.light === 'directional') {
						const worldMark: Vec3 = [0, datum, 0];
						const radius = guideReachFor(light);
						const angles = lightAngles(light.rotation);
						return [
							{
								role: 'edit',
								id: 'light-azimuth',
								kind: 'ring',
								anchor: worldMark,
								axis: [0, 1, 0],
								extent: radius,
								label: 'Direction',
								fact: 'azimuth',
								verb: 'Azimuth {value}°',
								planner: 'update-light',
								value: `${radiansToDegrees(angles.azimuth).toFixed(1)}°`
							},
							{
								role: 'edit',
								id: 'light-elevation',
								kind: 'ray',
								anchor: worldMark,
								axis: forward,
								extent: radius,
								label: 'Elevation',
								fact: 'elevation',
								verb: 'Elevation {value}°',
								planner: 'update-light',
								value: `${radiansToDegrees(angles.elevation).toFixed(1)}°`
							}
						];
					}
					const targetDistance = light.light === 'spot' ? guideReachFor(light) : LIGHT_AIM_GUIDE_METERS;
					const target = add(light.position, scale(forward, targetDistance));
					const handles: StageHandleDescriptor[] = [
						{
							role: 'edit',
							id: 'light-body',
							kind: 'point',
							anchor: [...light.position],
							label: 'Move light',
							fact: 'position',
							verb: 'Move {value}',
							planner: 'update-light',
							draw: { cross: true },
							value: `${light.position[0].toFixed(2)}, ${light.position[2].toFixed(2)} m`
						}
					];
					if (light.light === 'spot') {
						handles.push({
							role: 'edit',
							id: 'light-aim',
							kind: 'point',
							anchor: target,
							label: 'Aim light',
							fact: 'aim',
							verb: 'Aim {value}',
							planner: 'update-light',
							draw: { pointRadius: 4.5 },
							value: `${target[0].toFixed(2)}, ${target[2].toFixed(2)} m`
						});
					}
					if (light.light === 'point') {
						const reach = range ?? Math.max(1, guideReachFor(light));
						const supportPlaneReached = range === undefined || range >= Math.max(0, light.position[1] - datum);
						handles.push({
							role: 'edit',
							id: 'light-reach',
							kind: 'ring',
							anchor: supportPlaneReached
								? [light.position[0], datum, light.position[2]]
								: [...light.position],
							axis: [0, 1, 0],
							extent: reach,
							label: 'Reach',
							fact: 'range',
							verb: 'Reach {value} m',
							planner: 'update-light',
							value: range === undefined ? 'Derived' : `${range.toFixed(2)} m`
						});
					} else {
						handles.push({
							role: 'edit',
							id: 'light-range',
							kind: 'ray',
							anchor: [...light.position],
							axis: forward,
							extent: range ?? guideReachFor(light),
							label: 'Reach',
							fact: 'range',
							verb: 'Reach {value} m',
							planner: 'update-light',
							value: range === undefined ? 'Unbounded' : `${range.toFixed(2)} m`
						});
					}
					if (light.light === 'spot') {
						const guide = spotConeGuide({
							position: light.position,
							rotation: light.rotation,
							halfAngle: light.angle,
							range: lightRange(light) ?? guideReachFor(light)
						});
						if (radiansToDegrees(light.angle) <= LIGHT_GUIDE_MAX_ANGLE) {
							handles.push({
								role: 'edit',
								id: 'light-angle',
								kind: 'ring',
								anchor: guide.capCenter,
								axis: forward,
								extent: Math.max(0.02, guide.capRadius),
								label: 'Beam',
								fact: 'angle',
								verb: 'Beam {value}°',
								planner: 'update-light',
								value: `${radiansToDegrees(light.angle).toFixed(1)}°`
							});
						}
						const penumbra = light.penumbra ?? 0;
						if (penumbra >= 0.02 && penumbra <= 0.98) {
							handles.push({
								role: 'edit',
								id: 'light-penumbra',
								kind: 'ring',
								anchor: guide.capCenter,
								axis: forward,
								extent: Math.max(0.02, guide.capRadius * penumbra),
								label: 'Soft edge',
								fact: 'soft-edge',
								verb: 'Soft edge {value}%',
								planner: 'update-light',
								value: `${Math.round(penumbra * 100)}%`
							});
						}
					}
					return handles;
				},
				guides(adapterContext) {
					const light = effectiveLight(adapterContext);
					if (light === null) return [];
					const bounds = sceneBoundsUnion();
					const guide = guideSegments(
						light,
						adapterContext.snapshot.domain.datumMeters,
						Math.max(1, guideReachFor(light))
					);
					return [
						{
							id: 'light-guide',
							role: 'selection' as const,
							segments: [
								...guide.segments,
								...(light.light === 'directional'
									? directionalBoxSegments(light, bounds)
									: [])
							],
							derivedSegments: guide.derivedSegments
						}
					];
				},
				candidatePreview(adapterContext) {
					const previews: StageCandidatePreview[] = [];
					if (placement !== null) {
						const kind = armedLightKind(projectId()) ?? 'spot';
						if (kind === 'spot' && placement.moved) {
							const direction = normalize(sub(placement.target, placement.body));
							const rotation = rotationForLightDirection(direction);
							const guide = spotConeGuide({
								position: placement.body,
								rotation,
								halfAngle: LIGHT_DEFAULT_SPOT_ANGLE,
								range: spotCutoffForTargetDistance(
									distance(placement.body, placement.target)
								)
							});
							const segments: [Vec3, Vec3][] = guide.edges.map((edge) => [edge[0], edge[1]]);
							for (let index = 0; index < guide.capRing.length; index += 1) {
								segments.push([
									guide.capRing[index]!,
									guide.capRing[(index + 1) % guide.capRing.length]!
								]);
							}
							previews.push({
								id: 'light-placement',
								role: 'subject',
								segments,
								labels: [
									{
										world: placement.target,
										text: `Place spot · ${distance(placement.body, placement.target).toFixed(2)} m`
									}
								],
								polygons: []
							});
						} else {
							previews.push({
								id: 'light-placement',
								role: 'subject',
								segments: [],
								labels: [
									{
										world: placement.body,
										text: `Place ${lightKindLabel(kind).toLowerCase()}`
									}
								],
								polygons: []
							});
						}
					}
					return previews;
				},
				pointerIntent(intent, adapterContext) {
					if (intent.phase === 'down') {
						if (openTaskKind === LIGHT_TASK) {
							// The plan gives an admitted mark priority over both the emitter
							// glyph and a new placement while Lights is armed.
							const markGesture = beginGesture(intent.handleId, adapterContext);
							if (markGesture !== null) {
								if (!acquireLease(intent.evaluationId, 'light-marks')) return false;
								gesture = markGesture;
								return true;
							}
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
							if (!acquireLease(intent.evaluationId, 'light-place')) return false;
							placement = nextPlacement;
							services.stage.notifySurfaceChange();
							return true;
						}
						const next = beginGesture(intent.handleId, adapterContext);
						if (next === null) return false;
						if (!acquireLease(intent.evaluationId, 'light-marks')) return false;
						gesture = next;
						return true;
					}
					if (gesture === null && placement === null) return false;
					if (intent.phase === 'cancel') {
						gesture = null;
						placement = null;
						releaseLease();
						services.stage.notifySurfaceChange();
						return true;
					}
					if (intent.phase === 'move') {
						if (gesture !== null) updateGesture(intent, adapterContext);
						else updatePlacement(intent.css, adapterContext);
						services.stage.notifySurfaceChange();
						return true;
					}
					if (intent.phase === 'up') {
						const pendingGesture = gesture;
						gesture = null;
						const pendingPlacement = placement;
						placement = null;
						releaseLease();
						if (pendingGesture !== null) {
							void commitGesture(pendingGesture, adapterContext);
						} else if (pendingPlacement !== null) {
							void commitPlacement(pendingPlacement, adapterContext);
						}
						services.stage.notifySurfaceChange();
						return true;
					}
					return false;
				},
				cardWriter(subject: StageCardSubject) {
					if (subject.reference?.domain !== 'scene') return null;
					const light = lightById(services.stage.snapshot(), subject.sourceId);
					if (light === null) return null;
					return {
						summary: 'Light fields',
						fieldIds: [
							'brightness',
							'warmth',
							'color',
							'position',
							'aim',
							'reach',
							'angle',
							'soft-edge',
							'shadow'
						],
						view: { component: LightCardFields, services }
					};
				},
				cardFacts(subject: StageCardSubject) {
					if (subject.sourceKind !== 'entity') return [];
					const snapshot = services.stage.snapshot();
					const light = lightById(snapshot, subject.sourceId);
					if (light !== null) return lightFacts(light);
					const target = stageScene(snapshot).entities.find(
						(candidate) => candidate.id === subject.sourceId
					);
					if (target === undefined) return [];
					const bounds = services.stage.sceneBounds(target.id);
					if (bounds === null) return [];
					const lights = stageScene(snapshot).entities.filter(
						(candidate): candidate is Light =>
							isLight(candidate) && illuminates(candidate, bounds)
					);
					if (lights.length === 0) return [];
					const names = lights.slice(0, 2).map((candidate) => candidate.name);
					const first = lights[0]!;
					const reference = sceneEntityReference(
						first.id,
						snapshot.domain.unitRevisions.scene
					);
					return [
						{
							label: 'Lit by',
							value: `${names.join(', ')}${lights.length > 2 ? ` +${lights.length - 2}` : ''}`,
							select: {
								reference,
								onSelect: () => services.stage.setSelection({ ordered: [{ reference }], primary: reference })
							}
						}
					];
				},
				cardName(subject: StageCardSubject) {
					if (subject.reference?.domain !== 'scene') return null;
					const light = lightById(services.stage.snapshot(), subject.sourceId);
					if (light === null) return null;
					return {
						value: light.name,
						async commit(name: string) {
							const outcome = await acceptFormCommand(
								services,
								services.stage.snapshot(),
								light.id,
								'set-name',
								{ entityId: light.id, name }
							);
							return outcome.kind === 'refused'
								? { kind: 'refused', code: 'refused', message: outcome.message }
								: { kind: 'accepted' };
						}
					};
				},
				cardActions(subject: StageCardSubject) {
					if (subject.reference?.domain !== 'scene') return [];
					const snapshot = services.stage.snapshot();
					const light = lightById(snapshot, subject.sourceId);
					if (light !== null) return [duplicateActionFor(light), deleteActionFor(light)];
					const lightIt = lightItAction(services, subject);
					return lightIt === null ? [] : [lightIt];
				},
				instrument(task) {
					openTaskKind = task.kind;
					if (task.kind !== LIGHT_TASK) return null;
					const kind = armedLightKind(projectId()) ?? 'spot';
					return {
						summary: `Place ${lightKindLabel(kind)}`,
						view: undefined
					};
				},
				taskClosed() {
					// Opening a task also notifies the previous task owner. Only an armed
					// task that really was open is a disarm; the opening notification is not.
					if (openTaskKind === LIGHT_TASK && !rearmingAfterInstall) clearArmedLight();
					openTaskKind = null;
					gesture = null;
					placement = null;
					releaseLease();
				},
				dispose() {
					openTaskKind = null;
					gesture = null;
					placement = null;
					releaseLease();
					if (!rearmingAfterInstall) clearArmedLight();
				}
			};
			return binding;
		}
	};
	return adapter;
};
