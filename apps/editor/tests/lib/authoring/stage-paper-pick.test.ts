/**
 * R217.S04 — picking under Paper with **real mounted meshes**.
 *
 * The appearance mask hides the world from the camera. It must not change what
 * the pointer can pick: `ScenePickSource.pick` still raycasts the registered
 * entity and Layout roots on the raycaster's default layer-0 mask, and Paper's
 * overlay geometry lives on layer 2 and is never registered.
 *
 * The suite mounts the actual Layout and Scene roots in a Three scene graph
 * registered with `createScenePickSource`, projects through a real orthographic
 * Plan evaluation, and runs S03's `resolveStagePick`. Under both the Paper and
 * Shaded camera masks:
 *
 * - a pick at each footprint's interior and at its edge-halo band resolves to
 *   its entity;
 * - a footprint whose body is unmounted, or hidden, resolves to nothing;
 * - the result sets are identical.
 *
 * The Scene Plan policy is `pickPlanSceneSubject`, the production function the
 * Scene adapter calls; the test wrapper only converts a Stage query into it.
 */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Layers, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import {
	createViewportCameraState,
	evaluateViewport,
	pointerRay,
	projectWorld,
	type ViewportEvaluation
} from '@portfolio/camera-core';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	evaluateLayoutPlan,
	eligiblePlanFragments,
	planWallChain,
	type CompiledLayoutGeometry,
	type LayoutVec2,
	type PlanEvaluation
} from '@portfolio/layout-core';
import type { RuntimeScene } from '@portfolio/project-model';
import type { SceneDocument, SceneEntity } from '$lib/content/scene';
import { createPlanPickProvider } from '$lib/authoring/layout/plan-pick-provider';
import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { pickPlanSceneSubject } from '$lib/authoring/scene/plan-scene-hit';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { buildPaperPlan, PAPER_LAYER, stageCameraLayerMask, STAGE_OVERLAY_LAYER, STAGE_WORLD_LAYER } from '$lib/authoring/stage/paper-plan';
import { resolveStagePick, type StagePickProvider } from '$lib/authoring/stage/stage-pick';
import type {
	StageAdapterBinding,
	StageAdapterContext,
	StageDomainPick,
	StagePickQuery
} from '$lib/authoring/stage/stage-facade';
import { STARTER_ENCLOSURE_POINTS } from '$lib/authoring/stage/starter-gallery';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

function compileStarter(): CompiledLayoutGeometry {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: STARTER_ENCLOSURE_POINTS.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error(`the starter no longer plans: ${planned.rejection.code}`);
	return compileWallFirstLayoutGeometry(planned.document).geometry;
}

function evaluatePlan(compiled: CompiledLayoutGeometry): PlanEvaluation {
	const bounds = compiled.bounds!;
	const target: LayoutVec2 = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
	const result = evaluateLayoutPlan(
		compiled,
		{ cutHeightMeters: 1.2, depthMeters: 100, lateralSpanHalfWidthMeters: null, sourceKindFilter: null, reveal: [] },
		{ generationId: 'generation-pick', target, datumMeters: 0 }
	);
	if (result.kind !== 'evaluated') throw new Error('the fixture Plan did not evaluate');
	return result.plan;
}

function evaluateView(plan: PlanEvaluation): ViewportEvaluation {
	const camera = createViewportCameraState({
		outputId: 'output-paper-pick',
		sessionEpoch: 'session-paper-pick',
		sourceRevision: 'content-paper-pick',
		reading: 'plan',
		pose: {
			target: [plan.target[0], plan.datumMeters, plan.target[1]],
			azimuthRadians: Math.PI / 4,
			elevationRadians: Math.PI / 2,
			targetPlaneHeightMeters: 12
		},
		sceneRadiusMeters: 8
	});
	const result = evaluateViewport(camera, RECT, 0, 1);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	expect(result.evaluation.renderedReading).toBe('plan');
	expect(result.evaluation.orthographicWeight).toBe(1);
	return result.evaluation;
}

