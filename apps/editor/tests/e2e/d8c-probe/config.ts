/**
 * D8c.1 fixture probe scenarios.
 *
 * Two reference Worlds, four shortlisted candidates, two emission variants and
 * three camera views. Measurements are the acquisition report's, in metres,
 * in the source model's own +Y-up frame; nothing here is production data.
 */
import { skyFromPreset, type SceneSky } from '@portfolio/project-model/units';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { SceneModelEntity, ScenePrimitiveEntity } from '@portfolio/project-model/scene';
import { rotationForLightDirection } from '$lib/authoring/look/light-aim';

export type ProbeCandidateId =
	| 'hanging-industrial'
	| 'modern-ceiling'
	| 'lantern'
	| 'wall-sconce';

export type ProbeWorldId = 'salon' | 'gallery';
export type ProbeEmission = 'source' | 'stripped';
export type ProbeState = 'on' | 'off';
export type ProbeView = 'room' | 'close' | 'range';
export type ProbeAnchor = 'auto' | 'mouth' | 'bulb';

export type FixtureLight = {
	readonly kind: 'point' | 'spot';
	/** Candela. */
	readonly intensity: number;
	/** Metres; 0 is unbounded. */
	readonly range: number;
	/** Spot half-angle, radians. */
	readonly angle?: number;
	/** Spot penumbra, 0–1. */
	readonly penumbra?: number;
};

export type Candidate = {
	readonly id: ProbeCandidateId;
	readonly slug: string;
	readonly label: string;
	readonly creator: string;
	readonly mount: 'ceiling' | 'wall';
	/** The mount datum in the source frame. */
	readonly mountLocal: readonly [number, number, number];
	/** The measured bulb/diffuser anchor in the source frame. */
	readonly bulbLocal: readonly [number, number, number];
	/** The measured lamp-mouth anchor, where a downward shade opens. */
	readonly mouthLocal: readonly [number, number, number];
	readonly defaultAnchor: Exclude<ProbeAnchor, 'auto'>;
	readonly hasBakedEmission: boolean;
	readonly defaultLight: FixtureLight;
	readonly note: string;
};

export const CANDIDATES: Record<ProbeCandidateId, Candidate> = {
	'hanging-industrial': {
		id: 'hanging-industrial',
		slug: 'hanging_industrial_lamp',
		label: 'Hanging Industrial Lamp',
		creator: 'Kuutti Siitonen',
		mount: 'ceiling',
		mountLocal: [0, 0.01534, 0],
		bulbLocal: [0, -1.183, 0],
		mouthLocal: [0, -1.329, 0],
		defaultAnchor: 'mouth',
		hasBakedEmission: true,
		defaultLight: { kind: 'spot', intensity: 4 * Math.PI, range: 6, angle: (25 * Math.PI) / 180, penumbra: 0.5 },
		note: 'glass cylinder is the diffuser; baked emissive map at strength 25'
	},
	'modern-ceiling': {
		id: 'modern-ceiling',
		slug: 'modern_ceiling_lamp_01',
		label: 'Modern Ceiling Lamp 01',
		creator: 'James Ray Cock',
		mount: 'ceiling',
		mountLocal: [0, 1.1726436615, 0],
		bulbLocal: [0, 0.375, 0.002],
		mouthLocal: [0, 0.2210921645, 0.005],
		defaultAnchor: 'bulb',
		hasBakedEmission: true,
		defaultLight: { kind: 'point', intensity: 3 * Math.PI, range: 4.5 },
		note: 'frosted globe; no transmission or alpha extension in the source'
	},
	lantern: {
		id: 'lantern',
		slug: 'lantern_chandelier_01',
		label: 'Lantern Chandelier 01',
		creator: 'Kirill Sannikov',
		mount: 'ceiling',
		mountLocal: [0.0011718, 0.01232924, 0.00852132],
		bulbLocal: [0.001, -0.516, -0.001],
		mouthLocal: [-0.0014, -0.8652586, -0.00015],
		defaultAnchor: 'bulb',
		hasBakedEmission: true,
		defaultLight: { kind: 'point', intensity: 3 * Math.PI, range: 5 },
		note: 'alpha-blended transmissive glass panels; the bulb is the only emitter'
	},
	'wall-sconce': {
		id: 'wall-sconce',
		slug: 'industrial_wall_sconce',
		label: 'Industrial Wall Sconce',
		creator: 'Ulan Cabanilla',
		mount: 'wall',
		mountLocal: [0.0015051, 0.1513963, 0.0080943],
		bulbLocal: [0, 0.107, 0.191],
		mouthLocal: [0, -0.019508, 0.19],
		defaultAnchor: 'bulb',
		hasBakedEmission: false,
		defaultLight: { kind: 'point', intensity: 2 * Math.PI, range: 4 },
		note: 'open metal shade; the bulb is visible; no baked emission at all'
	}
};

