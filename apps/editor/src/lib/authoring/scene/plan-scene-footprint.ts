import { Euler, Vector3 } from 'three';
import { getAssetById, normalizeAssetFootprintOutline, validateAssetFootprint } from '$lib/content/assets';
import type { SceneDocument, SceneEntity, SceneFormEntity, ScenePrimitiveEntity } from '$lib/content/scene';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import type { Asset } from '$lib/types/assets';
import type { Vec3 } from '$lib/types/scene';
import type { LayoutVec2 } from '@portfolio/layout-core';
import { geometryId } from '@portfolio/layout-core';

const CIRCLE_STEPS = 32;

export type PlanSceneFootprint = {
	key: string;
	entityId: string;
	kind: 'model' | 'primitive' | 'form';
	primitive?: ScenePrimitiveEntity['primitive'];
	points: LayoutVec2[];
	/** Projected triangle union for a tilted form; upright forms keep their concave ring. */
	polygons?: readonly LayoutVec2[][];
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
	/**
	 * Approved creator-model footprint by model resource id. A creator model is not
	 * in the catalogue, so its confirmed footprint is the only extent Plan can
	 * draw — the same extent the renderer and the planner use.
	 */
	modelFootprintById?: (assetId: string) => { readonly width: number; readonly depth: number } | undefined;
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
	// `SceneDocument` and the Camera-free Scene 2 unit share the entity records
	// this projection reads; naming only that member keeps both callers exact.
	document: Pick<SceneDocument, 'entities'>,
	options: PlanSceneFootprintOptions = {}
): PlanSceneProjection {
	const assetById = options.assetById ?? getAssetById;
	const footprints: PlanSceneFootprint[] = [];

	for (const entity of document.entities) {
		if (entity.kind === 'light') continue;
		if (entity.kind === 'form') {
			// A form's ring is already the evaluated, source-scaled footprint, so it
			// is transformed by yaw and translation only: applying the entity scale
			// again would draw a double-sized form.
			const formPoints = projectFormFootprint(entity);
			if (formPoints === null) continue;
			const formPresentation = options.presentationForEntity?.(entity.id);
			footprints.push({
				key: geometryId(['plan', 'scene-footprint', entity.id]),
				entityId: entity.id,
				kind: 'form',
				points: formPoints,
				...(entity.rotation[0] !== 0 || entity.rotation[2] !== 0 ? { polygons: tiltedFormPolygons(entity) } : {}),
				...(formPresentation ? { presentation: formPresentation } : {})
			});
			continue;
		}
		const localOutline = footprintForEntity(entity, assetById, options.modelFootprintById);
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

/**
 * The one footprint projection for a live Scene snapshot.
 *
 * Paper and Scene's Plan hit path must read the **same** projection, not two
 * evaluations of the same function: an identity, a point ring and a tilted form's
 * polygon union can otherwise drift when one call site resolves a different
 * scale or model footprint. The cache is keyed by the Scene object the accepted
 * snapshot carries, and by the model-footprint map it was built with.
 */
const projections = new WeakMap<
	object,
	{
		readonly modelFootprints: ReadonlyMap<string, { readonly width: number; readonly depth: number }> | undefined;
		readonly projection: PlanSceneProjection;
	}
>();

export function planSceneFootprintsFor(
	document: Pick<SceneDocument, 'entities'>,
	modelFootprints?: ReadonlyMap<string, { readonly width: number; readonly depth: number }>
): PlanSceneProjection {
	const cached = projections.get(document);
	if (cached !== undefined && cached.modelFootprints === modelFootprints) return cached.projection;
	const projection = buildPlanSceneFootprintProjection(document, {
		modelFootprintById: (assetId) => modelFootprints?.get(assetId)
	});
	projections.set(document, { modelFootprints, projection });
	return projection;
}

/** Full XYZ placement matches the rendered body, including admitted non-upright forms. */
function tiltedFormPolygons(entity: SceneFormEntity): LayoutVec2[][] {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return [];
	const rotation = new Euler(...entity.rotation);
	const positions: LayoutVec2[] = [];
	for (let i = 0; i < mesh.positions.length; i += 3) {
		const point = new Vector3(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]).applyEuler(rotation);
		positions.push([point.x + entity.position[0], point.z + entity.position[2]]);
	}
	const polygons: LayoutVec2[][] = [];
	for (let i = 0; i < mesh.indices.length; i += 3) polygons.push([
		positions[mesh.indices[i]!]!, positions[mesh.indices[i + 1]!]!, positions[mesh.indices[i + 2]!]!
	]);
	return polygons;
}

function footprintForEntity(
	entity: SceneEntity,
	assetById: (assetId: string) => Pick<Asset, 'placementSurface' | 'footprint'> | undefined,
	modelFootprintById?: (assetId: string) => { readonly width: number; readonly depth: number } | undefined
): readonly [number, number][] | null {
	if (entity.kind === 'model') {
		// An approved creator model has no catalogue entry; its footprint is the
		// confirmed one from the placement review, never a guessed box.
		const approved = modelFootprintById?.(entity.assetId);
		if (approved !== undefined) {
			return positiveDimensions(approved.width, approved.depth)
				? rectangle(approved.width, approved.depth)
				: null;
		}
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

/** The evaluated XZ ring of one form, in Plan world coordinates. */
function projectFormFootprint(entity: SceneFormEntity): LayoutVec2[] | null {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null || mesh.footprint.length < 3) return null;
	if (
		entity.position.some((value) => !Number.isFinite(value)) ||
		entity.rotation.some((value) => !Number.isFinite(value))
	) {
		return null;
	}
	const cos = Math.cos(entity.rotation[1]);
	const sin = Math.sin(entity.rotation[1]);
	return mesh.footprint.map(
		([x, z]) => [entity.position[0] + x * cos + z * sin, entity.position[2] - x * sin + z * cos] as LayoutVec2
	);
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
