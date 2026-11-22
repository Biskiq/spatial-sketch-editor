/**
 * E7's automated technical checks, run in the browser on the observed backend.
 *
 * Passing them is not acceptance of F's catalogue intake: they measure neither
 * distinctness between entries nor readability at a display size.
 *
 * Every check drives the product host on the page's real renderer with the
 * fixture's real project. It reports what it measured; a check that could not
 * run is a failure, never a pass.
 */
import { Color, PerspectiveCamera, Vector3, type Scene } from 'three';
import type { SceneSky } from '@portfolio/project-model/units';
import { materials as catalogue } from '$lib/content/materials';
import { analyzeHighlightFrame, highlightVerdict } from '$lib/dev/s8-gate-metrics';
import {
	S8_CHART_FIXTURES,
	luminance,
	patchMean,
	srgbByteToLinear,
	type LinearFrame,
	type PatchRect
} from '$lib/dev/s8-fidelity-metrics';
import { deltaE2000, labFromLinearSrgb } from '$lib/dev/s8-colour-difference';
import type { CanvasRendererState } from '$lib/render/renderer-context';
import type { RenderResources } from '$lib/render/resources/render-resources';
import { finishViewStats } from '$lib/render/resources/finish-views';
import {
	INSPECTION_THUMBNAIL_BACKGROUND,
	createInspectionCamera,
	renderInspectionFrame,
	type InspectionFrame,
	type InspectionRenderer
} from '$lib/render/materials/inspection';
import { catalogueThumbnailUri } from '$lib/render/materials/catalogue-thumbnails';
import {
	createInspectionGeometry,
	type InspectionGeometryKind
} from '$lib/render/materials/inspection-geometry';
import {
	createInspectionHost,
	type InspectionHost,
	type InspectionRequest,
	type InspectionState
} from '$lib/render/materials/inspection-host';
import type { InspectionSubject } from '$lib/render/materials/inspection-subject';
import { worldLightSampleFor, type WorldLightSample } from '$lib/render/materials/inspection-world';
import { INSPECTION_ANCHOR, type InspectionFixture } from './fixture';

const GEOMETRIES: readonly InspectionGeometryKind[] = ['sphere', 'plane', 'block'];
const DELTA_E_LIMIT = 2;
const STATE_TIMEOUT_MS = 30_000;

export type GateEnvironment = {
	readonly resources: RenderResources;
	readonly fixture: InspectionFixture;
	/** The page's own host, which follows the Canvas through a device loss. */
	readonly pageHost: InspectionHost;
	renderer(): CanvasRendererState | null;
	stageScene(): Scene | null;
	stageCamera(): string;
	/** Show the fixture World under this Sky (null is Paper) and settle the Stage. */
	showWorld(sky: SceneSky | null): Promise<void>;
	/** Mount or unmount the reference list and settle it. */
	showReferences(open: boolean): Promise<void>;
};

export type GateCheck = { readonly id: string; readonly pass: boolean; readonly measured: unknown };

export type GateReport = {
	readonly backend: string;
	readonly pass: boolean;
	readonly failed: readonly string[];
	readonly checks: readonly GateCheck[];
};

function round(value: number): number {
	return Math.round(value * 1e4) / 1e4;
}

function linear(frame: { pixels: ArrayLike<number>; width: number; height: number }): LinearFrame {
	const pixels = new Float32Array(frame.pixels.length);
	for (let index = 0; index < pixels.length; index += 1) {
		const value = frame.pixels[index]!;
		pixels[index] = index % 4 === 3 ? value / 255 : srgbByteToLinear(value);
	}
	return { pixels, width: frame.width, height: frame.height };
}

/** Patch-mean ΔE00 between two frames. */
function patchDifference(one: LinearFrame, two: LinearFrame, rects: readonly PatchRect[]): number[] {
	return rects.map((rect) =>
		round(deltaE2000(labFromLinearSrgb(patchMean(one, rect)), labFromLinearSrgb(patchMean(two, rect))))
	);
}

function grid(cells: number): PatchRect[] {
	const rects: PatchRect[] = [];
	for (let row = 0; row < cells; row += 1) {
		for (let column = 0; column < cells; column += 1) {
			rects.push([column / cells, row / cells, (column + 1) / cells, (row + 1) / cells]);
		}
	}
	return rects;
}