export type World = {
	readonly id: ProbeWorldId;
	readonly label: string;
	readonly points: readonly LayoutVec2[];
	readonly height: number;
	readonly sky: SceneSky;
	readonly ceilingMount: readonly [number, number, number];
	readonly wallMount: readonly [number, number, number];
	readonly wallYaw: number;
	readonly ceilingCamera: { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number };
	readonly closeCamera: { offset: readonly [number, number, number]; fov: number };
	readonly rangeCamera: { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number };
	readonly wallCamera: { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number };
	readonly wallCloseCamera: { offset: readonly [number, number, number]; fov: number };
	readonly context: readonly ScenePrimitiveEntity[];
};

function box(
	id: string,
	name: string,
	size: readonly [number, number, number],
	position: readonly [number, number, number],
	materialId: ScenePrimitiveEntity['materialId'],
	rotation: readonly [number, number, number] = [0, 0, 0],
): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name,
		dimensions: { width: size[0], height: size[1], depth: size[2] },
		materialId,
		castShadow: true,
		receiveShadow: true,
		position: [position[0], position[1], position[2]],
		rotation: [rotation[0], rotation[1], rotation[2]],
	};
}

function rug(
	id: string,
	name: string,
	size: readonly [number, number],
	position: readonly [number, number, number],
): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'plane',
		id,
		name,
		dimensions: { width: size[0], height: size[1] },
		materialId: 'textile-carpet-loop',
		castShadow: false,
		receiveShadow: true,
		position: [position[0], position[1], position[2]],
		rotation: [-Math.PI / 2, 0, 0],
	};
}

