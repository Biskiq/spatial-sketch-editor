import { getAssetById, normalizeAssetFootprintOutline, validateAssetFootprint } from '$lib/content/assets';
import type { SceneDocument, SceneEntity, ScenePrimitiveEntity } from '$lib/content/scene';
import type { Asset } from '$lib/types/assets';
import type { Vec3 } from '$lib/types/scene';
import type { LayoutVec2 } from '@portfolio/layout-core';
import { geometryId } from '@portfolio/layout-core';

const CIRCLE_STEPS = 32;

export type PlanSceneFootprint = {
	key: string;
	entityId: string;
	kind: 'model' | 'primitive';
	primitive?: ScenePrimitiveEntity['primitive'];
	points: LayoutVec2[];
	presentation?: PlanSceneFootprintPresentation;
};

export type PlanSceneFootprintPresentation =
	| 'passive'
	| 'bridge-hover'
	| 'active'
	| 'selected';

export type PlanSceneProjection = {
	footprints: readonly PlanSceneFootprint[];
};

export type PlanSceneEffectiveScale = number | Vec3;

export type PlanSceneFootprintOptions = {
	/** Asset metadata source. Defaults to the checked-in catalogue. */
	assetById?: (assetId: string) => Pick<Asset, 'placementSurface' | 'footprint'> | undefined;
	/** Resolves session-aware scale; document scalar remains the fallback. */
	getEffectiveScale?: (entity: SceneEntity) => PlanSceneEffectiveScale | undefined;
	/** UI-only presentation; geometry/eligibility stays independent of it. */
	presentationForEntity?: (entityId: string) => PlanSceneFootprintPresentation | undefined;
};

/**
 * Build passive Scene footprints from live editor Scene data.
 *
 * Point order is canonical local footprint → effective scale → entity yaw →
 * entity translation. PR #115 (WP3): the entity's transform *is* project/world
 * space (the current format guarantees it), so there is no Room frame in this
 * path at all and an entity's footprint is never conditional on a room it names.
 * Y is deliberately discarded; default asset scale/orientation never re-enters.
 */
export function buildPlanSceneFootprintProjection(
	document: SceneDocument,
	options: PlanSceneFootprintOptions = {}
): PlanSceneProjection {
	const assetById = options.assetById ?? getAssetById;
	const footprints: PlanSceneFootprint[] = [];

	for (const entity of document.entities) {
		if (entity.kind === 'light') continue;
		const localOutline = footprintForEntity(entity, assetById);
		if (!localOutline) continue;
		const scale = resolveScale(entity, options.getEffectiveScale?.(entity));
		if (!scale) continue;
		const points = projectFootprint(entity, localOutline, scale);
		if (!points) continue;
		const presentation = options.presentationForEntity?.(entity.id);
		footprints.push({
			key: geometryId(['plan', 'scene-footprint', entity.id]),
			entityId: entity.id,
			kind: entity.kind,
			...(entity.kind === 'primitive' ? { primitive: entity.primitive } : {}),
			points,
			...(presentation ? { presentation } : {})
		});
	}

	return { footprints };
}

function footprintForEntity(
	entity: SceneEntity,
	assetById: (assetId: string) => Pick<Asset, 'placementSurface' | 'footprint'> | undefined
): readonly [number, number][] | null {
	if (entity.kind === 'model') {
		const asset = assetById(entity.assetId);
		if (!asset || asset.placementSurface !== 'floor' || validateAssetFootprint(asset.footprint)) return null;
		return normalizeAssetFootprintOutline(asset.footprint!);
	}
	if (entity.kind !== 'primitive') return null;

	switch (entity.primitive) {
		case 'box':
			return positiveDimensions(entity.dimensions.width, entity.dimensions.depth)
				? rectangle(entity.dimensions.width, entity.dimensions.depth)
				: null;
		case 'plane':
			return positiveDimensions(entity.dimensions.width, entity.dimensions.height)
				? rectangle(entity.dimensions.width, entity.dimensions.height)
				: null;
		case 'cylinder':
			return positiveDimensions(entity.dimensions.radius, entity.dimensions.height)
				? ellipse(entity.dimensions.radius, entity.dimensions.radius)
				: null;
		case 'sphere':
			return positiveDimensions(entity.dimensions.radius, entity.dimensions.radius)
				? ellipse(entity.dimensions.radius, entity.dimensions.radius)
				: null;
	}
}

function positiveDimensions(first: number, second: number): boolean {
	return Number.isFinite(first) && first > 0 && Number.isFinite(second) && second > 0;
}

function rectangle(width: number, depth: number): readonly [number, number][] {
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	return [
		[-halfWidth, -halfDepth],
		[halfWidth, -halfDepth],
		[halfWidth, halfDepth],
		[-halfWidth, halfDepth]
	];
}

function ellipse(radiusX: number, radiusZ: number): readonly [number, number][] {
	return Array.from({ length: CIRCLE_STEPS }, (_, index) => {
		const angle = (Math.PI * 2 * index) / CIRCLE_STEPS;
		return [radiusX * Math.cos(angle), radiusZ * Math.sin(angle)] as [number, number];
	});
}

function resolveScale(
	entity: SceneEntity,
	effective: PlanSceneEffectiveScale | undefined
): Vec3 | null {
	const value = effective ?? entity.scale ?? 1;
	if (typeof value === 'number') {
		return Number.isFinite(value) && value > 0 ? [value, value, value] : null;
	}
	if (value.length !== 3 || value.some((component) => !Number.isFinite(component) || component <= 0)) {
		return null;
	}
	return [value[0], value[1], value[2]];
}

function projectFootprint(
	entity: SceneEntity,
	outline: readonly [number, number][],
	scale: Vec3
): LayoutVec2[] | null {
	if (
		entity.position.length !== 3 ||
		entity.rotation.length !== 3 ||
		entity.position.some((value) => !Number.isFinite(value)) ||
		entity.rotation.some((value) => !Number.isFinite(value))
	) {
		return null;
	}

	const yaw = entity.rotation[1];
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	return outline.map(([x, z]) => {
		const scaledX = x * scale[0];
		const scaledZ = z * scale[2];
		const worldX = entity.position[0] + scaledX * cos + scaledZ * sin;
		const worldZ = entity.position[2] - scaledX * sin + scaledZ * cos;
		return [worldX, worldZ];
	});
}
