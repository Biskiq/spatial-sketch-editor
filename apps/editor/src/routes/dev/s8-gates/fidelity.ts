/**
 * Dev-only PR B linear-target sampling-fidelity chart.
 *
 * Every case acquires its views through the production Finish-view cache and
 * texture store (the editor's unscoped static path: hardware sRGB decode for
 * colour, fetch + identity `createImageBitmap` for raw roles), builds its
 * material with the production `finish-sampling` graph, draws into a linear
 * half-float target and compares patch interiors with renderer-independent
 * expectations from `s8-fidelity-metrics`.
 *
 * The chart runs once per request order. Order `a` acquires colour before data,
 * order `b` data before colour; each order uses its own cache keys (a query
 * suffix on the same bytes), so neither can inherit the other's decode.
 */
import {
	AmbientLight,
	DirectionalLight,
	Mesh,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	type BufferGeometry,
	type Material,
	type Texture
} from 'three';
import { MeshBasicNodeMaterial, type WebGPURenderer } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
	acquireFinishViews,
	finishViewStats,
	releaseFinishViewsForScope,
	type FinishViewLease,
	type FinishViewSource
} from '$lib/render/resources/finish-views';
import { textureSourceMemoryStats } from '$lib/render/resources/texture-store';
import { createFinishChannelMaterial, createFinishMaterial } from '$lib/render/resources/finish-sampling';
import type {
	FinishSamplingPlanEntry,
	StandardMaterialDescriptor
} from '$lib/render/resources/material-descriptor';
import {
	S8_CHART_FIXTURES as FX,
	decodeNormalTexel,
	equalCheck,
	expectedNormalResponseSign,
	fidelityVerdict,
	luminance,
	patchMean,
	planarUvFrame,
	ratioCheck,
	responseSignCheck,
	sampledImageCorner,
	srgbByteToLinear,
	unlitCheck,
	type FidelityCheck,
	type LinearFrame,
	type PatchRect
} from '$lib/dev/s8-fidelity-metrics';
import { renderLinearFrame } from './linear-readback';

const SIZE = 128;
type Order = 'a' | 'b';
type Mapping = Pick<FinishSamplingPlanEntry, 'repeat' | 'rotation' | 'offset'>;
const IDENTITY: Mapping = { repeat: [1, 1], rotation: 0, offset: [0, 0] };

export type FidelityResult = {
	gate: 'fidelity';
	backend: string;
	adapter: string;
	softwareAdapter: boolean;
	orders: { order: Order; checks: FidelityCheck[]; pass: boolean; failed: string[] }[];
	ordersAgree: boolean;
	pass: boolean;
	failed: string[];
};

type TslNode = any;

function entry(
	role: FinishSamplingPlanEntry['role'],
	view: string,
	extra: Partial<FinishSamplingPlanEntry> = {}
): FinishSamplingPlanEntry {
	return { role, view, uvSet: 0, origin: 'legacy', ...IDENTITY, ...extra };
}

function descriptor(
	entries: FinishSamplingPlanEntry[],
	extra: Partial<StandardMaterialDescriptor> & { occlusionStrength?: number } = {}
): StandardMaterialDescriptor {
	const { occlusionStrength = 1, ...rest } = extra;
	return {
		kind: 'standard',
		color: '#ffffff',
		roughness: 1,
		metalness: 0,
		...rest,
		finish: { profile: 'pbr-metallic-roughness/v1', entries, occlusionStrength, normalScale: 1 }
	};
}

/** Screen rects (top-first) for each swatch quadrant interior. */
const QUADRANT_PATCH: Record<keyof typeof FX.swatch.quadrants, PatchRect> = {
	topLeft: [0.1, 0.1, 0.4, 0.4],
	topRight: [0.6, 0.1, 0.9, 0.4],
	bottomLeft: [0.1, 0.6, 0.4, 0.9],
	bottomRight: [0.6, 0.6, 0.9, 0.9]
};
const CENTRE_PATCH: PatchRect = [0.38, 0.38, 0.62, 0.62];
const BORDER_PATCHES: PatchRect[] = [
	[0.02, 0.35, 0.09, 0.65],
	[0.91, 0.35, 0.98, 0.65]
];

function borderMean(frame: LinearFrame): number[] {
	const readings = BORDER_PATCHES.map((rect) => patchMean(frame, rect));
	return [0, 1, 2, 3].map((channel) => readings.reduce((sum, value) => sum + value[channel]!, 0) / readings.length);
}