/** Patches inside the sphere's silhouette (radius 0.4 of the frame). */
const SPHERE_PATCHES: readonly PatchRect[] = [
	[0, 0], [-0.19, 0], [0.19, 0], [0, -0.19], [0, 0.19], [-0.13, -0.13], [0.13, 0.13]
].map(([x, y]) => [0.46 + x!, 0.46 + y!, 0.54 + x!, 0.54 + y!] as const);

function meanAbsolute(one: InspectionFrame, two: InspectionFrame): number {
	let sum = 0;
	for (let index = 0; index < one.pixels.length; index += 1) sum += Math.abs(one.pixels[index]! - two.pixels[index]!);
	return round(sum / one.pixels.length);
}

function mirrored(frame: InspectionFrame): InspectionFrame {
	const pixels = new Uint8Array(frame.pixels.length);
	const row = frame.width * 4;
	for (let y = 0; y < frame.height; y += 1) {
		pixels.set(frame.pixels.subarray(y * row, (y + 1) * row), (frame.height - 1 - y) * row);
	}
	return { ...frame, pixels };
}

async function decode(uri: string): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
	const response = await fetch(uri);
	if (!response.ok) throw new Error(`${uri}: ${response.status}`);
	const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d')!;
	context.drawImage(bitmap, 0, 0);
	const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
	bitmap.close();
	return { pixels: image.data, width: image.width, height: image.height };
}

/**
 * The asymmetric checker, point by point: each visible surface point must show
 * the texel its UV names, at the row the top-first frame puts it. An explicit
 * UV binding reads row `v` (glTF origin); a target binding reads row `1 − v`.
 */
function orientation(
	kind: InspectionGeometryKind,
	frame: InspectionFrame,
	image: { pixels: Uint8ClampedArray; width: number; height: number },
	origin: 'gltf' | 'legacy'
): { samples: number; matched: number; colours: number } {
	const points: { position: Vector3; normal: Vector3; uv: [number, number] }[] = [];
	if (kind === 'plane') {
		for (let row = 0; row < 16; row += 1) {
			for (let column = 0; column < 16; column += 1) {
				const uv: [number, number] = [(column + 0.5) / 16, (row + 0.5) / 16];
				points.push({ position: new Vector3(uv[0] - 0.5, uv[1] - 0.5, 0), normal: new Vector3(0, 0, 1), uv });
			}
		}
	} else if (kind === 'sphere') {
		// SphereGeometry's own chart, sampled finely enough to land in the asymmetric markers.
		for (let row = 0; row < 64; row += 1) {
			for (let column = 0; column < 64; column += 1) {
				const uv: [number, number] = [(column + 0.5) / 64, (row + 0.5) / 64];
				const phi = uv[0] * Math.PI * 2;
				const theta = (1 - uv[1]) * Math.PI;
				const normal = new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
				points.push({ position: normal.clone().multiplyScalar(0.5), normal, uv });
			}
		}
	} else {
		const { geometry } = createInspectionGeometry(kind);
		const position = geometry.getAttribute('position');
		const normal = geometry.getAttribute('normal');
		const uv = geometry.getAttribute('uv');
		for (let index = 0; index < position.count; index += 1) {
			points.push({
				position: new Vector3(position.getX(index), position.getY(index), position.getZ(index)),
				normal: new Vector3(normal.getX(index), normal.getY(index), normal.getZ(index)),
				uv: [uv.getX(index), uv.getY(index)]
			});
		}
		geometry.dispose();
	}
	const camera: PerspectiveCamera = createInspectionCamera(kind);
	camera.updateMatrixWorld();
	let samples = 0;
	let matched = 0;
	const colours = new Set<string>();
	for (const point of points) {
		// The sphere's markers sit toward its limb, still magnified at this size.
		const facing = kind === 'sphere' ? 0.2 : 0.6;
		if (camera.position.clone().sub(point.position).normalize().dot(point.normal) < facing) continue;
		const x = point.uv[0] * image.width;
		const y = (origin === 'gltf' ? point.uv[1] : 1 - point.uv[1]) * image.height;
		if (x < 5 || y < 5 || x > image.width - 5 || y > image.height - 5) continue;
		const texel = (tx: number, ty: number): number[] => {
			const at = (Math.floor(ty) * image.width + Math.floor(tx)) * 4;
			return [image.pixels[at]!, image.pixels[at + 1]!, image.pixels[at + 2]!];
		};
		const expected = texel(x, y);
		// A filtered edge has no one expected colour.
		const interior = [[-5, -5], [5, -5], [-5, 5], [5, 5]].every(
			([dx, dy]) => texel(x + dx!, y + dy!).join() === expected.join()
		);
		if (!interior) continue;
		const projected = point.position.clone().project(camera);
		const column = Math.floor(((projected.x + 1) / 2) * frame.width);
		const row = Math.floor(((1 - projected.y) / 2) * frame.height);
		const at = (row * frame.width + column) * 4;
		samples += 1;
		colours.add(expected.join());
		if (expected.every((value, channel) => Math.abs(frame.pixels[at + channel]! - value) <= 16)) matched += 1;
	}
	return { samples, matched, colours: colours.size };
}

