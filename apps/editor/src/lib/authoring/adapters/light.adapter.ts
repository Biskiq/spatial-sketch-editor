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
import type { SceneLightEntity, Vec3 } from '@portfolio/project-model';
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
import LightCardFields from './light/LightCardFields.svelte';

const LIGHT_TASK = 'light-place';
const LIGHT_PICK_CSS = 18;
const LIGHT_DEFAULT_SPOT_ANGLE = Math.PI / 6;
const LIGHT_SURFACE_STANDOFF_METERS = 0.02;
const LIGHT_WORKING_HEIGHT_METERS = 1.5;
const LIGHT_PLACEMENT_DRAG_CSS = 4;

type Light = SceneLightEntity;
type GestureKind = 'move' | 'aim' | 'range' | 'angle';

type Gesture = {
	readonly kind: GestureKind;
	readonly entity: Light;
};

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

function nextLightName(snapshot: StageReadSnapshot, kind: Light['light']): string {
	const base = lightKindLabel(kind);
	const names = new Set(
		stageScene(snapshot).entities.filter(isLight).map((light) => light.name)
	);
	if (!names.has(base)) return base;
	for (let index = 2; index < 10_000; index += 1) {
		const candidate = `${base} ${index}`;
		if (!names.has(candidate)) return candidate;
	}
	return `${base} ${Date.now()}`;
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

function illuminates(light: Light, point: Vec3): boolean {
	if (light.light === 'directional') return true;
	const range = lightRange(light);
	const distanceToPoint = distance(light.position, point);
	if (range !== undefined && distanceToPoint > range) return false;
	if (light.light === 'point') return true;
	const direction = lightForward(light.rotation);
	const toPoint = sub(point, light.position);
	const distanceAlong = dot(toPoint, direction);
	if (!(distanceAlong > 0)) return false;
	const angle = Math.atan2(
		Math.hypot(
			toPoint[0] - direction[0] * distanceAlong,
			toPoint[1] - direction[1] * distanceAlong,
			toPoint[2] - direction[2] * distanceAlong
		),
		distanceAlong
	);
	return angle <= light.angle;
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
				const ray = adapterContext.ray(css);
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
				const ray = adapterContext.ray(css);
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
									: null;
				return kind === null ? null : { kind, entity: cloneLight(entity) };
			}

			function updateGesture(
				intent: StagePointerIntent,
				adapterContext: StageAdapterContext
			): void {
				if (gesture === null) return;
				const ray = adapterContext.ray(intent.css);
				if (ray === null) return;
				const current = gesture.entity;
				if (gesture.kind === 'move') {
					const point = pointOf(ray, current.position[1]);
					if (point !== null) current.position = [point[0], current.position[1], point[2]];
					return;
				}
				if (gesture.kind === 'aim') {
					const rayPoint = add(
						ray.origin,
						scale(ray.direction, Math.max(LIGHT_AIM_GUIDE_METERS, distance(current.position, ray.origin)))
					);
					current.rotation = rotationForLightDirection(sub(rayPoint, current.position));
					return;
				}
				const forward = lightForward(current.rotation);
				if (gesture.kind === 'range' && current.light === 'point') {
					const point = pointOf(ray, current.position[1]);
					if (point !== null) {
						(current as { range?: number }).range = Math.max(0.1, horizontalDistance(current.position, point));
					}
					return;
				}
				if (gesture.kind === 'range') {
					const denominator = dot(ray.direction, forward);
					if (Math.abs(denominator) < 1e-9) return;
					const t = dot(sub(current.position, ray.origin), forward) / denominator;
					const point = add(ray.origin, scale(ray.direction, t));
					(current as { range?: number }).range = Math.max(
						0.1,
						dot(sub(point, current.position), forward)
					);
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
							? { rotation: [...entity.rotation] }
							: current.kind === 'range'
								? { range: lightRange(entity) ?? (entity.light === 'point' ? 3 : 5) }
								: { angle: entity.light === 'spot' ? entity.angle : LIGHT_DEFAULT_SPOT_ANGLE };
				await acceptFormCommand(
					services,
					adapterContext.snapshot,
					entity.id,
					'update-light',
					{ entityId: entity.id, ...update } as never
				);
				services.stage.notifySurfaceChange();
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
				services.stage.notifySurfaceChange();
			}

			function guideSegments(light: Light): readonly (readonly [Vec3, Vec3])[] {
				const segments: [Vec3, Vec3][] = [];
				if (light.light === 'spot') {
					const guide = spotConeGuide({
						position: light.position,
						rotation: light.rotation,
						halfAngle: light.angle,
						...(lightRange(light) === undefined ? {} : { range: lightRange(light)! })
					});
					for (const edge of guide.edges) segments.push([edge[0], edge[1]]);
					for (let index = 0; index < guide.capRing.length; index += 1) {
						segments.push([
							guide.capRing[index]!,
							guide.capRing[(index + 1) % guide.capRing.length]!
						]);
					}
				} else if (light.light === 'point' && lightRange(light) !== undefined) {
					const range = lightRange(light)!;
					const ring: Vec3[] = [];
					for (let index = 0; index < 64; index += 1) {
						const angle = (index / 64) * Math.PI * 2;
						ring.push([
							light.position[0] + Math.cos(angle) * range,
							light.position[1],
							light.position[2] + Math.sin(angle) * range
						]);
					}
					for (let index = 0; index < ring.length; index += 1) {
						segments.push([ring[index]!, ring[(index + 1) % ring.length]!]);
					}
				} else {
					segments.push([
						light.position,
						add(light.position, scale(lightForward(light.rotation), LIGHT_AIM_GUIDE_METERS))
					]);
				}
				return segments;
			}

			const binding: ReturnType<NonNullable<StageAdapter['bind']>> = {
				pressWhenNoTask: true,
				tasks: [
					{
						id: LIGHT_TASK,
						taskKind: LIGHT_TASK,
						label: 'Lights',
						targetRef: null,
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
					const css: [number, number] = [
						candidate.css[0] + live.evaluation.rect.left,
						candidate.css[1] + live.evaluation.rect.top
					];
					const ray = live.ray(candidate.css);
					const occluder = ray === null ? null : live.pickScene(ray);
					let nearest: { light: Light; distance: number } | null = null;
					for (const entity of stageScene(live.snapshot).entities.filter(isLight)) {
						const projected = live.project(entity.position);
						if (projected === null) continue;
						const cssDistance = Math.hypot(projected[0] - css[0], projected[1] - css[1]);
						if (cssDistance > LIGHT_PICK_CSS) continue;
						if (
							ray !== null &&
							occluder !== null &&
							!(occluder.kind === 'entity' && occluder.entityId === entity.id)
						) {
							const depth = dot(sub(entity.position, ray.origin), ray.direction);
							if (depth > 0 && occluder.distanceMeters < depth - LIGHT_SURFACE_STANDOFF_METERS) {
								continue;
							}
						}
						if (nearest === null || cssDistance < nearest.distance) {
							nearest = { light: entity, distance: cssDistance };
						}
					}
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
					const action = binding.cardActions?.({
						sourceId: hit.sourceId,
						sourceKind: hit.sourceKind,
						reference: hit.reference,
						ref: null
					})?.find((candidate) => candidate.destructive === true);
					return action === undefined
						? { kind: 'refused', message: 'That light cannot be erased.' }
						: { kind: 'action', action, confirm: false };
				},
				handles(adapterContext) {
					const light = effectiveLight(adapterContext);
					if (light === null) return [];
					const forward = lightForward(light.rotation);
					const target = add(light.position, scale(forward, LIGHT_AIM_GUIDE_METERS));
					const handles: StageHandleDescriptor[] = light.light === 'directional'
						? []
						: [
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
					if (light.light === 'directional') {
						handles.push({
							role: 'edit',
							id: 'light-aim',
							kind: 'point',
							anchor: [...light.position],
							label: 'Direction',
							fact: 'aim',
							verb: 'Aim {value}',
							planner: 'update-light',
							draw: { pointRadius: 4.5 },
							value: `${radiansToDegrees(Math.atan2(-forward[0], -forward[2])).toFixed(1)}°`
						});
					} else if (light.light !== 'point') {
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
					const range = lightRange(light);
					if (range !== undefined) {
						handles.push(
							light.light === 'point'
								? {
										role: 'edit',
										id: 'light-reach',
										kind: 'ring',
										anchor: [...light.position],
										axis: [0, 1, 0],
										extent: range,
										label: 'Reach',
										fact: 'range',
										verb: 'Reach {value} m',
										planner: 'update-light',
										value: `${range.toFixed(2)} m`
									}
								: {
										role: 'edit',
										id: 'light-range',
										kind: 'ray',
										anchor: [...light.position],
										axis: forward,
										extent: range,
										label: 'Reach',
										fact: 'range',
										verb: 'Reach {value} m',
										planner: 'update-light',
										value: `${range.toFixed(2)} m`
									}
						);
					}
					if (light.light === 'spot') {
						const guide = spotConeGuide({
							position: light.position,
							rotation: light.rotation,
							halfAngle: light.angle,
							...(lightRange(light) === undefined ? {} : { range: lightRange(light)! })
						});
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
					return handles;
				},
				candidatePreview(adapterContext) {
					const previews: StageCandidatePreview[] = [];
					const light = effectiveLight(adapterContext);
					if (light !== null) {
						previews.push({
							id: 'light-guide',
							role: 'affected',
							segments: guideSegments(light),
							labels: [
								{
									world: add(
										light.position,
										scale(lightForward(light.rotation), LIGHT_AIM_GUIDE_METERS)
									),
									text:
										light.light === 'spot'
											? `${radiansToDegrees(light.angle).toFixed(1)}° · ${lightRange(light) === undefined ? 'unbounded' : `${lightRange(light)!.toFixed(2)} m`}`
											: lightKindLabel(light.light)
								}
							],
							polygons: []
						});
					}
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
					const lights = stageScene(snapshot).entities.filter(
						(candidate): candidate is Light =>
							isLight(candidate) && illuminates(candidate, target.position)
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
					if (light === null) return [];
					const actions: StageCardAction[] = [
						{
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
						},
						{
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
						}
					];
					return actions;
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
					clearArmedLight();
				}
			};
			return binding;
		}
	};
	return adapter;
};