class Chart {
	readonly checks: FidelityCheck[] = [];
	private readonly leases: FinishViewLease[] = [];
	private readonly disposables: { dispose(): void }[] = [];
	private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	private readonly glbCamera = new OrthographicCamera(0, 1, 1, 0, 0.1, 10);
	private readonly plane = new PlaneGeometry(2, 2);

	constructor(
		private readonly renderer: WebGPURenderer,
		private readonly backend: string,
		readonly order: Order,
		private readonly glb: BufferGeometry
	) {
		this.camera.position.set(0, 0, 2);
		this.camera.lookAt(0, 0, 0);
		this.glbCamera.position.set(0, 0, 2);
		this.glbCamera.lookAt(0, 0, 0);
		this.disposables.push(this.plane);
	}

	uri(path: string): string {
		return `${path}?order=${this.order}`;
	}

	async acquire(sources: FinishViewSource[]): Promise<Record<string, Texture>> {
		const lease = await acquireFinishViews(sources, null);
		this.leases.push(lease);
		if (lease.issues.length > 0) {
			throw new Error(`view acquisition refused: ${lease.issues.map((issue) => issue.code).join(', ')}`);
		}
		return lease.views;
	}

	async draw(
		material: Material,
		options: { glb?: boolean; lights?: (scene: Scene) => void } = {}
	): Promise<LinearFrame> {
		const scene = new Scene();
		scene.add(new Mesh(options.glb ? this.glb : this.plane, material));
		options.lights?.(scene);
		this.disposables.push(material);
		return renderLinearFrame(this.renderer, scene, options.glb ? this.glbCamera : this.camera, SIZE, this.backend);
	}

	dispose(): void {
		for (const lease of this.leases) lease.release();
		for (const item of this.disposables) item.dispose();
	}
}

/** Colour versus data from one image, in this order's request sequence. */
async function swatchCases(chart: Chart): Promise<void> {
	const uri = chart.uri(FX.swatch.uri);
	const colourSource: FinishViewSource = { view: 'swatch|colour', uri, role: 'color' };
	const rawSource: FinishViewSource = { view: 'swatch|raw', uri, role: 'roughness' };
	const first = chart.order === 'a' ? colourSource : rawSource;
	const second = chart.order === 'a' ? rawSource : colourSource;
	const views = { ...(await chart.acquire([first])), ...(await chart.acquire([second])) };

	const colourFrame = await chart.draw(
		createFinishChannelMaterial(descriptor([entry('color', 'swatch|colour')]), views, 'unlit-color')
	);
	for (const [name, rgba] of Object.entries(FX.swatch.quadrants)) {
		const observed = patchMean(colourFrame, QUADRANT_PATCH[name as keyof typeof QUADRANT_PATCH]);
		chart.checks.push(
			unlitCheck(`colour/${name}`, 'colour', observed.slice(0, 3), rgba.slice(0, 3).map(srgbByteToLinear))
		);
	}
	for (const [index, component] of (['r', 'g', 'b', 'a'] as const).entries()) {
		const frame = await chart.draw(
			createFinishChannelMaterial(
				descriptor([entry('roughness', 'swatch|raw', { component })]),
				views,
				{ solo: 'roughness' }
			)
		);
		for (const [name, rgba] of Object.entries(FX.swatch.quadrants)) {
			const observed = patchMean(frame, QUADRANT_PATCH[name as keyof typeof QUADRANT_PATCH]);
			chart.checks.push(unlitCheck(`raw-${component}/${name}`, 'raw', [observed[0]], [rgba[index]! / 255]));
		}
	}
}

