/**
 * X8 — the Light screen-space and dial geometry.
 *
 * Pure projections of one Light and one live Stage context into the guide
 * segments, labels, ring controls and Directional dial the Stage draws. Nothing
 * here holds a lifetime, opens a lease, reads the gesture or writes: a caller
 * hands in the frozen dial frame or the hovered tick it wants honoured, and the
 * Stage's scene reads arrive as a narrow `LightSceneReads`. Moved verbatim from
 * the former monolithic adapter; the Light planners stay the only authority on
 * what a guide means.
 */
import type { Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterContext,
	StageAdapterServices
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import { lightForward } from '../../look/light-aim';
import {
	drawableSpotAngle,
	isWideBeam,
	lightDropStem,
	pointReachRingRadius,
	presentationAngles,
	spotFootprintRadius,
	spotInnerRadius
} from '../../look/light-presentation';
import {
	directionalDialBearingPoint,
	directionalDialCompanions,
	directionalDialFrame,
	directionalDialName,
	directionalDialTick,
	directionalDialTickHalfLength,
	type DirectionalDialFrame
} from '../../look/directional-dial';
import { add, cross, dot, normalize, scale, sub, type SceneBounds } from './light-math';
import {
	isLight,
	lightById,
	lightRange,
	selectedLight,
	spotTargetFor,
	viewportCss,
	type Light
} from './light-subjects';

/** The Stage's scene reads a guide needs; the live snapshot and evaluated bounds. */
export type LightSceneReads = Pick<StageAdapterServices['stage'], 'snapshot' | 'sceneBounds'>;

/** A dial frame frozen at the press of either Directional bead. */
export type LightDialFrame = { readonly center: Vec3; readonly radius: number };

export type LightGuideLabel = { readonly world: Vec3; readonly text: string };

export type LightGuide = {
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly derivedSegments: readonly (readonly [Vec3, Vec3])[];
	readonly labels: readonly LightGuideLabel[];
};

/**
 * A ring-plane direction that projects toward screen-right or screen-left.
 *
 * The Spot's Rim and Inner-ring controls share one ring plane; separating
 * their controls on opposite sides keeps the two beams editable even when the
 * soft edge is zero and the rings coincide. Presentation only: the gesture
 * still measures the ring's real radius.
 */
export function ringPhase(
	adapterContext: StageAdapterContext,
	axis: Vec3,
	side: 'left' | 'right'
): Vec3 | undefined {
	const view = normalize(sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye));
	const right = cross(view, [0, 1, 0]);
	const normal = normalize(axis);
	const projected = sub(right, scale(normal, dot(right, normal)));
	if (Math.hypot(projected[0], projected[1], projected[2]) < 1e-6) return undefined;
	const unit = normalize(projected);
	return side === 'left' ? scale(unit, -1) : unit;
}

/**
 * The world radius whose screen projection is about `pixels`, measured at the
 * body along the camera's right. Used by the Point's reach control when the
 * sphere never meets the datum: that control is a screen-sized ring at the
 * light, not a world ring on the floor.
 */
export function screenRingExtent(
	adapterContext: StageAdapterContext,
	position: Vec3,
	pixels: number
): number {
	const forward = normalize(sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye));
	const right = normalize(cross(forward, [0, 1, 0]));
	const anchor = adapterContext.project(position);
	const sample = adapterContext.project(add(position, right));
	if (anchor !== null && sample !== null) {
		const css = Math.hypot(sample[0] - anchor[0], sample[1] - anchor[1]);
		if (css > 0.5) return Math.max(0.02, pixels / css);
	}
	return 0.05;
}

