/**
 * E7's three reference Worlds, built through the canonical Layout compiler.
 *
 * These are bench Worlds, not authored projects: no unit envelope, no Camera,
 * no Experience. The renderer sees exactly what the shipped Stage and visitor
 * surfaces consume — one `CompiledLayoutGeometry` and one resolved
 * `RuntimeScene` — so a measurement cannot quietly substitute a different
 * architecture or a hand-built mesh set.
 *
 * `gallery-wall` uses six textured Plane primitives rather than A1 Artwork
 * entities. The plan allows textured quads until Artwork is available on the
 * bench; this keeps the measurement on the shipped primitive/material path and
 * does not claim the Artwork path was exercised.
 */
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { NavigationGraph, RuntimeScene, SceneEntity } from '$lib/content/scene';
import type { GridRect } from '$lib/authoring/stage/stage-grid';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import {
	EXECUTION_PROGRAM_FORMAT_VERSION,
	EXECUTION_PROGRAM_KIND,
	validateExecutionProgram,
	type ExecutionProgram
} from '@portfolio/project-model/program';

export type BenchWorldId = 'empty' | 'small-room' | 'gallery-wall';

export type BenchWorld = {
	readonly id: BenchWorldId;
	readonly label: string;
	readonly geometry: CompiledLayoutGeometry;
	readonly scene: RuntimeScene;
	readonly bounds: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] } | null;
	readonly contentBounds: GridRect | null;
	/** The settled bench camera: an eye direction and a visible height at the target plane. */
	readonly camera: {
		readonly target: readonly [number, number, number];
		readonly elevationRadians: number;
		readonly targetPlaneHeightMeters: number;
		readonly fovYDegrees: number;
	};
};

const EMPTY_SCENE: RuntimeScene = { textures: [], materials: [], entities: [], objects: [] };

function galleryLayout(): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const points: readonly LayoutVec2[] = [
		[0, 0],
		[12, 0],
		[12, 7],
		[0, 7]
	];
	const plan = planWallChain({
		baseline,
		points: points.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		capture: { nonce: 'gate-c-gallery' },
		levelId: baseline.floor.id
	});
	if (plan.kind !== 'success') throw new Error(`the gallery bench World no longer plans: ${plan.rejection.code}`);
	return plan.document;
}

function galleryEntities(): SceneEntity[] {
	const entities: SceneEntity[] = [];
	for (let index = 0; index < 6; index += 1) {
		entities.push({
			kind: 'primitive',
			primitive: 'plane',
			id: `gate-c-gallery-quad-${index}`,
			name: `Gallery quad ${index + 1}`,
			// The compiled Wall is centred on the boundary; 0.16 m sits clear of its
			// interior face so the quads are visible, not buried in the wall body.
			position: [2 + index * 1.4, 1.5, 0.16],
			rotation: [0, 0, 0],
			dimensions: { width: 1.2, height: 1.5 },
			materialId: 'wood-walnut',
			castShadow: true,
			receiveShadow: true
		});
	}
	return entities;
}

function compile(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometry(document);
	if (result.issues.length > 0) {
		throw new Error(`the bench World does not compile cleanly: ${result.issues[0]?.code ?? 'unknown'}`);
	}
	return result.geometry;
}

function contentBoundsOf(bounds: BenchWorld['bounds']): GridRect | null {
	return bounds === null
		? null
		: { minX: bounds.min[0], maxX: bounds.max[0], minZ: bounds.min[2], maxZ: bounds.max[2] };
}