/** Packed ORM: one fetch, one view, one sample expression, three reads with factors. */
async function ormCases(chart: Chart): Promise<void> {
	const uri = chart.uri(FX.orm.uri);
	const fetches: string[] = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		if (url.includes('orm-distinct')) fetches.push(url);
		return originalFetch(input, init);
	}) as typeof fetch;
	const createdBefore = finishViewStats().created;
	const sourcesBefore = textureSourceMemoryStats().liveSources;
	let views: Record<string, Texture>;
	try {
		views = await chart.acquire([
			{ view: 'orm', uri, role: 'occlusion' },
			{ view: 'orm', uri, role: 'roughness' },
			{ view: 'orm', uri, role: 'metalness' }
		]);
	} finally {
		globalThis.fetch = originalFetch;
	}
	const plan = descriptor(
		[
			entry('occlusion', 'orm', { component: 'r' }),
			entry('roughness', 'orm', { component: 'g' }),
			entry('metalness', 'orm', { component: 'b' })
		],
		{ roughness: 0.8, metalness: 1, occlusionStrength: 0.5 }
	);
	const lit = createFinishMaterial(plan, views);
	const roles: TslNode[] = [lit.aoNode, lit.roughnessNode, lit.metalnessNode];
	const samples = new Set<number>();
	for (const node of roles) {
		(node as { traverse(callback: (child: TslNode) => void): void }).traverse((child: TslNode) => {
			if (child?.isTextureNode === true && child.value === views.orm) samples.add(child.id);
		});
	}
	chart.checks.push(equalCheck('orm/fetches', 'count', fetches.length, 1, fetches.join(' ')));
	chart.checks.push(equalCheck('orm/views-created', 'count', finishViewStats().created - createdBefore, 1));
	chart.checks.push(equalCheck('orm/source-entries', 'count', textureSourceMemoryStats().liveSources - sourcesBefore, 1));
	chart.checks.push(equalCheck('orm/sample-expressions', 'count', samples.size, 1, '3 role reads'));

	// A diagnostic fragment writes the three lowered role values into RGB.
	const diagnostic = new MeshBasicNodeMaterial({ toneMapped: false });
	diagnostic.colorNode = (vec3 as TslNode)(lit.aoNode, lit.roughnessNode, lit.metalnessNode);
	const frame = await chart.draw(diagnostic);
	lit.dispose();
	const centre = patchMean(frame, CENTRE_PATCH);
	const border = borderMean(frame);
	const [cr, cg, cb] = FX.orm.centre;
	const [br, bg, bb] = FX.orm.border;
	chart.checks.push(
		unlitCheck('orm/centre-ao-rough-metal', 'orm', centre.slice(0, 3), [1 + 0.5 * (cr / 255 - 1), 0.8 * (cg / 255), cb / 255])
	);
	chart.checks.push(
		unlitCheck('orm/border-ao-rough-metal', 'orm', border.slice(0, 3), [1 + 0.5 * (br / 255 - 1), 0.8 * (bg / 255), bb / 255])
	);
}

/** AO darkens indirect light only. */
async function aoCases(chart: Chart): Promise<void> {
	const views = await chart.acquire([{ view: 'ao', uri: chart.uri(FX.orm.uri), role: 'occlusion' }]);
	const plan = descriptor([entry('occlusion', 'ao', { component: 'r' })]);
	const direct = await chart.draw(createFinishMaterial(plan, views), {
		lights: (scene) => {
			const light = new DirectionalLight(0xffffff, 3);
			light.position.set(0, 0, 1);
			scene.add(light, light.target);
		}
	});
	const indirect = await chart.draw(createFinishMaterial(plan, views), {
		lights: (scene) => scene.add(new AmbientLight(0xffffff, 3))
	});
	const ratio = FX.orm.centre[0] / FX.orm.border[0];
	chart.checks.push(
		ratioCheck('ao/direct-unoccluded', 'ao', luminance(patchMean(direct, CENTRE_PATCH)), luminance(borderMean(direct)), 1, 0.01)
	);
	chart.checks.push(
		ratioCheck('ao/indirect-occluded', 'ao', luminance(patchMean(indirect, CENTRE_PATCH)), luminance(borderMean(indirect)), ratio, 0.01)
	);
}

const LIGHTS: Record<string, [number, number, number]> = {
	'+x': [1, 0, 0.3],
	'-x': [-1, 0, 0.3],
	'+y': [0, 1, 0.3],
	'-y': [0, -1, 0.3]
};

function grazing(direction: [number, number, number]): (scene: Scene) => void {
	return (scene) => {
		const light = new DirectionalLight(0xffffff, 3);
		light.position.set(...direction);
		scene.add(light, light.target);
	};
}

/** The plane's and GLB's world frame for one UV set and mapping, pre-storage. */
function frameFor(uvOf: (corner: [number, number]) => [number, number], mapping: Mapping) {
	const corners: [number, number, number][] = [
		[0, 0, 0],
		[1, 0, 0],
		[1, 1, 0]
	];
	const uvs = corners.map(([x, y]) => {
		const raw = uvOf([x, y]);
		const cos = Math.cos(mapping.rotation);
		const sin = Math.sin(mapping.rotation);
		const cx = raw[0] - 0.5;
		const cy = raw[1] - 0.5;
		return [
			(cx * cos + cy * sin) * mapping.repeat[0] + 0.5 + mapping.offset[0],
			(-cx * sin + cy * cos) * mapping.repeat[1] + 0.5 + mapping.offset[1]
		] as [number, number];
	});
	return planarUvFrame(corners, uvs);
}

