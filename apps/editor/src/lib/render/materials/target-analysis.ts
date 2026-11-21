/**
 * Host-owned target analysis for Finish registration.
 *
 * Registration names targets; it does not prove what their geometry can
 * sample. This module derives the facts from the exact geometry the renderer
 * would draw — the same unit primitive, the same evaluated Form buffer, or the
 * exact approved model derivative — and binds them to the revision the host
 * inspected. F4 compares the caller's echo against this analysis and refuses a
 * set, a draw or a basis the host did not derive.
 *
 * It is headless: no Canvas, mesh, material or renderer object is created, so a
 * host with the editor Canvas closed derives the same facts.
 */
import { evaluateFormMesh, formEvaluationKey } from '$lib/content/form-evaluation';
import type {
	RuntimeScene,
	SceneEntity,
	SceneFormEntity,
	ScenePrimitiveEntity
} from '@portfolio/project-model';
import {
	summarizeDrawGeometry,
	type DrawGeometry,
	type TargetAnalysis,
	type TargetAnalysisRequest,
	type TargetFacts,
	type TargetMetricBasis
} from '@portfolio/project-model/materials';
import type { BufferGeometry } from 'three';
import { constructGeometry } from '../resources/geometry-store';
import type { GeometrySpec } from '../resources/scene-render-item';
import {
	scenePrimitiveGeometry,
	scenePrimitiveSurfaceMeters
} from '../scene-render-description';

export type { TargetAnalysis, TargetAnalysisRequest } from '@portfolio/project-model/materials';

/** One approved model derivative, read through the host's one loader cache. */
export type ModelDerivativeAnalysis = {
	/** The digest of the exact bytes these draws were read from. */
	readonly digest: string;
	readonly draws: readonly {
		readonly drawKey: string;
		readonly geometry: DrawGeometry;
	}[];
};

export type ModelDerivativeAnalysisProvider = (
	assetId: string,
	contentRevision: string
) => ModelDerivativeAnalysis | null;

export type SceneTargetAnalysisInput = {
	/** The currently accepted Scene and its exact unit revisions. */
	read: () => {
		readonly scene: RuntimeScene;
		readonly sceneRevision: string;
		readonly layoutRevision: string;
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
	provider: ModelDerivativeAnalysisProvider | undefined
): TargetFacts | null {
	const derivative = provider?.(entity.assetId, revision) ?? null;
	if (derivative === null || derivative.draws.length === 0) return null;
	return {
		subject,
		geometryRevision: revision,
		// A model remap keeps the model's own UV chart; a metric tile has no
		// basis it can claim. Explicit `uv` mapping remains available.
		draws: derivative.draws.map((draw) => summarizeDrawGeometry(draw.drawKey, draw.geometry))
	};
}

function analyzeEntity(
	entity: SceneEntity,
	subject: string,
	revision: string,
	provider: ModelDerivativeAnalysisProvider | undefined
): TargetFacts | null {
	switch (entity.kind) {
		case 'primitive':
			return primitiveFacts(entity, subject, revision);
		case 'form':
			return formFacts(entity, subject, revision);
		case 'model':
			return modelFacts(entity, subject, revision, provider);
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
			// Layout surfaces are qualified from the compiled layout mesh by E's
			// surface analysis; until that derivative is published, a surface
			// target is pending rather than assumed.
			if (request.domain !== 'scene') return null;
			if (request.expectedGeometryRevision !== current.sceneRevision) return null;
			const entityId = request.entityId ?? request.subject;
			const entity = current.scene.entities.find((candidate) => candidate.id === entityId);
			if (entity === undefined) return null;
			const analyzed = analyzeEntity(entity, request.subject, current.sceneRevision, input.models);
			if (analyzed === null) return null;
			facts.push(analyzed);
		}
		return facts;
	};
}