export function sceneBoundsUnion(reads: LightSceneReads): SceneBounds | null {
	let union: SceneBounds | null = null;
	for (const entity of stageScene(reads.snapshot()).entities) {
		if (isLight(entity)) continue;
		const bounds = reads.sceneBounds(entity.id);
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

function dialCssPerMeter(adapterContext: StageAdapterContext, center: Vec3): number {
	const forward = normalize(
		sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye)
	);
	const right = normalize(cross(forward, [0, 1, 0]));
	const anchor = adapterContext.project(center);
	const sample = adapterContext.project(add(center, right));
	if (anchor === null || sample === null) return 0;
	return Math.hypot(sample[0] - anchor[0], sample[1] - anchor[1]);
}

/**
 * The dial's other Directional lights. The Index lists every light; the
 * ticks are how several Directionals stay distinguishable on the Stage.
 */
export function dialCompanionsFor(light: Light, adapterContext: StageAdapterContext) {
	const directional = stageScene(adapterContext.snapshot)
		.entities.filter(isLight)
		.filter((entity) => entity.light === 'directional');
	return directionalDialCompanions(directional, light.id);
}

/**
 * A non-draggable tick under the pointer. Clicking it selects that light,
 * exactly as the Index does; it never starts a gesture or writes.
 */
export function directionalTickAt(
	css: readonly [number, number],
	adapterContext: StageAdapterContext,
	coarse: boolean,
	reads: LightSceneReads,
	frozen: LightDialFrame | null
): { readonly light: Light; readonly distance: number } | null {
	const selected = selectedLight(adapterContext);
	if (selected === null || selected.light !== 'directional') return null;
	const frame = frozen ?? dialFrameFor(adapterContext, reads);
	const viewport = viewportCss(css, adapterContext);
	const hitRadius = coarse ? 22 : 11;
	let nearest: { readonly light: Light; readonly distance: number } | null = null;
	for (const companion of dialCompanionsFor(selected, adapterContext)) {
		const entity = lightById(adapterContext.snapshot, companion.id);
		if (entity === null) continue;
		const projected = adapterContext.project(
			directionalDialBearingPoint(frame.center, frame.radius, companion.from)
		);
		if (projected === null) continue;
		const distance = Math.hypot(projected[0] - viewport[0], projected[1] - viewport[1]);
		if (distance > hitRadius) continue;
		if (nearest === null || distance < nearest.distance) {
			nearest = { light: entity, distance };
		}
	}
	return nearest;
}

export function dialFrameFor(
	adapterContext: StageAdapterContext,
	reads: LightSceneReads
): DirectionalDialFrame {
	const bounds = sceneBoundsUnion(reads);
	const rect = adapterContext.evaluation.rect;
	const forward = normalize(
		sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye)
	);
	return directionalDialFrame({
		datumMeters: adapterContext.snapshot.domain.datumMeters,
		boundsCenter: bounds === null
			? null
			: [
					(bounds.min[0] + bounds.max[0]) / 2,
					(bounds.min[1] + bounds.max[1]) / 2,
					(bounds.min[2] + bounds.max[2]) / 2
				],
		project: (point) => adapterContext.project(point),
		centerRay: adapterContext.ray([
			rect.left + rect.width / 2,
			rect.top + rect.height / 2
		]),
		viewport: { width: rect.width, height: rect.height },
		cameraRight: cross(forward, [0, 1, 0])
	});
}

function ringSegments(center: Vec3, radius: number, y: number): [Vec3, Vec3][] {
	const ring: Vec3[] = [];
	for (let index = 0; index < 64; index += 1) {
		const angle = (index / 64) * Math.PI * 2;
		ring.push([
			center[0] + Math.cos(angle) * radius,
			y,
			center[2] + Math.sin(angle) * radius
		]);
	}
	const segments: [Vec3, Vec3][] = [];
	for (let index = 0; index < ring.length; index += 1) {
		segments.push([ring[index]!, ring[(index + 1) % ring.length]!]);
	}
	return segments;
}