/** Normal sign under opposed grazing lights, on UV0 and the mirrored/rotated UV1. */
async function normalCases(chart: Chart): Promise<void> {
	const views = await chart.acquire([
		{ view: 'n+', uri: chart.uri(FX.normalPlusY.uri), role: 'normal' },
		{ view: 'n-', uri: chart.uri(FX.normalMinusY.uri), role: 'normal' }
	]);
	type Variant = {
		id: string;
		view: 'n+' | 'n-';
		texel: readonly [number, number, number];
		convention: '+Y' | '-Y';
		glb: boolean;
		uvSet: 0 | 1;
		origin: 'legacy' | 'gltf';
		mapping: Mapping;
		uvOf: (xy: [number, number]) => [number, number];
	};
	const uv0 = (xy: [number, number]): [number, number] => xy;
	const uv1 = (xy: [number, number]): [number, number] => [1 - xy[0], xy[1]];
	const variants: Variant[] = [
		{ id: 'plane/uv0/+Y-image/+Y', view: 'n+', texel: FX.normalPlusY.centre, convention: '+Y', glb: false, uvSet: 0, origin: 'legacy', mapping: IDENTITY, uvOf: uv0 },
		{ id: 'plane/uv0/-Y-image/+Y', view: 'n-', texel: FX.normalMinusY.centre, convention: '+Y', glb: false, uvSet: 0, origin: 'legacy', mapping: IDENTITY, uvOf: uv0 },
		{ id: 'plane/uv0/+Y-image/-Y', view: 'n+', texel: FX.normalPlusY.centre, convention: '-Y', glb: false, uvSet: 0, origin: 'legacy', mapping: IDENTITY, uvOf: uv0 },
		{ id: 'plane/uv0-rot90/+Y-image/+Y', view: 'n+', texel: FX.normalPlusY.centre, convention: '+Y', glb: false, uvSet: 0, origin: 'legacy', mapping: { repeat: [1, 1], rotation: Math.PI / 2, offset: [0, 0] }, uvOf: uv0 },
		{ id: 'glb/uv0/+Y-image/+Y', view: 'n+', texel: FX.normalPlusY.centre, convention: '+Y', glb: true, uvSet: 0, origin: 'gltf', mapping: IDENTITY, uvOf: uv0 },
		{ id: 'glb/uv1-mirrored/+Y-image/+Y', view: 'n+', texel: FX.normalPlusY.centre, convention: '+Y', glb: true, uvSet: 1, origin: 'gltf', mapping: IDENTITY, uvOf: uv1 },
		{ id: 'glb/uv1-mirrored/-Y-image/+Y', view: 'n-', texel: FX.normalMinusY.centre, convention: '+Y', glb: true, uvSet: 1, origin: 'gltf', mapping: IDENTITY, uvOf: uv1 },
		{ id: 'glb/uv1-mirrored-rot90/+Y-image/+Y', view: 'n+', texel: FX.normalPlusY.centre, convention: '+Y', glb: true, uvSet: 1, origin: 'gltf', mapping: { repeat: [1, 1], rotation: Math.PI / 2, offset: [0, 0] }, uvOf: uv1 }
	];
	for (const variant of variants) {
		const plan = descriptor([
			entry('normal', variant.view, {
				uvSet: variant.uvSet,
				origin: variant.origin,
				convention: variant.convention,
				...variant.mapping
			})
		]);
		const frame = frameFor(variant.uvOf, variant.mapping);
		const normal = decodeNormalTexel(variant.texel, variant.convention);
		for (const [lightId, direction] of Object.entries(LIGHTS)) {
			const image = await chart.draw(createFinishMaterial(plan, views), {
				glb: variant.glb,
				lights: grazing(direction)
			});
			const expected = expectedNormalResponseSign(normal, frame, [0, 0, 1], direction);
			chart.checks.push(
				responseSignCheck(
					`normal/${variant.id}/light${lightId}`,
					variant.glb && variant.uvSet === 1 ? 'uv1' : 'normal',
					luminance(patchMean(image, CENTRE_PATCH)),
					luminance(borderMean(image)),
					expected
				)
			);
		}
	}
}

