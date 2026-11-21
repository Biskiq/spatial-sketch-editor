/**
 * Host-owned target analysis for Finish registration.
 *
 * Registration names targets; it does not prove what their geometry can
 * sample. This module derives the facts from the exact geometry the renderer
 * would draw — the same unit primitive, the same evaluated Form buffer, the
 * compiled Layout surface mesh, or the exact approved model derivative — and
 * binds them to the revision the host inspected. F4 compares the caller's echo
 * against this analysis and refuses a set, a draw or a basis the host did not
 * derive.
 *
 * It is headless: no Canvas, mesh, material or renderer object is created, so a
 * host with the editor Canvas closed derives the same facts.
 */
import { evaluateFormMesh, formEvaluationKey } from '$lib/content/form-evaluation';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import { buildRegionMeshGeometry } from '$lib/render/layout/region-mesh-builder';
import {
	legJoinsByWall,
	type CompiledLayoutGeometry,
	type CompiledRegion,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import type {
	RuntimeScene,
	SceneEntity,
	SceneFormEntity,
	ScenePrimitiveEntity,
	SceneSurfaceRef
} from '@portfolio/project-model';
import {
	summarizeDrawGeometry,
	type DrawGeometry,
	type TargetAnalysis,
	type TargetAnalysisRequest,
	type TargetFacts,
	type TargetMetricBasis
} from '@portfolio/project-model/materials';
import { ShapeUtils, Vector2, type BufferGeometry } from 'three';
import { constructGeometry } from '../resources/geometry-store';
import type { GeometrySpec } from '../resources/scene-render-item';
import {
	scenePrimitiveGeometry,
	scenePrimitiveSurfaceMeters
} from '../scene-render-description';

export type { TargetAnalysis, TargetAnalysisRequest } from '@portfolio/project-model/materials';

/** One approved model derivative, read through the host's one loader cache. */
export type ModelDerivativeAnalysis = {
	/** The digest of the exact approved bytes these draws were read from. */
	readonly digest: string;
	readonly draws: readonly {
		readonly drawKey: string;
		readonly geometry: DrawGeometry;
	}[];
};

/**
 * The approved derivative for one exact content digest. The digest is the
 * resource pin's hash, not a Scene revision the caller asserted: a derivative
 * for another revision is not an answer, and the analyzer also rejects a
 * returned analysis whose own digest disagrees.
 */
export type ModelDerivativeAnalysisProvider = (
	digest: string
) => ModelDerivativeAnalysis | null;

export type SceneTargetAnalysisInput = {
	/** The currently accepted Scene, its compiled Layout and their exact revisions. */
	read: () => {
		readonly scene: RuntimeScene;
		readonly sceneRevision: string;
		readonly layoutRevision: string;
		/** Canonical compiled Layout the renderer's surfaces are built from. */
		readonly geometry: CompiledLayoutGeometry;
		/** The approved derivative digest for a model resource, or null. */
		readonly modelDigest: (assetId: string) => string | null;
	} | null;
	/**
	 * The approved derivative for a model resource. Absent, a model target has no
	 * analysis and registration refuses `target-pending` rather than assuming
	 * UV sets the GLB may not carry.
	 */
	readonly models?: ModelDerivativeAnalysisProvider;
};

function drawGeometryOf(geometry: BufferGeometry, drawKey: string): { drawKey: string; geometry: DrawGeometry } {
	const positions = geometry.getAttribute('position');
	const uv0 = geometry.getAttribute('uv');
	const uv1 = geometry.getAttribute('uv1');
	const index = geometry.getIndex();
	return {
		drawKey,
		geometry: {
			positions: positions.array as ArrayLike<number>,
			indices: index === null ? null : (index.array as ArrayLike<number>),
			drawRange: { start: geometry.drawRange.start, count: geometry.drawRange.count },
			groups: geometry.groups.map((group) => ({ start: group.start, count: group.count })),
			uvs: [uv0 === undefined ? null : uv0.array, uv1 === undefined ? null : uv1.array]
		}
	};
}

function factsFromSpec(
	subject: string,
	revision: string,
	spec: GeometrySpec,
	metricBasis: TargetMetricBasis | null
): TargetFacts {
	const geometry = constructGeometry(spec);
	try {
		const draw = summarizeDrawGeometry(subject, drawGeometryOf(geometry, subject).geometry);
		return {
			subject,
			geometryRevision: revision,
			...(metricBasis === null ? {} : { metricBasis }),
			draws: [draw]
		};
	} finally {
		// The analyzer owns this buffer; disposing it frees nothing on the GPU
		// because it never reached one.
		geometry.dispose();
	}
}

function primitiveFacts(
	entity: ScenePrimitiveEntity,
	subject: string,
	revision: string
): TargetFacts {
	const { spec } = scenePrimitiveGeometry(entity);
	const surface = scenePrimitiveSurfaceMeters(entity);
	// A primitive's UV0 is 0..1 per face; one UV unit spans the rendered surface
	// in each axis. The renderer binds the same basis, so the analysis and the
	// draw cannot disagree about a metre tile.
	return factsFromSpec(subject, revision, spec, {
		uvMeters: [surface[0], surface[1]],
		surfaceMeters: [surface[0], surface[1]]
	});
}

function formFacts(entity: SceneFormEntity, subject: string, revision: string): TargetFacts | null {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return null;
	return factsFromSpec(
		subject,
		revision,
		{
			kind: 'form',
			evaluationKey: formEvaluationKey(entity.form),
			mesh,
			plane: entity.form.generator.plane
		},
		// Form UVs are metres, so one native unit is one metre.
		{ uvMeters: [1, 1], surfaceMeters: [1, 1] }
	);
}

function modelFacts(
	entity: Extract<SceneEntity, { kind: 'model' }>,
	subject: string,
	revision: string,
	current: NonNullable<ReturnType<SceneTargetAnalysisInput['read']>>,
	provider: ModelDerivativeAnalysisProvider | undefined
): TargetFacts | null {
	const digest = current.modelDigest(entity.assetId);
	if (digest === null) return null;
	const derivative = provider?.(digest) ?? null;
	// The analysis must be the approved bytes themselves, not an analysis of
	// another pinned revision that happens to be cached.
	if (derivative === null || derivative.digest !== digest || derivative.draws.length === 0) {
		return null;
	}
	return {
		subject,
		geometryRevision: revision,
		// A model remap keeps the model's own UV chart; a metric tile has no
		// basis it can claim. Explicit `uv` mapping remains available.
		draws: derivative.draws.map((draw) => summarizeDrawGeometry(draw.drawKey, draw.geometry))
	};
}

/** The renderer's wall sheets are metre charts: u is arc length, v is height. */
function wallSideFacts(
	geometry: CompiledLayoutGeometry,
	surface: Extract<LayoutSurfaceRef, { kind: 'wall-side' }>,
	subject: string,
	revision: string
): TargetFacts | null {
	const wall = geometry.walls.find((candidate) => candidate.wallId === surface.wallId);
	if (wall === undefined) return null;
	const floor = geometry.floors.find((candidate) => candidate.floorId === wall.floorId);
	if (floor === undefined) return null;
	const built = buildStandaloneWallMesh(
		wall,
		floor.elevation,
		legJoinsByWall(geometry.junctions).get(wall.wallId) ?? null
	);
	if (built.mesh === undefined || built.mesh.indices.length === 0) return null;
	const draw = summarizeDrawGeometry(subject, {
		positions: built.mesh.positions,
		indices: built.mesh.indices,
		uvs: [built.mesh.uvs, null]
	});
	return {
		subject,
		geometryRevision: revision,
		metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
		draws: [draw]
	};
}

/** The Room floors and lids the renderer triangulates, as metre UVs. */
function roomPlaneFacts(
	room: CompiledLayoutGeometry['rooms'][number],
	surface: Extract<LayoutSurfaceRef, { kind: 'room-floor' | 'room-lid' }>,
	subject: string,
	revision: string
): TargetFacts | null {
	if (surface.kind === 'room-lid' && room.overhead === 'open-to-sky') return null;
	const polygon = surface.kind === 'room-floor' ? room.floorPolygon : room.ceilingPolygon;
	if (polygon.length < 3) return null;
	const elevation = surface.kind === 'room-floor' ? room.floorElevation : room.ceilingElevation;
	const triangles = ShapeUtils.triangulateShape(
		polygon.map(([x, z]) => new Vector2(x, z)),
		[]
	);
	if (triangles.length === 0) return null;
	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	for (const triangle of triangles) {
		for (const index of triangle) {
			const [x, z] = polygon[index]!;
			indices.push(positions.length / 3);
			positions.push(x, elevation, z);
			// The floor looks up with v along -z; the lid mirrors z so the image
			// reads the same way from below. Both are metre charts.
			uvs.push(x, surface.kind === 'room-floor' ? -z : z);
		}
	}
	const draw = summarizeDrawGeometry(subject, {
		positions,
		indices,
		uvs: [uvs, null]
	});
	return {
		subject,
		geometryRevision: revision,
		metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
		draws: [draw]
	};
}

/** The compiled region face subset, exactly as the region representation draws it. */
function regionFaceFacts(
	region: CompiledRegion,
	surface: Extract<LayoutSurfaceRef, { kind: 'region-face' }>,
	subject: string,
	revision: string
): TargetFacts | null {
	const built = buildRegionMeshGeometry(region);
	try {
		const surfaceByTriangle =
			(built.userData.regionSurfaces as readonly string[] | undefined) ?? [];
		const positions = built.getAttribute('position');
		if (positions === undefined) return null;
		const uvs = built.getAttribute('uv');
		const subsetPositions: number[] = [];
		const subsetUvs: number[] = [];
		let matched = false;
		for (let triangle = 0; triangle * 3 < surfaceByTriangle.length; triangle += 1) {
			if (surfaceByTriangle[triangle] !== surface.face) continue;
			matched = true;
			for (let corner = 0; corner < 3; corner += 1) {
				const vertex = triangle * 3 + corner;
				subsetPositions.push(
					positions.getX(vertex),
					positions.getY(vertex),
					positions.getZ(vertex)
				);
				subsetUvs.push(uvs?.getX(vertex) ?? 0, uvs?.getY(vertex) ?? 0);
			}
		}
		if (!matched || subsetPositions.length === 0) return null;
		const draw = summarizeDrawGeometry(subject, {
			positions: subsetPositions,
			uvs: [subsetUvs, null]
		});
		return {
			subject,
			geometryRevision: revision,
			metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
			draws: [draw]
		};
	} finally {
		built.dispose();
	}
}

function layoutSurfaceFacts(
	geometry: CompiledLayoutGeometry,
	surface: SceneSurfaceRef,
	subject: string,
	revision: string
): TargetFacts | null {
	switch (surface.kind) {
		case 'wall-side':
			return wallSideFacts(geometry, surface, subject, revision);
		case 'room-floor':
		case 'room-lid': {
			const room = geometry.rooms.find((candidate) => candidate.roomId === surface.roomId);
			return room === undefined ? null : roomPlaneFacts(room, surface, subject, revision);
		}
		case 'region-face': {
			const region = geometry.regions.find((candidate) => candidate.regionId === surface.regionId);
			return region === undefined ? null : regionFaceFacts(region, surface, subject, revision);
		}
	}
}

function analyzeEntity(
	entity: SceneEntity,
	subject: string,
	revision: string,
	current: NonNullable<ReturnType<SceneTargetAnalysisInput['read']>>,
	provider: ModelDerivativeAnalysisProvider | undefined
): TargetFacts | null {
	switch (entity.kind) {
		case 'primitive':
			return primitiveFacts(entity, subject, revision);
		case 'form':
			return formFacts(entity, subject, revision);
		case 'model':
			return modelFacts(entity, subject, revision, current, provider);
		default:
			return null;
	}
}

/**
 * Build the host analysis for one accepted Scene. It answers only for the
 * revision it was read at; a request at another revision, an unknown subject or
 * a missing derivative has no answer, and F4 refuses it.
 */
export function createSceneTargetAnalysis(input: SceneTargetAnalysisInput): TargetAnalysis {
	return (requests: readonly TargetAnalysisRequest[]) => {
		const current = input.read();
		if (current === null || requests.length === 0) return null;
		const facts: TargetFacts[] = [];
		for (const request of requests) {
			if (request.domain === 'layout') {
				const surface = request.surface ?? null;
				if (surface === null) return null;
				if (request.expectedGeometryRevision !== current.layoutRevision) return null;
				const analyzed = layoutSurfaceFacts(
					current.geometry,
					surface,
					request.subject,
					current.layoutRevision
				);
				if (analyzed === null) return null;
				facts.push(analyzed);
				continue;
			}
			if (request.expectedGeometryRevision !== current.sceneRevision) return null;
			const entityId = request.entityId ?? request.subject;
			const entity = current.scene.entities.find((candidate) => candidate.id === entityId);
			if (entity === undefined) return null;
			const analyzed = analyzeEntity(
				entity,
				request.subject,
				current.sceneRevision,
				current,
				input.models
			);
			if (analyzed === null) return null;
			facts.push(analyzed);
		}
		return facts;
	};
}