export function guideSegments(
	light: Light,
	adapterContext: StageAdapterContext,
	reads: LightSceneReads,
	hoveredDialTick: string | null
): LightGuide {
	const segments: [Vec3, Vec3][] = [];
	const derivedSegments: [Vec3, Vec3][] = [];
	let labels: { readonly world: Vec3; readonly text: string }[] = [];
	const datumMeters = adapterContext.snapshot.domain.datumMeters;
	if (light.light === 'spot') {
		const forward = normalize(lightForward(light.rotation));
		const target = spotTargetFor(light, adapterContext);
		const drawAngle = drawableSpotAngle(light.angle);
		const distance = target.distance;
		const footprintRadius = spotFootprintRadius(distance, drawAngle);
		const center = add(light.position, scale(forward, distance));
		const reference: Vec3 = Math.abs(forward[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
		const right = normalize(cross(forward, reference));
		const up = normalize(cross(right, forward));
		const ring: Vec3[] = [];
		for (let index = 0; index < 48; index += 1) {
			const angle = (index / 48) * Math.PI * 2;
			ring.push(
				add(
					center,
					add(
						scale(right, Math.cos(angle) * footprintRadius),
						scale(up, Math.sin(angle) * footprintRadius)
					)
				)
			);
		}
		const range = lightRange(light);
		const behind = range !== undefined && range < distance;
		// A stored angle beyond 80° is drawn at the guide's 80° limit in
		// derived-guide ink: the footprint is an illustration, not the
		// authored beam, and the grips are not mounted to claim otherwise.
		const footprint = behind || isWideBeam(light.angle) ? derivedSegments : segments;
		for (let index = 0; index < ring.length; index += 1) {
			footprint.push([ring[index]!, ring[(index + 1) % ring.length]!]);
		}
		// A cone is two silhouette edges, never four struts.
		footprint.push([light.position, ring[0]!]);
		footprint.push([light.position, ring[24]!]);
		const penumbra = light.penumbra ?? 0;
		if (penumbra > 0.001) {
			const inner = spotInnerRadius(distance, drawAngle, penumbra);
			if (inner > 1e-4) {
				for (let index = 0; index < 48; index += 1) {
					const angle = (index / 48) * Math.PI * 2;
					const point = add(
						center,
						add(
							scale(right, Math.cos(angle) * inner),
							scale(up, Math.sin(angle) * inner)
						)
					);
					derivedSegments.push([
						point,
						add(
							center,
							add(
								scale(right, Math.cos(((index + 1) / 48) * Math.PI * 2) * inner),
								scale(up, Math.sin(((index + 1) / 48) * Math.PI * 2) * inner)
							)
						)
					]);
				}
			}
		}
		if (range !== undefined) {
			const capCenter = add(light.position, scale(forward, range));
			derivedSegments.push([light.position, capCenter]);
			segments.push([
				add(capCenter, scale(right, 0.07)),
				add(capCenter, scale(right, -0.07))
			]);
		}
	} else if (light.light === 'point') {
		const range = lightRange(light);
		const height = Math.max(0, light.position[1] - datumMeters);
		// The drop stem is derived geometry: it names the first surface
		// below the body, or the datum when nothing is under it. It never
		// states a stored reach.
		derivedSegments.push([
			light.position,
			lightDropStem(light.position, datumMeters, (ray) =>
				adapterContext.pickScene(ray)
			)
		]);
		if (range !== undefined) {
			const ring = pointReachRingRadius(range, height);
			if (ring.onDatum && ring.radius > 1e-4) {
				segments.push(...ringSegments(light.position, ring.radius, datumMeters));
			}
		}
	} else {
		// The Directional dial: ring on the datum, the From spoke and the
		// quarter arc are derived; the three travel arrows are Guide ink.
		const frame = dialFrameFor(adapterContext, reads);
		const angles = presentationAngles(light.rotation);
		const from = (angles.from * Math.PI) / 180;
		const height = (angles.heightInSky * Math.PI) / 180;
		const horizontal: Vec3 = [Math.sin(from), 0, -Math.cos(from)];
		const source: Vec3 = [
			horizontal[0] * Math.cos(height),
			Math.sin(height),
			horizontal[2] * Math.cos(height)
		];
		const ring: Vec3[] = [];
		for (let index = 0; index < 48; index += 1) {
			const angle = (index / 48) * Math.PI * 2;
			ring.push([
				frame.center[0] + Math.cos(angle) * frame.radius,
				adapterContext.snapshot.domain.datumMeters,
				frame.center[2] + Math.sin(angle) * frame.radius
			]);
		}
		for (let index = 0; index < ring.length; index += 1) {
			segments.push([ring[index]!, ring[(index + 1) % ring.length]!]);
		}
		derivedSegments.push([
			frame.center,
			add(frame.center, scale(horizontal, frame.radius))
		]);
		const arcSteps = Math.max(2, Math.round((24 * angles.heightInSky) / 90));
		for (let index = 0; index < arcSteps; index += 1) {
			const a = (index / arcSteps) * height;
			const b = ((index + 1) / arcSteps) * height;
			const point = (t: number): Vec3 => [
				frame.center[0] + (horizontal[0] * Math.cos(t)) * frame.radius,
				frame.center[1] + Math.sin(t) * frame.radius,
				frame.center[2] + (horizontal[2] * Math.cos(t)) * frame.radius
			];
			derivedSegments.push([point(a), point(b)]);
		}
		const travel: Vec3 = [-source[0], -source[1], -source[2]];
		const length = frame.radius * 1.35;
		for (const offset of [-0.4, 0, 0.4]) {
			const base = add(frame.center, scale(horizontal, offset * frame.radius));
			const end = add(base, scale(travel, length));
			segments.push([base, end]);
			const back = add(end, scale(travel, -frame.radius * 0.12));
			const side = scale(horizontal, frame.radius * 0.06);
			segments.push([end, add(back, side)], [end, sub(back, side)]);
		}
		// The bearing ring's 0° mark and one 6 px derived tick per other
		// Directional light, at that light's own bearing. Ticks never drag.
		const tickHalfLength = directionalDialTickHalfLength(
			dialCssPerMeter(adapterContext, frame.center)
		);
		derivedSegments.push(
			directionalDialTick({
				center: frame.center,
				radius: frame.radius,
				from: 0,
				halfLength: tickHalfLength
			})
		);
		const companions = dialCompanionsFor(light, adapterContext);
		for (const companion of companions) {
			derivedSegments.push(
				directionalDialTick({
					center: frame.center,
					radius: frame.radius,
					from: companion.from,
					halfLength: tickHalfLength
				})
			);
		}
		// The dial always names its selected light at the centre; the Index
		// still lists every light by name. A hovered tick names its own light.
		labels = [{ world: frame.center, text: directionalDialName(light.name) }];
		const hovered =
			hoveredDialTick === null
				? null
				: companions.find((companion) => companion.id === hoveredDialTick) ?? null;
		if (hovered !== null) {
			labels.push({
				world: directionalDialBearingPoint(
					frame.center,
					frame.radius,
					hovered.from
				),
				text: directionalDialName(hovered.name)
			});
		}
	}
	return { segments, derivedSegments, labels };
}