/** Labelled checker corners on the two-UV GLB: legacy vs explicit UV0, mirrored and rotated UV1. */
async function uvCornerCases(chart: Chart): Promise<void> {
	const views = await chart.acquire([{ view: 'checker', uri: chart.uri(FX.checker.uri), role: 'color' }]);
	const inset = FX.checker.cellPx / FX.checker.size / 2;
	const half = 0.02;
	const corners: { name: string; xy: [number, number] }[] = [
		{ name: 'screen-top-left', xy: [inset, 1 - inset] },
		{ name: 'screen-top-right', xy: [1 - inset, 1 - inset] },
		{ name: 'screen-bottom-left', xy: [inset, inset] },
		{ name: 'screen-bottom-right', xy: [1 - inset, inset] }
	];
	const cases: { id: string; uvSet: 0 | 1; origin: 'legacy' | 'gltf'; mapping: Mapping }[] = [
		{ id: 'uv0-legacy', uvSet: 0, origin: 'legacy', mapping: IDENTITY },
		{ id: 'uv0-gltf', uvSet: 0, origin: 'gltf', mapping: IDENTITY },
		{ id: 'uv1-gltf-mirrored', uvSet: 1, origin: 'gltf', mapping: IDENTITY },
		{ id: 'uv1-gltf-mirrored-rot90', uvSet: 1, origin: 'gltf', mapping: { repeat: [1, 1], rotation: Math.PI / 2, offset: [0, 0] } }
	];
	for (const variant of cases) {
		const frame = await chart.draw(
			createFinishChannelMaterial(
				descriptor([entry('color', 'checker', { uvSet: variant.uvSet, origin: variant.origin, ...variant.mapping })]),
				views,
				'unlit-color'
			),
			{ glb: true }
		);
		for (const corner of corners) {
			const [x, y] = corner.xy;
			const meshUv: [number, number] = variant.uvSet === 0 ? [x, y] : [1 - x, y];
			const imageCorner = sampledImageCorner(meshUv, variant.mapping, variant.origin);
			const expected = FX.checker.corners[imageCorner].slice(0, 3).map(srgbByteToLinear);
			const screenY = 1 - y;
			const observed = patchMean(frame, [x - half, screenY - half, x + half, screenY + half]);
			chart.checks.push(
				unlitCheck(`uv/${variant.id}/${corner.name}→${imageCorner}`, 'uv1', observed.slice(0, 3), expected)
			);
		}
	}
}

async function loadGlbGeometry(): Promise<BufferGeometry> {
	const gltf = await new GLTFLoader().loadAsync(FX.twoUvGlb.uri);
	let geometry: BufferGeometry | null = null;
	gltf.scene.traverse((object) => {
		const mesh = object as Mesh;
		if (geometry === null && mesh.isMesh) geometry = mesh.geometry as BufferGeometry;
	});
	if (geometry === null) throw new Error('two-uv GLB has no mesh');
	const found = geometry as BufferGeometry;
	if (!found.hasAttribute('uv') || !found.hasAttribute('uv1')) throw new Error('two-uv GLB lacks uv/uv1');
	return found;
}

export async function runFidelity(
	renderer: WebGPURenderer,
	backend: string,
	adapter: { adapter: string; software: boolean }
): Promise<FidelityResult> {
	const glb = await loadGlbGeometry();
	const orders: FidelityResult['orders'] = [];
	try {
		for (const order of ['a', 'b'] as const) {
			const chart = new Chart(renderer, backend, order, glb);
			try {
				await swatchCases(chart);
				await ormCases(chart);
				await aoCases(chart);
				await normalCases(chart);
				await uvCornerCases(chart);
			} finally {
				chart.dispose();
				releaseFinishViewsForScope('global');
			}
			orders.push({ order, checks: chart.checks, ...fidelityVerdict(chart.checks) });
		}
	} finally {
		glb.dispose();
	}
	const [first, second] = orders;
	const ordersAgree =
		first !== undefined &&
		second !== undefined &&
		first.checks.length === second.checks.length &&
		first.checks.every((check, index) => JSON.stringify(check.observed) === JSON.stringify(second.checks[index]!.observed));
	const failed = orders.flatMap((entry) => entry.failed.map((id) => `${entry.order}:${id}`));
	return {
		gate: 'fidelity',
		backend,
		adapter: adapter.adapter,
		softwareAdapter: adapter.software,
		orders,
		ordersAgree,
		pass: failed.length === 0 && orders.length === 2 && orders.every((entry) => entry.pass),
		failed
	};
}