export const WORLDS: Record<ProbeWorldId, World> = {
	salon: {
		id: 'salon',
		label: 'Salon',
		points: [
			[0, -4],
			[7, -4],
			[7, 2],
			[0, 2]
		],
		height: 3.2,
		sky: skyFromPreset('dusk', -35),
		ceilingMount: [3.5, 3.2, -1],
		wallMount: [7, 1.6, -1],
		wallYaw: -Math.PI / 2,
		ceilingCamera: { position: [1.3, 1.45, 1.1], target: [3.5, 1.95, -1], fov: 50 },
		closeCamera: { offset: [0.95, -0.35, 0.95], fov: 36 },
		rangeCamera: { position: [3.5, 2.9, 1.55], target: [3.5, 0.2, -3.3], fov: 62 },
		wallCamera: { position: [5.0, 1.55, 0.9], target: [7, 1.55, -1], fov: 40 },
		wallCloseCamera: { offset: [-0.85, -0.12, 0.65], fov: 36 },
		context: [
			// The generated room lid is a single upward-facing plane, so a first-person
			// view sees the sky through it. This test-owned panel gives the reference
			// World the lit ceiling a room actually presents.
			box('salon-ceiling', 'Salon ceiling', [7, 0.04, 6], [3.5, 3.18, -1], 'plaster-painted'),
			box('salon-table', 'Salon table', [1.4, 0.75, 0.8], [3.5, 0.375, -1], 'wood-walnut-veneer'),
			rug('salon-rug', 'Salon rug', [3.4, 2.6], [3.5, 0.004, -1]),
			box('salon-sofa', 'Salon sofa', [2.2, 0.78, 0.85], [1.2, 0.39, -3.35], 'textile-linen'),
			box('salon-sideboard', 'Salon sideboard', [1.6, 0.82, 0.45], [5.9, 0.41, -3.55], 'wood-oak-veneer')
		]
	},
	gallery: {
		id: 'gallery',
		label: 'Gallery',
		points: [
			[0, -7],
			[12, -7],
			[12, 0],
			[0, 0]
		],
		height: 4.2,
		sky: skyFromPreset('overcast', 20),
		ceilingMount: [3.0, 4.2, -3.5],
		wallMount: [3.0, 1.7, -7],
		wallYaw: 0,
		ceilingCamera: { position: [0.9, 1.6, -1.6], target: [3.0, 2.35, -3.5], fov: 50 },
		closeCamera: { offset: [1.0, -0.45, 0.95], fov: 36 },
		rangeCamera: { position: [3.0, 3.45, 1.1], target: [3.0, 0.3, -5.9], fov: 64 },
		wallCamera: { position: [3.0, 1.6, -4.3], target: [3.0, 1.6, -7], fov: 38 },
		wallCloseCamera: { offset: [0.7, -0.12, 0.8], fov: 36 },
		context: [
			box('gallery-ceiling', 'Gallery ceiling', [12, 0.04, 7], [6, 4.18, -3.5], 'plaster-painted'),
			box('gallery-bench', 'Gallery bench', [1.8, 0.44, 0.45], [3.0, 0.22, -2.4], 'wood-oak-planks'),
			box('gallery-panel-a', 'Gallery panel A', [1.4, 1.0, 0.04], [1.35, 1.55, -6.9], 'plaster-painted'),
			box('gallery-panel-b', 'Gallery panel B', [1.4, 1.0, 0.04], [4.65, 1.55, -6.9], 'plaster-painted'),
			box('gallery-plinth', 'Gallery plinth', [0.45, 1.0, 0.45], [5.6, 0.5, -5.9], 'concrete-polished')
		]
	}
};

export const LIGHT_COLOR = '#ffd6a5';

function applyYaw(yaw: number, value: readonly [number, number, number]): [number, number, number] {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	return [value[0] * cos + value[2] * sin, value[1], -value[0] * sin + value[2] * cos];
}

export type Scenario = {
	readonly candidate: Candidate;
	readonly world: World;
	readonly emission: ProbeEmission;
	readonly state: ProbeState;
	readonly view: ProbeView;
	readonly anchor: Exclude<ProbeAnchor, 'auto'>;
	readonly light: FixtureLight;
};

export function readScenario(search: URLSearchParams): Scenario {
	const candidateId = (search.get('candidate') ?? 'hanging-industrial') as ProbeCandidateId;
	const worldId = (search.get('world') ?? 'salon') as ProbeWorldId;
	const candidate = CANDIDATES[candidateId];
	const world = WORLDS[worldId];
	if (candidate === undefined) throw new Error(`unknown candidate ${candidateId}`);
	if (world === undefined) throw new Error(`unknown world ${worldId}`);
	const emission = (search.get('emission') ?? 'stripped') as ProbeEmission;
	const state = (search.get('state') ?? 'on') as ProbeState;
	const view = (search.get('view') ?? 'room') as ProbeView;
	const requestedAnchor = (search.get('anchor') ?? 'auto') as ProbeAnchor;
	const anchor = requestedAnchor === 'auto' ? candidate.defaultAnchor : requestedAnchor;
	const intensity = search.get('intensity');
	const range = search.get('range');
	const kind = search.get('kind') as FixtureLight['kind'] | null;
	const angle = search.get('angle');
	const base = candidate.defaultLight;
	const light: FixtureLight = {
		kind: kind ?? base.kind,
		intensity: intensity === null ? base.intensity : Number(intensity),
		range: range === null ? base.range : Number(range),
		...(base.angle === undefined ? {} : { angle: angle === null ? base.angle : (Number(angle) * Math.PI) / 180 }),
		...(base.penumbra === undefined ? {} : { penumbra: base.penumbra })
	};
	if (!Number.isFinite(light.intensity) || !Number.isFinite(light.range)) {
		throw new Error('intensity and range must be finite');
	}
	return { candidate, world, emission, state, view, anchor, light };
}