export async function runE7Gate(environment: GateEnvironment): Promise<GateReport> {
	const { fixture, resources } = environment;
	const { drafts } = fixture;
	const checks: GateCheck[] = [];
	async function check(id: string, run: () => Promise<{ pass: boolean; measured: unknown }>): Promise<void> {
		try {
			checks.push({ id, ...(await run()) });
		} catch (error) {
			checks.push({ id, pass: false, measured: { error: error instanceof Error ? error.message : String(error) } });
		}
	}

	const state = environment.renderer();
	if (state?.renderer == null || state.backend === null) throw new Error('the renderer is not ready');
	const renderer = state.renderer as InspectionRenderer;
	const backend = state.backend;
	const viewGeneration = { ...state.viewGeneration };

	function newHost(using: InspectionRenderer = renderer): InspectionHost {
		const host = createInspectionHost({ materials: resources.materials, lights: resources.lights });
		host.attach({ renderer: using, backend: backend!, viewGeneration });
		return host;
	}
	function settle(host: InspectionHost, request: InspectionRequest): Promise<InspectionState> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('inspection did not settle')), STATE_TIMEOUT_MS);
			host.observe(request, (next) => {
				if (next.status === 'pending') return;
				clearTimeout(timer);
				resolve(next);
			});
		});
	}
	const request = (subject: InspectionSubject, options: Partial<InspectionRequest> = {}): InspectionRequest => ({
		subject,
		geometry: 'sphere',
		lighting: 'studio',
		display: 'lit',
		sizePx: [256, 256],
		...options
	});
	const draft = (value: (typeof drafts)['corrected']): InspectionSubject => ({ kind: 'draft', draft: value });
	const sample = (sky: SceneSky | null, anchor: WorldLightSample['anchorWorld'] = INSPECTION_ANCHOR) =>
		worldLightSampleFor({
			scene: fixture.scene,
			acceptedRevision: fixture.revision,
			sky,
			frame: fixture.frame,
			anchorWorld: anchor
		});
	const held = () => ({
		materials: resources.materials.stats().live,
		lights: resources.lights.stats().live,
		views: finishViewStats().live
	});

	await environment.showWorld(fixture.sky);
	const heldBefore = held();
	const projectBefore = fixture.projectState();
	const cameraBefore = environment.stageCamera();
	const host = newHost();

	async function drawn(subject: InspectionSubject, options: Partial<InspectionRequest> = {}): Promise<InspectionFrame> {
		const next = await settle(host, request(subject, options));
		if (next.status !== 'ready') throw new Error(`expected ready: ${JSON.stringify(next.status === 'pending' ? next : { status: next.status, issues: next.issues })}`);
		return next.frame;
	}

	await check('accepted Finish and corrected draft on every geometry', async () => {
		const measured: Record<string, string> = {};
		for (const geometry of GEOMETRIES) {
			for (const [name, subject] of [['finish', fixture.finish], ['draft', draft(drafts.corrected)]] as const) {
				for (const display of ['lit', 'unlit-color', { solo: 'normal' }, { solo: 'roughness' }] as const) {
					const next = await settle(host, request(subject, { geometry, display }));
					const label = typeof display === 'string' ? display : display.solo;
					measured[`${name}/${geometry}/${label}`] = next.status;
				}
			}
		}
		return { pass: Object.values(measured).every((status) => status === 'ready'), measured };
	});

	await check('roughness 0.2 is narrower and brighter than 0.8', async () => {
		const options = { sizePx: [192, 192] } as const;
		const smooth = analyzeHighlightFrame(await drawn(draft(drafts.metalSmooth), options), 0.2);
		const rough = analyzeHighlightFrame(await drawn(draft(drafts.metalRough), options), 0.8);
		const verdict = highlightVerdict(smooth, rough);
		return { pass: verdict.pass, measured: { smooth, rough, verdict } };
	});

	await check('normal Y sign reverses the grazing response', async () => {
		const centre: PatchRect = [0.42, 0.42, 0.58, 0.58];
		const measured: Record<string, number> = {};
		for (const convention of ['+Y', '-Y'] as const) {
			const read = async (file: 'plus' | 'minus'): Promise<number> =>
				luminance(
					patchMean(
						linear(await drawn(draft(drafts.normals[file][convention]), { geometry: 'plane', lighting: 'grazing' })),
						centre
					)
				);
			measured[convention] = round((await read('plus')) - (await read('minus')));
		}
		return { pass: measured['+Y']! > 4 / 255 && measured['-Y']! < -4 / 255, measured };
	});

	await check('checker orientation on every geometry', async () => {
		const image = await decode(S8_CHART_FIXTURES.checker.uri);
		const measured: Record<string, ReturnType<typeof orientation>> = {};
		for (const geometry of GEOMETRIES) {
			// Large enough that the checker's cells outlast the edge filter.
			const frame = await drawn(fixture.finish, { geometry, display: 'unlit-color', sizePx: [768, 768] });
			measured[`${geometry}/uv`] = orientation(geometry, frame, image, 'gltf');
		}
		// The sphere's chart is not one tile per metre, so only these two are identity.
		for (const geometry of ['plane', 'block'] as const) {
			const frame = await drawn(draft(drafts.oneMetre), { geometry, display: 'unlit-color', sizePx: [768, 768] });
			measured[`${geometry}/target`] = orientation(geometry, frame, image, 'legacy');
		}
		return {
			pass: Object.values(measured).every(
				(result) => result.samples >= 20 && result.colours >= 3 && result.matched / result.samples >= 0.98
			),
			measured
		};
	});

	await check('metre spacing: a half-metre tile repeats twice per metre', async () => {
		const read = (value: (typeof drafts)['corrected']) =>
			drawn(draft(value), { geometry: 'plane', display: 'unlit-color' });
		const half = await read(drafts.halfMetre);
		const twice = await read(drafts.twiceUv);
		const one = await read(drafts.oneMetre);
		// The two origins differ only by row: a target binding is the UV binding mirrored.
		const measured = { toRepeatTwo: meanAbsolute(half, mirrored(twice)), toOneMetre: meanAbsolute(half, one) };
		return { pass: measured.toRepeatTwo <= 1 && measured.toOneMetre > 10, measured };
	});

	for (const [label, sky] of [['Sky', fixture.sky], ['Paper', null]] as const) {
		await check(`Current World matches the Stage under ${label}`, async () => {
			await environment.showWorld(sky);
			const scene = environment.stageScene();
			if (scene === null) throw new Error('the Stage reference is not mounted');
			const camera = createInspectionCamera('sphere');
			const anchor = new Vector3(...INSPECTION_ANCHOR);
			camera.position.add(anchor);
			camera.lookAt(anchor);
			camera.updateMatrixWorld();
			const { fog, background } = scene;
			// Fog is a view-distance effect the sample deliberately omits.
			scene.fog = null;
			scene.background = new Color(INSPECTION_THUMBNAIL_BACKGROUND);
			let pending: Promise<InspectionFrame | null>;
			try {
				// The draw is submitted before the first await, so the Scene is restored at once.
				pending = renderInspectionFrame({ renderer, scene, camera, size: 256, exposure: 1 });
			} finally {
				scene.fog = fog;
				scene.background = background;
			}
			const stage = await pending;
			if (stage === null) throw new Error('the Stage reference did not read back');
			const inspected = await drawn(fixture.finish, { lighting: { world: sample(sky) } });
			const studio = await drawn(fixture.finish);
			const deltas = patchDifference(linear(stage), linear(inspected), SPHERE_PATCHES);
			const against = patchDifference(linear(stage), linear(studio), SPHERE_PATCHES);
			return {
				pass: Math.max(...deltas) <= DELTA_E_LIMIT && Math.max(...against) > DELTA_E_LIMIT,
				measured: { deltaE00: deltas, max: Math.max(...deltas), studioControlMax: Math.max(...against) }
			};
		});
	}
	await environment.showWorld(fixture.sky);

	await check('channel texel report', async () => {
		const accepted = await host.texel({ subject: fixture.finish, geometry: 'plane', uv: [0.5, 0.5] });
		const corrected = await host.texel({ subject: draft(drafts.corrected), geometry: 'plane', uv: [0.5, 0.5] });
		if (accepted.status !== 'ready' || corrected.status !== 'ready') {
			return { pass: false, measured: { accepted, corrected } };
		}
		const a = Object.fromEntries(accepted.channels.map((channel) => [channel.role, channel]));
		const c = Object.fromEntries(corrected.channels.map((channel) => [channel.role, channel]));
		const near = (value: number | undefined, expected: number, tolerance = 2 / 255): boolean =>
			value !== undefined && Math.abs(value - expected) <= tolerance;
		const [, storedY] = S8_CHART_FIXTURES.normalMinusY.centre;
		const pass =
			near(a.occlusion!.converted?.[0], 51 / 255) &&
			near(a.roughness!.converted?.[0], 191 / 255) &&
			near(a.metalness!.converted?.[0], 1) &&
			near(a.normal!.source?.[1], storedY / 255) &&
			near(a.normal!.converted?.[1], -(storedY / 255) * 2 + 1, 4 / 255) &&
			near(c.roughness!.source?.[0], 191 / 255) &&
			near(c.roughness!.converted?.[0], 1 - 191 / 255) &&
			c.metalness!.state === 'constant' &&
			near(c.metalness!.effective[0], 0.2);
		return { pass, measured: { accepted: accepted.channels, corrected: corrected.channels } };
	});

	await check('absent UV1 is partial and never a thumbnail', async () => {
		const next = await settle(host, request(draft(drafts.secondUv), { geometry: 'plane' }));
		const thumbnail = await host.thumbnail({ subject: draft(drafts.secondUv) });
		const colour = next.status === 'partial' ? next.channels.find((channel) => channel.role === 'color') : undefined;
		return {
			pass: next.status === 'partial' && colour?.state === 'missing-view' && thumbnail.status === 'refused',
			measured: {
				status: next.status,
				issues: next.status === 'partial' ? next.issues : null,
				colour,
				thumbnail: thumbnail.status
			}
		};
	});

	await check('missing anchor, stale and deleted subjects refuse', async () => {
		const unplaced = await settle(host, request(draft(drafts.corrected), { lighting: { world: sample(fixture.sky, null) } }));
		const stale = await settle(
			host,
			request({ ...fixture.finish, revision: 'stale' }, { lighting: { world: sample(fixture.sky) } })
		);
		const deleted = await settle(host, request({ ...fixture.finish, finishId: 'deleted' }));
		const codes = [unplaced, stale, deleted].map((next) => (next.status === 'refused' ? next.issues[0]?.code : next.status));
		return { pass: codes.join() === 'world-anchor-required,world-sample-stale,subject-missing', measured: codes };
	});

	await check('rapid subject and mode switch publishes only the last', async () => {
		const subjects: InspectionSubject[] = [
			fixture.finish,
			draft(drafts.corrected),
			{ kind: 'catalogue', id: catalogue[0]!.id }
		];
		const lightings = ['studio', 'grazing', { world: sample(fixture.sky) }] as const;
		const before = host.stats().draws;
		const published: number[] = [];
		const count = 40;
		const last = new Promise<InspectionState>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('switch did not settle')), STATE_TIMEOUT_MS);
			void (async () => {
				for (let index = 0; index < count; index += 1) {
					host.observe(
						request(subjects[index % 3]!, {
							geometry: GEOMETRIES[Math.floor(index / 3) % 3],
							lighting: lightings[Math.floor(index / 9) % 3],
							sizePx: [96 + index, 96]
						}),
						(next) => {
							if (next.status === 'pending') return;
							published.push(index);
							if (index === count - 1) {
								clearTimeout(timer);
								resolve(next);
							}
						}
					);
					if (index % 7 === 6) await new Promise((next) => setTimeout(next, 0));
				}
			})();
		});
		const final = await last;
		const draws = host.stats().draws - before;
		const width = final.status === 'ready' ? final.frame.width : null;
		return {
			pass: width === 96 + count - 1 && published.join() === String(count - 1) && draws < count,
			measured: { published, draws, requests: count, width }
		};
	});

	await check('a settled request makes zero draws', async () => {
		const same = request(fixture.finish);
		await settle(host, same);
		const before = host.stats().draws;
		await settle(host, { ...same });
		await new Promise((resolve) => setTimeout(resolve, 250));
		return { pass: host.stats().draws === before, measured: { draws: host.stats().draws - before } };
	});

	await check('thumbnails: any size and geometry, stable keys, drafts uncached', async () => {
		const keys = new Set<string>();
		const measured: string[] = [];
		let pass = true;
		for (const geometry of GEOMETRIES) {
			for (const [width, height] of [[192, 192], [64, 64], [240, 120]] as const) {
				const first = await host.thumbnail({ subject: fixture.finish, geometry, width, height });
				const second = await host.thumbnail({ subject: fixture.finish, geometry, width, height });
				if (first.status !== 'ready' || second.status !== 'ready') {
					pass = false;
					measured.push(`${geometry} ${width}x${height}: not ready`);
					continue;
				}
				pass &&= second === first && first.frame.width === width && first.frame.height === height;
				keys.add(first.key);
				measured.push(`${geometry} ${width}x${height}: ${first.key}`);
			}
		}
		const cached = host.stats().cached;
		const provisional = await host.thumbnail({ subject: draft(drafts.corrected) });
		pass &&= keys.size === 9 && provisional.status === 'ready' && host.stats().cached === cached;
		return { pass, measured };
	});

	await check('thumbnail cancellation releases its waiter', async () => {
		const controller = new AbortController();
		const pending = host.thumbnail({ subject: fixture.finish, width: 333, height: 333 }, controller.signal);
		controller.abort();
		const result = await pending;
		return { pass: result.status === 'refused' && host.stats().queued === 0, measured: { status: result.status, ...host.stats() } };
	});

	await check('catalogue reference derivatives match this backend', async () => {
		const measured: Record<string, number | string> = {};
		let pass = true;
		for (const { id } of catalogue) {
			const uri = catalogueThumbnailUri(id);
			const live = await host.thumbnail({ subject: { kind: 'catalogue', id } });
			if (uri === undefined || live.status !== 'ready') {
				measured[id] = uri === undefined ? 'no current derivative' : 'draw refused';
				pass = false;
				continue;
			}
			const image = await decode(uri);
			if (image.width !== 192 || image.height !== 192) {
				measured[id] = `${image.width}x${image.height}`;
				pass = false;
				continue;
			}
			const max = Math.max(...patchDifference(linear(image), linear(live.frame), grid(8)));
			measured[id] = max;
			pass &&= max <= DELTA_E_LIMIT;
		}
		return { pass, measured };
	});

	await check('twenty reference-list openings fetch no full-resolution image', async () => {
		await environment.showReferences(true);
		await environment.showReferences(false);
		const fetched: string[] = [];
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (/\/(textures|project-assets)\//.test(entry.name)) fetched.push(entry.name);
			}
		});
		observer.observe({ type: 'resource' });
		const draws = host.stats().draws;
		const views = finishViewStats().created;
		let shown = 0;
		for (let index = 0; index < 20; index += 1) {
			await environment.showReferences(true);
			shown = [...document.querySelectorAll<HTMLImageElement>('img[data-reference-thumbnail]')].filter(
				(image) => image.complete && image.naturalWidth === 192
			).length;
			const project = await host.thumbnail({ subject: fixture.finish });
			if (project.status !== 'ready') throw new Error('project derivative was refused');
			await environment.showReferences(false);
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
		observer.disconnect();
		const measured = {
			shown,
			fetched,
			draws: host.stats().draws - draws,
			viewsCreated: finishViewStats().created - views
		};
		return {
			pass: shown === catalogue.length && fetched.length === 0 && measured.draws === 0 && measured.viewsCreated === 0,
			measured
		};
	});

	await check('teardown mid-readback publishes nothing', async () => {
		let reading!: () => void;
		const submitted = new Promise<void>((resolve) => (reading = resolve));
		const observed = new Proxy(renderer as object, {
			get(target, key) {
				const value = Reflect.get(target, key, target);
				if (typeof value !== 'function') return value;
				if (key !== 'readRenderTargetPixelsAsync') return value.bind(target);
				return (...args: unknown[]) => {
					const read = value.apply(target, args);
					reading();
					return read;
				};
			},
			set: (target, key, value) => Reflect.set(target, key, value, target)
		}) as InspectionRenderer;
		const doomed = newHost(observed);
		const published: string[] = [];
		doomed.observe(
			request(draft(drafts.corrected), { lighting: 'grazing', sizePx: [1024, 1024] }),
			(next) => published.push(next.status)
		);
		await submitted;
		doomed.dispose();
		await new Promise((resolve) => setTimeout(resolve, 500));
		const stats = doomed.stats();
		return {
			pass: published.join() === 'pending' && stats.leases === 0 && stats.draftScopes === 0,
			measured: { published, stats }
		};
	});

	host.dispose();
	await check('leases return to baseline after teardown', async () => {
		await new Promise((resolve) => setTimeout(resolve, 500));
		const after = held();
		const stats = host.stats();
		return {
			pass: JSON.stringify(after) === JSON.stringify(heldBefore) && stats.leases === 0 && stats.draftScopes === 0,
			measured: { before: heldBefore, after, stats }
		};
	});

	await check('no project, history or Camera change', async () => {
		const after = fixture.projectState();
		const measured = {
			project: after.saved === projectBefore.saved,
			revision: after.revision === projectBefore.revision,
			history: after.undo === projectBefore.undo,
			authoredCamera: after.camera === projectBefore.camera,
			stageCamera: environment.stageCamera() === cameraBefore
		};
		return { pass: Object.values(measured).every(Boolean), measured };
	});

	// Last: it replaces the renderer every check above ran on.
	await check('device loss resumes on the next generation', async () => {
		const pageHost = environment.pageHost;
		const statuses: string[] = [];
		let resumed!: () => void;
		let lost = false;
		const done = new Promise<void>((resolve) => (resumed = resolve));
		let first!: () => void;
		const drewOnce = new Promise<void>((resolve) => (first = resolve));
		const release = pageHost.observe(request(draft(drafts.corrected)), (next) => {
			statuses.push(next.status);
			if (next.status !== 'ready') return;
			if (lost) resumed();
			else first();
		});
		await drewOnce;
		const three = renderer as unknown as {
			backend: { device?: { destroy(): void }; gl?: WebGL2RenderingContext };
			onDeviceLost(info: object): void;
		};
		lost = true;
		if (backend === 'webgpu') {
			// The device is really destroyed, but Three reports only a loss the page
			// did not cause (it drops reason `destroyed`), so deliver that report.
			three.backend.device!.destroy();
			three.onDeviceLost({ api: 'WebGPU', message: 'destroyed by the E7 gate', reason: null });
		} else {
			const extension = three.backend.gl!.getExtension('WEBGL_lose_context');
			if (extension === null) throw new Error('WEBGL_lose_context is unavailable');
			extension.loseContext();
			// A lost WebGL2 surface offers Retry instead of looping; take it.
			for (let attempt = 0; attempt < 100; attempt += 1) {
				await new Promise((resolve) => setTimeout(resolve, 50));
				const retry = document.querySelector<HTMLButtonElement>('[data-renderer-unavailable] button');
				if (retry === null) continue;
				retry.click();
				break;
			}
		}
		await Promise.race([
			done,
			new Promise((_, reject) => setTimeout(() => reject(new Error(`no recovery: ${statuses.join()}`)), STATE_TIMEOUT_MS))
		]);
		release();
		const next = environment.renderer();
		const measured = {
			statuses,
			from: viewGeneration.generation,
			to: next?.viewGeneration.generation,
			backend: next?.backend,
			leases: pageHost.stats().leases,
			draftScopes: pageHost.stats().draftScopes
		};
		return {
			pass:
				(measured.to ?? 0) > measured.from &&
				measured.backend === backend &&
				!statuses.includes('refused') &&
				measured.leases === 0 &&
				measured.draftScopes === 0,
			measured
		};
	});

	const failed = checks.filter((entry) => !entry.pass).map((entry) => entry.id);
	return { backend, pass: failed.length === 0, failed, checks };
}
