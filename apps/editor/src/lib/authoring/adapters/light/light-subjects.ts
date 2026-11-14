/**
 * X8 — the Light subjects, lookups and pick.
 *
 * What a Light *is* to the adapter, with no lifetime: the Light entity type,
 * the canonical selection and snapshot lookups, the glyph under a Stage-local
 * point, the Spot's derived target and the naming rule for a new light. Every
 * session, presenter and projection reads Lights through this one leaf; none of
 * it holds state, opens a lease or writes.
 */
import type { SceneEntity, SceneLightEntity, Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterContext,
	StageReadSnapshot
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import { lightKindLabel } from '../../look/light-units';
import { spotTarget } from '../../look/light-presentation';
import { dot, sub } from './light-math';

export const LIGHT_TASK = 'light-place';
export const LIGHT_PICK_CSS = 18;
export const LIGHT_DEFAULT_SPOT_ANGLE = Math.PI / 6;

export type Light = SceneLightEntity;

/** Stage pointer intent coordinates are local; Camera rays include the surface offset. */
export function viewportCss(
	css: readonly [number, number],
	context: StageAdapterContext
): [number, number] {
	return [css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top];
}

export function isLight(entity: { readonly kind?: string } | undefined): entity is Light {
	return entity?.kind === 'light';
}

export function selectedLight(context: StageAdapterContext): Light | null {
	const selection = context.selectionState().primary;
	if (selection === null || selection.domain !== 'scene') return null;
	if (selection.subject.kind !== 'entity') return null;
	const entity = stageScene(context.snapshot).entities.find(
		(candidate) => candidate.id === selection.subject.id
	);
	return isLight(entity) ? entity : null;
}

/** A range is optional on point/spot and absent on directional; one accessor. */
export function lightRange(light: Light): number | undefined {
	return 'range' in light ? light.range : undefined;
}

export function lightById(snapshot: StageReadSnapshot, id: string): Light | null {
	const entity = stageScene(snapshot).entities.find((candidate) => candidate.id === id);
	return isLight(entity) ? entity : null;
}

/**
 * The light glyph under a Stage-local point, using the same 18 px target as
 * selection. A Directional light has no position and no glyph: it is selected
 * from the Index, the shelf list or the dial's own tick, never from a body mark.
 */
export function lightGlyphAt(
	css: readonly [number, number],
	context: StageAdapterContext
): { readonly light: Light; readonly distance: number } | null {
	const viewport = viewportCss(css, context);
	const candidates: { readonly light: Light; readonly distance: number }[] = [];
	for (const entity of stageScene(context.snapshot).entities.filter(isLight)) {
		if (entity.light === 'directional') continue;
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
			if (depth > 0 && occluder.distanceMeters < depth - 0.02) {
				continue;
			}
		}
		if (nearest === null || candidate.distance < nearest.distance) nearest = candidate;
	}
	return nearest;
}

export function nextEntityName(snapshot: StageReadSnapshot, base: string): string {
	const names = new Set(stageScene(snapshot).entities.map((entity) => entity.name));
	if (!names.has(base)) return base;
	for (let index = 2; index < 10_000; index += 1) {
		const candidate = `${base} ${index}`;
		if (!names.has(candidate)) return candidate;
	}
	return `${base} ${Date.now()}`;
}

export function nextLightName(snapshot: StageReadSnapshot, kind: Light['light']): string {
	return nextEntityName(snapshot, lightKindLabel(kind));
}

export function entityById(snapshot: StageReadSnapshot, id: string): SceneEntity | null {
	return stageScene(snapshot).entities.find((candidate) => candidate.id === id) ?? null;
}

export function cloneLight(light: Light): Light {
	return {
		...light,
		position: [...light.position] as Vec3,
		rotation: [...light.rotation] as Vec3
	} as Light;
}

/**
 * A Spot's target, derived on every read: the forward ray's first surface hit, or
 * 3 m in empty space. Never stored and independent of Reach.
 */
export function spotTargetFor(light: Light, adapterContext: StageAdapterContext) {
	return spotTarget({
		position: light.position,
		rotation: light.rotation,
		pick: (ray) => adapterContext.pickScene(ray)
	});
}