/** The body pose and the light pose for one scenario, in world metres. */
export function poses(scenario: Scenario): {
	bodyPosition: [number, number, number];
	bodyRotation: [number, number, number];
	anchor: [number, number, number];
	lightPosition: [number, number, number];
	lightRotation: [number, number, number];
} {
	const { candidate, world } = scenario;
	const mountWorld = candidate.mount === 'ceiling' ? world.ceilingMount : world.wallMount;
	const yaw = candidate.mount === 'ceiling' ? 0 : world.wallYaw;
	const anchorLocal = scenario.anchor === 'mouth' ? candidate.mouthLocal : candidate.bulbLocal;
	const mountOffset = applyYaw(yaw, candidate.mountLocal);
	const bodyPosition: [number, number, number] = [
		mountWorld[0] - mountOffset[0],
		mountWorld[1] - mountOffset[1],
		mountWorld[2] - mountOffset[2]
	];
	const anchorOffset = applyYaw(yaw, anchorLocal);
	const anchor: [number, number, number] = [
		bodyPosition[0] + anchorOffset[0],
		bodyPosition[1] + anchorOffset[1],
		bodyPosition[2] + anchorOffset[2]
	];
	const down = applyYaw(yaw, [0, -1, 0]);
	return {
		bodyPosition,
		bodyRotation: [0, yaw, 0],
		anchor,
		lightPosition: anchor,
		lightRotation: scenario.light.kind === 'spot' ? rotationForLightDirection(down) : [0, 0, 0]
	};
}

export function modelEntity(scenario: Scenario, bodyPosition: readonly [number, number, number], bodyRotation: readonly [number, number, number]): SceneModelEntity {
	return {
		kind: 'model',
		id: `probe-body-${scenario.candidate.id}`,
		name: `${scenario.candidate.label} body`,
		assetId: `probe-${scenario.candidate.slug}`,
		fallback: 'lamp',
		position: [bodyPosition[0], bodyPosition[1], bodyPosition[2]],
		rotation: [bodyRotation[0], bodyRotation[1], bodyRotation[2]]
	};
}

export function cameraFor(scenario: Scenario, posesResult: ReturnType<typeof poses>): {
	position: [number, number, number];
	target: [number, number, number];
	fov: number;
} {
	const { world, candidate, view } = scenario;
	if (view === 'close') {
		const offset = candidate.mount === 'wall' ? world.wallCloseCamera.offset : world.closeCamera.offset;
		const fov = candidate.mount === 'wall' ? world.wallCloseCamera.fov : world.closeCamera.fov;
		return {
			position: [
				posesResult.anchor[0] + offset[0],
				posesResult.anchor[1] + offset[1],
				posesResult.anchor[2] + offset[2]
			],
			target: posesResult.anchor,
			fov
		};
	}
	if (view === 'range') {
		return {
			position: [
				world.rangeCamera.position[0],
				world.rangeCamera.position[1],
				world.rangeCamera.position[2]
			],
			target: [
				world.rangeCamera.target[0],
				world.rangeCamera.target[1],
				world.rangeCamera.target[2]
			],
			fov: world.rangeCamera.fov
		};
	}
	const roomCamera = candidate.mount === 'wall' ? world.wallCamera : world.ceilingCamera;
	return {
		position: [roomCamera.position[0], roomCamera.position[1], roomCamera.position[2]],
		target: [roomCamera.target[0], roomCamera.target[1], roomCamera.target[2]],
		fov: roomCamera.fov
	};
}