function cameraFor(bounds: BenchWorld['bounds']): BenchWorld['camera'] {
	if (bounds === null) {
		return {
			target: [0, 1, 0],
			elevationRadians: 0.32,
			targetPlaneHeightMeters: 8,
			fovYDegrees: 50
		};
	}
	const target: [number, number, number] = [
		(bounds.min[0] + bounds.max[0]) / 2,
		1.4,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	const width = bounds.max[0] - bounds.min[0];
	const depth = bounds.max[2] - bounds.min[2];
	return {
		target,
		elevationRadians: 0.3,
		// The bench camera must sit **inside** the room: the plan's reference
		// Worlds are interior readings. A target plane around 0.42 × the smaller
		// plan extent puts the eye just inside the near wall, with the 2.7 m walls
		// and the gallery quads in frame.
		targetPlaneHeightMeters: Math.min(8, Math.max(2.6, Math.min(width, depth) * 0.42)),
		fovYDegrees: 50
	};
}

function world(id: BenchWorldId, label: string, document: LayoutDocumentWallFirst | null, entities: SceneEntity[]): BenchWorld {
	const geometry = document === null ? compile(createEmptyWallFirstLayoutDocument()) : compile(document);
	const bounds = geometry.bounds;
	return {
		id,
		label,
		geometry,
		scene: { ...EMPTY_SCENE, entities },
		bounds,
		contentBounds: contentBoundsOf(bounds),
		camera: cameraFor(bounds)
	};
}

export const BENCH_WORLDS: readonly BenchWorld[] = [
	world('empty', 'Empty World', null, []),
	world('small-room', 'Small room (7 × 6 m)', buildStarterEnclosureLayout(), []),
	world('gallery-wall', 'Gallery wall (12 × 7 m, six textured quads)', galleryLayout(), galleryEntities())
];

export function benchWorld(id: BenchWorldId): BenchWorld {
	const found = BENCH_WORLDS.find((entry) => entry.id === id);
	if (found === undefined) throw new Error(`unknown bench World: ${id}`);
	return found;
}

/** The eye position for one bench camera pose. */
export function benchEye(world: BenchWorld, azimuthRadians: number): [number, number, number] {
	const { target, elevationRadians, targetPlaneHeightMeters, fovYDegrees } = world.camera;
	const distance = targetPlaneHeightMeters / (2 * Math.tan((fovYDegrees * Math.PI) / 360));
	const horizontal = Math.cos(elevationRadians) * distance;
	return [
		target[0] + Math.sin(azimuthRadians) * horizontal,
		target[1] + Math.sin(elevationRadians) * distance,
		target[2] + Math.cos(azimuthRadians) * horizontal
	];
}

/** The empty navigation graph a Scene-only bench World carries. */
export function emptyNavigation(): NavigationGraph {
	return { navigationNodes: [], connections: [], nodeById: new Map() };
}

/**
 * One Camera View over the bench World, used only by the cold-start surface so a
 * real `VisitorCameraDirector` can mount. It is a bench View, not authored
 * content, and it is never measured as a Camera decision.
 */
export function coldStartNavigation(world: BenchWorld): NavigationGraph {
	const eye = benchEye(world, 0);
	const node = {
		id: 'gate-c-view',
		label: 'Gate C bench view',
		position: eye,
		cameraTarget: [...world.camera.target] as [number, number, number],
		fov: world.camera.fovYDegrees,
		connectedNodeIds: []
	};
	return { navigationNodes: [node], connections: [], nodeById: new Map([[node.id, node]]) };
}

/** A valid, guide-free program with one enterable Presentation. */
export function coldStartProgram(world: BenchWorld): ExecutionProgram {
	const program: ExecutionProgram = {
		kind: EXECUTION_PROGRAM_KIND,
		formatVersion: EXECUTION_PROGRAM_FORMAT_VERSION,
		capabilities: [],
		experienceId: `gate-c-${world.id}`,
		welcome: null,
		pacing: 'manual',
		entryStopId: null,
		presentations: [
			{
				id: 'gate-c-presentation',
				label: 'Gate C bench',
				viewIds: ['gate-c-view'],
				// One View has no pair, so it carries no step.
				steps: [],
				explorable: false,
				content: []
			}
		],
		stops: [],
		state: [],
		localTime: [],
		channels: [],
		lifecycle: [],
		profile: { reducedMotion: 'required', semanticDomNavigation: 'required' }
	};
	const validation = validateExecutionProgram(program);
	if (!validation.success) {
		throw new Error(`the Gate C cold-start program is invalid: ${JSON.stringify(validation)}`);
	}
	return program;
}