function primitive(id: string, position: [number, number, number]): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions: { width: 1, height: 1.6, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

const ENTITIES: SceneEntity[] = [
	primitive('entity-box', [2, 0, 2]),
	primitive('entity-second', [5, 0, 2]),
	primitive('entity-unmounted', [8, 0, 2]),
	primitive('entity-hidden', [2, 0, 5])
];

type Mounted = {
	readonly scene: RuntimeScene;
	readonly pick: ReturnType<typeof createScenePickSource>;
	readonly context: StageAdapterContext;
	readonly sources: readonly StagePickProvider[];
	readonly roots: ReadonlyMap<string, Group>;
	readonly sceneDocument: Pick<SceneDocument, 'entities'>;
};

function mount(plan: PlanEvaluation, compiled: CompiledLayoutGeometry): Mounted {
	const sceneDocument = { entities: ENTITIES } as Pick<SceneDocument, 'entities'>;
	const runtimeScene = sceneDocument as unknown as RuntimeScene;
	const pick = createScenePickSource();
	pick.setSource(runtimeScene);

	const graph = new Scene();
	const layoutRoot = new Group();
	const floor = new Mesh(new BoxGeometry(40, 0.2, 40), new MeshBasicMaterial());
	floor.name = 'VisitorFloor:fixture';
	floor.position.y = -0.2;
	layoutRoot.add(floor);
	graph.add(layoutRoot);
	pick.registerLayout(layoutRoot);

	const roots = new Map<string, Group>();
	for (const entity of ENTITIES) {
		if (entity.kind === 'light') continue;
		const root = new Group();
		root.position.set(entity.position[0], entity.position[1], entity.position[2]);
		const body = new Mesh(new BoxGeometry(1, 1.6, 1), new MeshBasicMaterial());
		body.position.y = 0.8;
		root.add(body);
		graph.add(root);
		roots.set(entity.id, root);
		// Deliberately do not register `entity-unmounted`; `entity-hidden` is mounted
		// but hidden, which is the pick source's existing skip rule.
		if (entity.id !== 'entity-unmounted') pick.register(entity.id, root);
		if (entity.id === 'entity-hidden') root.visible = false;
	}

	const evaluation = evaluateView(plan);
	const token = evaluation.token;
	const footprints = planSceneFootprintsFor(sceneDocument, undefined).footprints;
	const context = {
		snapshot: { domain: { geometry: compiled, datumMeters: 0, scene: runtimeScene } },
		evaluation,
		evaluationId: 'evaluation',
		project: (point: readonly [number, number, number]) => {
			const projected = projectWorld(point as [number, number, number], evaluation, token);
			return projected.kind === 'projected' && projected.visibility !== 'behind' ? projected.css : null;
		},
		ray: (css: readonly [number, number]) => {
			const result = pointerRay(css, evaluation, token);
			return result.kind === 'ray' ? result.ray : null;
		},
		pickScene: (ray: Parameters<typeof pick.pick>[0]) => pick.pick(ray, runtimeScene),
		selection: () => null,
		selectionState: () => undefined,
		setSelection: () => undefined,
		select: () => undefined,
		requestIntent: () => undefined,
		intersect: () => undefined,
		sceneBounds: () => null
	} as unknown as StageAdapterContext;

	const layoutPicker = createPlanPickProvider(() => ({ kind: 'evaluated', plan }));
	const sceneProvider: StageAdapterBinding = {
		pick(query: StagePickQuery): StageDomainPick | null {
			const css: [number, number] = [query.css[0] + evaluation.rect.left, query.css[1] + evaluation.rect.top];
			const ray = context.ray(css);
			if (ray === null) return null;
			const drawn = context.pickScene(ray);
			if (drawn?.kind === 'layout' || (drawn?.kind === 'floor' && evaluation.renderedReading !== 'plan')) return null;
			const t = (context.snapshot.domain.datumMeters - ray.origin[1]) / ray.direction[1];
			if (!(t >= 0 && Number.isFinite(t))) return null;
			const point: LayoutVec2 = [ray.origin[0] + ray.direction[0] * t, ray.origin[2] + ray.direction[2] * t];
			const picked = pickPlanSceneSubject({
				footprints,
				point,
				edgeHaloMeters: 6 * evaluation.targetPlaneMetersPerCssPixel,
				datumMeters: context.snapshot.domain.datumMeters,
				datumDistanceMeters: t,
				pixelsPerMeter: evaluation.targetPlaneMetersPerCssPixel,
				ray,
				pickScene: (probe) => context.pickScene(probe),
				projectWorld: (probe) => context.project(probe),
				rayAtCss: (probeCss) => context.ray(probeCss)
			});
			if (picked === null) return null;
			return {
				hit: {
					sourceId: picked.entityId,
					sourceKind: 'entity',
					reference: {} as never,
					worldPoint: [ray.origin[0] + ray.direction[0] * picked.distanceMeters, ray.origin[1] + ray.direction[1] * picked.distanceMeters, ray.origin[2] + ray.direction[2] * picked.distanceMeters]
				},
				refusal: null,
				depthMeters: drawn?.kind === 'entity' ? drawn.distanceMeters : null,
				planLayer: PAPER_LAYER.sceneFootprint,
				cssDistance: picked.cssDistance
			};
		}
	};

	return {
		scene: runtimeScene,
		pick,
		context,
		roots,
		sceneDocument,
		sources: [
			{ adapterId: 'layout', binding: { pick: layoutPicker } },
			{ adapterId: 'scene', binding: sceneProvider }
		]
	};
}

function screenOf(context: StageAdapterContext, world: readonly [number, number, number]): [number, number] {
	const projected = context.project(world as [number, number, number]);
	if (projected === null) throw new Error('the probe did not project');
	return [projected[0], projected[1]];
}

function pickAt(mounted: Mounted, css: readonly [number, number]): string | null {
	const winner = resolveStagePick(
		{ evaluationId: mounted.context.evaluationId, css, purpose: 'select', tool: null },
		mounted.sources,
		mounted.context,
		'plan'
	);
	if (winner === null) return null;
	return winner.pick.hit.sourceKind === 'entity' ? winner.pick.hit.sourceId : `layout:${winner.pick.hit.sourceId}`;
}

function footprintCentre(footprint: NonNullable<ReturnType<typeof planSceneFootprintsFor>['footprints'][number]>): LayoutVec2 {
	const points = footprint.polygons?.[0] ?? footprint.points;
	return points.reduce<LayoutVec2>(
		(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
		[0, 0]
	);
}

function cameraWithMask(evaluation: ViewportEvaluation, paper: boolean): PerspectiveCamera {
	const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
	camera.matrixAutoUpdate = false;
	camera.matrix.fromArray(evaluation.inverseViewMatrix as number[]);
	camera.matrixWorldNeedsUpdate = true;
	camera.projectionMatrix.fromArray(evaluation.projectionMatrix as number[]);
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	camera.updateMatrixWorld(true);
	camera.layers.disableAll();
	for (const layer of stageCameraLayerMask(paper)) camera.layers.enable(layer);
	return camera;
}

describe('Paper Plan — picking with real mounted meshes', () => {
	const compiled = compileStarter();
	const plan = evaluatePlan(compiled);
	const mounted = mount(plan, compiled);
	const projection = planSceneFootprintsFor(mounted.sceneDocument, undefined);

	it('resolves each mounted footprint interior to its own entity', () => {
		for (const entityId of ['entity-box', 'entity-second']) {
			const footprint = projection.footprints.find((candidate) => candidate.entityId === entityId)!;
			const centre = footprintCentre(footprint);
			const css = screenOf(mounted.context, [centre[0], 0, centre[1]]);
			expect(pickAt(mounted, css), entityId).toBe(entityId);
		}
	});

	it('resolves an edge-halo pick through the footprint’s own silhouette', () => {
		const footprint = projection.footprints.find((candidate) => candidate.entityId === 'entity-box')!;
		const [minX, minZ] = footprint.points.reduce<LayoutVec2>(
			(low, point) => [Math.min(low[0], point[0]), Math.min(low[1], point[1])],
			[Infinity, Infinity]
		);
		const [maxX] = footprint.points.reduce<LayoutVec2>(
			(high, point) => [Math.max(high[0], point[0]), Math.max(high[1], point[1])],
			[-Infinity, -Infinity]
		);
		// Three CSS pixels outside the near edge, inside the six-pixel halo band.
		const css = screenOf(mounted.context, [(minX + maxX) / 2, 0, minZ - 3 * mounted.context.evaluation.targetPlaneMetersPerCssPixel]);
		expect(pickAt(mounted, css)).toBe('entity-box');
	});

	it('resolves no entity where the body is unmounted or hidden', () => {
		for (const entityId of ['entity-unmounted', 'entity-hidden']) {
			const footprint = projection.footprints.find((candidate) => candidate.entityId === entityId)!;
			const centre = footprintCentre(footprint);
			const css = screenOf(mounted.context, [centre[0], 0, centre[1]]);
			// The eligible Room floor may still answer below the empty footprint; what
			// must not happen is the unmounted/hidden entity winning.
			const winner = pickAt(mounted, css);
			expect(winner, entityId).not.toBe(entityId);
			expect(winner?.startsWith('entity-') ?? false, entityId).toBe(false);
		}
	});

	it('returns the same winners under the Paper and Shaded camera masks', () => {
		const queries: Array<readonly [number, number]> = [];
		for (const footprint of projection.footprints) {
			const centre = footprintCentre(footprint);
			queries.push(screenOf(mounted.context, [centre[0], 0, centre[1]]));
		}
		const results: Record<string, Array<string | null>> = {};
		for (const paper of [true, false]) {
			const camera = cameraWithMask(mounted.context.evaluation, paper);
			const world = new Layers();
			world.disableAll();
			world.enable(STAGE_WORLD_LAYER);
			const overlay = new Layers();
			overlay.disableAll();
			overlay.enable(STAGE_OVERLAY_LAYER);
			expect(camera.layers.test(world)).toBe(!paper);
			expect(camera.layers.test(overlay)).toBe(true);

			// The pick source is unaffected: the ray still reaches the undrawn world.
			const first = projection.footprints[0]!;
			const centre = footprintCentre(first);
			const ray = mounted.context.ray(screenOf(mounted.context, [centre[0], 0, centre[1]]));
			expect(ray).not.toBeNull();
			if (ray !== null) expect(mounted.pick.pick(ray, mounted.scene)?.entityId).toBe(first.entityId);
			results[paper ? 'paper' : 'shaded'] = queries.map((css) => pickAt(mounted, css));
		}
		expect(results.paper).toEqual(results.shaded);
		expect(results.paper).toContain('entity-box');
	});

	it('draws a registered entity only after its root receives a renderable mesh', () => {
		const late = primitive('entity-late', [2, 0, 2]);
		const document = { entities: [late] } as Pick<SceneDocument, 'entities'>;
		const runtimeScene = document as unknown as RuntimeScene;
		const pick = createScenePickSource();
		pick.setSource(runtimeScene);
		const root = new Group();
		pick.register('entity-late', root);
		const projection = planSceneFootprintsFor(document, undefined);
		const draw = () => buildPaperPlan(plan, compiled, projection, {
			isFootprintMounted: (entityId) => pick.hasPickableBody(entityId)
		});

		// The root exists before the lazy model/form renderer mounts its geometry.
		expect(pick.hasPickableBody('entity-late')).toBe(false);
		expect(draw().footprints).toHaveLength(0);

		const body = new Mesh(new BoxGeometry(1, 1.6, 1), new MeshBasicMaterial());
		root.add(body);
		pick.refresh();
		expect(pick.hasPickableBody('entity-late')).toBe(true);
		expect(draw().footprints.map((footprint) => footprint.entityId)).toEqual(['entity-late']);

		// A body that later becomes unrenderable is no longer drawn.
		body.visible = false;
		expect(pick.hasPickableBody('entity-late')).toBe(false);
		expect(draw().footprints).toHaveLength(0);
	});

	it('keeps the Layout Plan providers’ own ranks and still resolves a cut Wall', () => {
		const layoutOnly = mounted.sources[0]!;
		const wall = eligiblePlanFragments(plan).find((fragment) => fragment.ref.sourceKind === 'wall' && fragment.geometry.kind === 'span');
		expect(wall).toBeDefined();
		if (wall === undefined || wall.geometry.kind !== 'span') return;
		const [start, end] = [wall.geometry.start, wall.geometry.end];
		const css = screenOf(mounted.context, [(start[0] + end[0]) / 2, wall.elevationMeters, (start[1] + end[1]) / 2]);
		const winner = resolveStagePick(
			{ evaluationId: mounted.context.evaluationId, css, purpose: 'select', tool: null },
			[layoutOnly],
			mounted.context,
			'plan'
		);
		expect(winner?.pick.hit.sourceKind).toBe('wall');
		expect(winner?.pick.planLayer).toBe(PAPER_LAYER.cut);
	});
});
