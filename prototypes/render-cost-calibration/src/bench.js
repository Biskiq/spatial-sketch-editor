import * as THREE from '../vendor/three.module.js';
import { allConfigs, compileStepConfig, shadowPasses } from './configs.js';
import { budgetFromFit, isMonotonic, linearFit, measuredBudget, median, percentile } from './fit.js';
import { buildScene, CANVAS_HEIGHT, CANVAS_WIDTH, DPR, disposeScene } from './scene.js';

const WARMUP_FRAMES = 30;
const MEASURED_FRAMES = 90;
// Timer queries on ANGLE/Metal are noisy at the 1–4 ms scale; 24 samples keep
// the median stable enough for a slope without changing the 5–8 minute budget.
const GPU_SAMPLES = 24;

export const BACKEND_LABELS = {
	webgl: 'A · WebGLRenderer',
	webgpu: 'B · WebGPURenderer (WebGPU)',
	'webgpu-force-webgl': 'C · WebGPURenderer (forceWebGL)'
};

function nextFrame() {
	return new Promise((resolve) => requestAnimationFrame(resolve));
}

function adapterInfo(adapter) {
	if (!adapter?.info) return null;
	const info = adapter.info;
	return {
		vendor: info.vendor ?? null,
		architecture: info.architecture ?? null,
		device: info.device ?? null,
		description: info.description ?? null
	};
}

export async function probeWebGPU() {
	if (!('gpu' in navigator)) {
		return { available: false, reason: 'navigator.gpu is absent in this browser' };
	}
	try {
		const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
		if (!adapter) {
			return { available: false, reason: 'navigator.gpu.requestAdapter() returned null' };
		}
		return { available: true, adapter: adapterInfo(adapter) };
	} catch (error) {
		return { available: false, reason: `requestAdapter() threw: ${error.message}` };
	}
}

function webglRendererInfo(renderer) {
	const gl = renderer.getContext();
	const debug = gl.getExtension('WEBGL_debug_renderer_info');
	return {
		vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
		renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
		version: gl.getParameter(gl.VERSION),
		timerQuery: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2'))
	};
}

export async function createBackend(kind, canvas) {
	canvas.width = CANVAS_WIDTH;
	canvas.height = CANVAS_HEIGHT;
	if (kind === 'webgl') {
		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: false,
			alpha: false,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(DPR);
		renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
		renderer.toneMapping = THREE.NoToneMapping;
		renderer.shadowMap.type = THREE.PCFShadowMap;
		return { renderer, detail: { adapter: webglRendererInfo(renderer), backend: 'WebGLRenderer' } };
	}

	const webgpu = await import('../vendor/three.webgpu.js');
	let probe = null;
	if (kind === 'webgpu') {
		probe = await probeWebGPU();
		if (!probe.available) throw new Error(probe.reason);
	}
	const renderer = new webgpu.WebGPURenderer({
		canvas,
		antialias: false,
		alpha: false,
		powerPreference: 'high-performance',
		trackTimestamp: true,
		forceWebGL: kind === 'webgpu-force-webgl'
	});
	await renderer.init();
	renderer.setPixelRatio(DPR);
	renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.shadowMap.type = THREE.PCFShadowMap;

	const backendName = renderer.backend?.isWebGPUBackend
		? 'WebGPUBackend'
		: renderer.backend?.isWebGLBackend
			? 'WebGLBackend'
			: renderer.backend?.constructor?.name ?? 'unknown';
	if (kind === 'webgpu' && backendName !== 'WebGPUBackend') {
		renderer.dispose();
		throw new Error(`WebGPU was requested but three selected ${backendName}`);
	}
	if (kind === 'webgpu-force-webgl' && backendName !== 'WebGLBackend') {
		renderer.dispose();
		throw new Error(`forceWebGL was requested but three selected ${backendName}`);
	}
	const context = renderer.getContext?.();
	const gl = context && typeof context.getExtension === 'function' ? context : null;
	return {
		renderer,
		detail: {
			backend: backendName,
			adapter: probe?.adapter ?? (renderer.backend?.adapter ? adapterInfo(renderer.backend.adapter) : null),
			webgl: gl ? webglRendererInfo({ getContext: () => gl }) : null
		}
	};
}

function programCount(renderer) {
	if (renderer.info.programs && Array.isArray(renderer.info.programs)) {
		return renderer.info.programs.length;
	}
	if (typeof renderer.info.memory?.programs === 'number') return renderer.info.memory.programs;
	return null;
}

function drawCount(renderer) {
	const render = renderer.info.render;
	if (typeof render.drawCalls === 'number' && render.drawCalls > 0) return render.drawCalls;
	return render.calls;
}

function gpuTimerFor(renderer) {
	if (renderer.info?.render?.timestamp !== undefined && typeof renderer.resolveTimestampsAsync === 'function') {
		return { kind: 'webgpu-timestamp', resolve: () => renderer.resolveTimestampsAsync('render') };
	}
	const gl = renderer.getContext?.();
	if (!gl) return null;
	const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
	if (!ext) return null;
	return { kind: 'webgl2-timer-query', gl, ext };
}

/**
 * Serial frame cost: render, then wait for the GPU to finish. This removes the
 * pipelining that makes a 2–4 ms timer reading drift by a factor of two, and it
 * includes submit backpressure at extreme configurations. It is deliberately
 * conservative: a real frame can overlap CPU and GPU work.
 */
async function sampleSynchronized(renderer, scene, camera) {
	const values = [];
	const gl = renderer.getContext?.();
	const device = renderer.backend?.device;
	for (let i = 0; i < 8; i += 1) {
		await nextFrame();
		const start = performance.now();
		renderer.render(scene, camera);
		if (gl && typeof gl.readPixels === 'function') {
			// gl.finish() is a no-op under ANGLE/Metal; a 1×1 readback stalls until
			// the submitted frame has actually executed.
			const pixel = new Uint8Array(4);
			gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
		} else if (device?.queue?.onSubmittedWorkDone) await device.queue.onSubmittedWorkDone();
		values.push(performance.now() - start);
	}
	return {
		syncMs: median(values),
		syncValues: values,
		method: typeof gl?.readPixels === 'function' ? 'readPixels(1×1)' : 'queue.onSubmittedWorkDone'
	};
}

async function sampleGpu(timer, renderer, scene, camera) {
	const values = [];
	const errors = [];
	if (!timer) return { available: false, reason: 'No GPU timer available', values, errors };
	if (timer.kind === 'webgpu-timestamp') {
		for (let i = 0; i < GPU_SAMPLES; i += 1) {
			await nextFrame();
			renderer.render(scene, camera);
			try {
				const value = await timer.resolve();
				if (Number.isFinite(value) && value > 0) values.push(value);
			} catch (error) {
				errors.push(error.message);
			}
		}
		return {
			available: values.length > 0,
			reason: values.length > 0 ? 'WebGPU timestamp-query' : errors[0] ?? 'timestamps unresolved',
			values,
			errors
		};
	}
	const { gl, ext } = timer;
	for (let i = 0; i < GPU_SAMPLES; i += 1) {
		await nextFrame();
		const query = gl.createQuery();
		gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
		renderer.render(scene, camera);
		gl.endQuery(ext.TIME_ELAPSED_EXT);
		let attempts = 0;
		while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && attempts < 120) {
			attempts += 1;
			await nextFrame();
		}
		const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
		const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
		if (available && !disjoint) values.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
		gl.deleteQuery(query);
	}
	return {
		available: values.length > 0,
		reason: values.length > 0 ? 'EXT_disjoint_timer_query_webgl2' : 'timer queries unresolved',
		values,
		errors
	};
}

async function measureOne(renderer, cfg, timer) {
	const built = buildScene(cfg);
	const { scene, camera } = built;
	const shadows = cfg.shadowCount > 0;
	renderer.shadowMap.enabled = shadows;
	renderer.shadowMap.autoUpdate = shadows;
	renderer.shadowMap.needsUpdate = shadows;

	const programsBefore = programCount(renderer);
	const firstStart = performance.now();
	renderer.render(scene, camera);
	const firstFrameMs = performance.now() - firstStart;
	const programsAfterFirst = programCount(renderer);

	if (shadows && cfg.shadowPolicy === 'static') {
		// One shadow render has happened; from here the map is only reused.
		renderer.shadowMap.autoUpdate = false;
		renderer.shadowMap.needsUpdate = false;
	}

	for (let i = 0; i < WARMUP_FRAMES; i += 1) {
		await nextFrame();
		renderer.render(scene, camera);
	}

	const intervals = [];
	const submit = [];
	let last = performance.now();
	for (let i = 0; i < MEASURED_FRAMES; i += 1) {
		await nextFrame();
		const now = performance.now();
		intervals.push(now - last);
		last = now;
		const start = performance.now();
		renderer.render(scene, camera);
		submit.push(performance.now() - start);
	}

	const gpu = await sampleGpu(timer, renderer, scene, camera);
	const sync = await sampleSynchronized(renderer, scene, camera);
	const render = renderer.info.render;
	const cpuSubmitMedianMs = median(submit);
	const gpuMs = gpu.available ? median(gpu.values) : null;
	const row = {
		id: cfg.id,
		group: cfg.group,
		label: cfg.label,
		n: cfg.n,
		mode: cfg.mode,
		material: cfg.material,
		view: cfg.view,
		tris: cfg.tris,
		actualTrianglesPerMesh: built.trianglesPerMesh,
		pointLights: cfg.point,
		spotLights: cfg.spot,
		shadowCount: cfg.shadowCount,
		shadowPasses: shadowPasses(cfg),
		shadowPolicy: cfg.shadowPolicy,
		shadowMapSize: cfg.shadowMapSize,
		medianMs: median(intervals),
		p95Ms: percentile(intervals, 95),
		cpuSubmitMedianMs,
		gpuMs,
		/** Serial frame-work estimate: CPU submission plus GPU execution. */
		workMs: cpuSubmitMedianMs + (gpuMs ?? 0),
		syncMs: sync.syncMs,
		syncMethod: sync.method,
		syncValues: sync.syncValues,
		gpuAvailable: gpu.available,
		gpuReason: gpu.reason,
		draws: drawCount(renderer),
		triangles: render.triangles,
		programs: programCount(renderer),
		firstFrameMs,
		programsBefore,
		programsAfterFirst,
		warmupFrames: WARMUP_FRAMES,
		measuredFrames: MEASURED_FRAMES,
		acts: built.meshes.length
	};

	disposeScene(built);
	return row;
}

async function measureCompileStep(renderer) {
	const cfg = compileStepConfig();
	const built = buildScene(cfg);
	const { scene, camera } = built;
	renderer.shadowMap.enabled = false;
	for (let i = 0; i < WARMUP_FRAMES; i += 1) {
		await nextFrame();
		renderer.render(scene, camera);
	}
	const steady = [];
	for (let i = 0; i < 15; i += 1) {
		await nextFrame();
		const start = performance.now();
		renderer.render(scene, camera);
		steady.push(performance.now() - start);
	}
	const programsBefore = programCount(renderer);
	built.addPointLight();
	const after = [];
	for (let i = 0; i < 3; i += 1) {
		await nextFrame();
		const start = performance.now();
		renderer.render(scene, camera);
		after.push(performance.now() - start);
	}
	const programsAfter = programCount(renderer);
	const row = {
		lightsBefore: 4,
		lightsAfter: 5,
		steadyMedianMs: median(steady),
		firstFrameAfterMs: after[0],
		secondFrameAfterMs: after[1],
		thirdFrameAfterMs: after[2],
		compileCostMs: after[0] - median(steady),
		programsBefore,
		programsAfter,
		programDelta:
			programsBefore !== null && programsAfter !== null ? programsAfter - programsBefore : null
	};
	disposeScene(built);
	return row;
}

function rowsOf(rows, group) {
	return rows.filter((row) => row.group === group);
}

/** Median of repeated measurements, so a single noisy GPU sample cannot move a slope. */
function mergeRepeats(runs) {
	if (runs.length === 1) return { ...runs[0], repeats: 1 };
	const merged = { ...runs[0], repeats: runs.length };
	for (const key of Object.keys(merged)) {
		if (typeof merged[key] !== 'number') continue;
		const values = runs.map((run) => run[key]).filter((value) => Number.isFinite(value));
		if (values.length > 0) merged[key] = median(values);
	}
	merged.repeatRuns = runs.map((run) => ({
		medianMs: run.medianMs,
		cpuSubmitMedianMs: run.cpuSubmitMedianMs,
		gpuMs: run.gpuMs,
		workMs: run.workMs,
		syncMs: run.syncMs
	}));
	return merged;
}

function summaryFor(rows, compile, detail) {
	// rAF intervals are vsync-clamped on a fast machine, so a cost slope cannot be
	// fitted on them. Draw calls are priced from CPU submission; shading costs from
	// the synchronized frame (`syncMs`), which waits for GPU completion.
	const draw = linearFit(rowsOf(rows, 'mesh-count').map((r) => ({ x: r.n, y: r.cpuSubmitMedianMs })));
	const triangle = linearFit(
		rowsOf(rows, 'triangles').map((r) => ({ x: r.n * r.actualTrianglesPerMesh, y: r.syncMs }))
	);
	// The 64-light point is reported raw: it falls off a cliff on this backend and
	// would otherwise drag a linear slope with it. The constant is the 0–32 fit.
	const lightLinearRange = (group) =>
		rowsOf(rows, group)
			.filter((r) => r.pointLights <= 32)
			.map((r) => ({ x: r.pointLights, y: r.syncMs }));
	const light1000 = linearFit(lightLinearRange('lights-point'));
	const light5000 = linearFit(lightLinearRange('lights-point-n5000'));
	if (light1000 && !isMonotonic(lightLinearRange('lights-point'))) light1000.usable = false;
	if (light5000 && !isMonotonic(lightLinearRange('lights-point-n5000'))) light5000.usable = false;
	if (triangle && !isMonotonic(rowsOf(rows, 'triangles').map((r) => ({ x: r.n, y: r.syncMs })))) {
		triangle.usable = false;
	}
	const lightFill = linearFit(
		rows
			.filter(
				(r) => r.group === 'lights-fill' && !r.id.startsWith('lights-fill-spot') && r.pointLights <= 32
			)
			.map((r) => ({ x: r.pointLights, y: r.syncMs }))
	);
	const spot1000 = linearFit(rowsOf(rows, 'lights-spot').filter((r) => r.n === 1000).map((r) => ({ x: r.spotLights, y: r.syncMs })));
	const spot5000 = linearFit(rowsOf(rows, 'lights-spot').filter((r) => r.n === 5000).map((r) => ({ x: r.spotLights, y: r.syncMs })));
	const shadow1000 = linearFit(rowsOf(rows, 'shadows').map((r) => ({ x: r.shadowPasses, y: r.syncMs })));
	const shadow5000 = linearFit(rowsOf(rows, 'shadows-n5000').map((r) => ({ x: r.shadowPasses, y: r.syncMs })));

	const find = (id) => rows.find((r) => r.id === id) ?? null;
	const cachedSavings = [];
	for (const count of [2, 4]) {
		const every = find(`shadows-1000-${count}`);
		const cached = find(`shadow-cache-1000-${count}`);
		const passes = shadowPasses({ shadowCount: count });
		if (every && cached) {
			cachedSavings.push({
				shadowCount: count,
				passes,
				savingMs: every.syncMs - cached.syncMs,
				perPassMs: (every.syncMs - cached.syncMs) / passes
			});
		}
	}
	const cachedSavings5000 = [];
	for (const count of [2, 4]) {
		const every = find(`shadows-5000-${count}`);
		const cached = find(`shadow-cache-5000-${count}`);
		const passes = shadowPasses({ shadowCount: count });
		if (every && cached) {
			cachedSavings5000.push({
				shadowCount: count,
				passes,
				savingMs: every.syncMs - cached.syncMs,
				perPassMs: (every.syncMs - cached.syncMs) / passes
			});
		}
	}

	const ratio = (a, b) => {
		const base = find(a);
		const other = find(b);
		return base && other ? base.syncMs / other.syncMs : null;
	};

	return {
		backend: detail.backend,
		adapter: detail.adapter,
		constants: {
			cDrawMs: draw?.b ?? null,
			cDrawR2: draw?.r2 ?? null,
			cTriangleMs: triangle?.b ?? null,
			cTriangleR2: triangle?.r2 ?? null,
			cPointLightMs1000: light1000?.b ?? null,
			cPointLightR2_1000: light1000?.r2 ?? null,
			cPointLightMs5000: light5000?.b ?? null,
			cPointLightR2_5000: light5000?.r2 ?? null,
			cPointLightMsFill: lightFill?.b ?? null,
			cPointLightR2_fill: lightFill?.r2 ?? null,
			cSpotLightMs1000: spot1000?.b ?? null,
			cSpotLightR2_1000: spot1000?.r2 ?? null,
			cSpotLightMs5000: spot5000?.b ?? null,
			cSpotLightR2_5000: spot5000?.r2 ?? null,
			cShadowPassMs1000: shadow1000?.b ?? null,
			cShadowPassR2_1000: shadow1000?.r2 ?? null,
			cShadowPassMs5000: shadow5000?.b ?? null,
			cShadowPassR2_5000: shadow5000?.r2 ?? null,
			cachedShadowSavingMsPerPass1000: cachedSavings.length
				? cachedSavings.reduce((s, c) => s + c.perPassMs, 0) / cachedSavings.length
				: null,
			cachedShadowSavingMsPerPass5000: cachedSavings5000.length
				? cachedSavings5000.reduce((s, c) => s + c.perPassMs, 0) / cachedSavings5000.length
				: null,
			instancingRatio1000: ratio('submission-separate-shared-1000', 'submission-instanced-1000'),
			instancingRatio5000: ratio('submission-separate-shared-5000', 'submission-instanced-5000'),
			batchingRatio1000: ratio('submission-separate-shared-1000', 'submission-batched-1000'),
			batchingRatio5000: ratio('submission-separate-shared-5000', 'submission-batched-5000'),
			cpuInstancingRatio1000:
				find('submission-separate-shared-1000') && find('submission-instanced-1000')
					? find('submission-separate-shared-1000').cpuSubmitMedianMs /
						find('submission-instanced-1000').cpuSubmitMedianMs
					: null,
			cpuInstancingRatio5000:
				find('submission-separate-shared-5000') && find('submission-instanced-5000')
					? find('submission-separate-shared-5000').cpuSubmitMedianMs /
						find('submission-instanced-5000').cpuSubmitMedianMs
					: null,
			lightVariantCompileMs: compile?.compileCostMs ?? null
		},
		fits: {
			meshCount: draw,
			triangles: triangle,
			pointLights1000: light1000,
			pointLights5000: light5000,
			pointLightsFill: lightFill,
			spotLights1000: spot1000,
			spotLights5000: spot5000,
			shadowPasses1000: shadow1000,
			shadowPasses5000: shadow5000
		},
		cachedSavings,
		cachedSavings5000,
		compile
	};
}

const PASSES_TO_LIGHTS = new Map([[0, 0], [1, 1], [2, 2], [9, 4], [23, 8]]);

function lightsForPasses(passes) {
	return passes === null || passes === undefined ? null : (PASSES_TO_LIGHTS.get(passes) ?? null);
}

function budgetsFor(rows, summary) {
	const out = {};
	const fitFor = {
		'1000': summary.fits.pointLights1000,
		'5000': summary.fits.pointLights5000
	};
	const shadowFitFor = {
		'1000': summary.fits.shadowPasses1000,
		'5000': summary.fits.shadowPasses5000
	};
	for (const n of ['1000', '5000']) {
		const lightFit = fitFor[n];
		const shadowFit = shadowFitFor[n];
		const lightPoints = rows
			.filter((r) => r.group === (n === '1000' ? 'lights-point' : 'lights-point-n5000'))
			.map((r) => ({ x: r.pointLights, y: r.syncMs }));
		const shadowPoints = rows
			.filter((r) => r.group === (n === '1000' ? 'shadows' : 'shadows-n5000'))
			.map((r) => ({ x: r.shadowPasses, y: r.syncMs }));
		const cachedPoints = rows
			.filter((r) => r.group === 'shadow-cache' && (n === '1000' ? !r.id.includes('-5000-') : r.id.includes('-5000-')))
			.map((r) => ({ x: r.shadowCount, y: r.syncMs }));
		const unshadowed = {};
		const shadowed = {};
		const cached = {};
		for (const budget of [16.7, 33.3]) {
			// The table reports the largest *tested* count that met the budget and the
			// next tested count that failed. A fit estimate is included beside it,
			// never instead of the evidence: at 64 lights the curve leaves its linear
			// range, so extrapolating past 32 would overclaim.
			const lightMeasured = measuredBudget(lightPoints, budget);
			unshadowed[budget] = {
				method: 'measured',
				value: lightMeasured.measured,
				nextTested: lightMeasured.nextTested,
				fitValue: lightFit?.usable ? budgetFromFit(lightFit, budget) : null
			};
			const shadowMeasured = measuredBudget(shadowPoints, budget);
			shadowed[budget] = {
				method: 'measured',
				lights: lightsForPasses(shadowMeasured.measured),
				passes: shadowMeasured.measured,
				nextTested: shadowMeasured.nextTested,
				fitValue: shadowFit?.usable ? budgetFromFit(shadowFit, budget) : null
			};

			// Cached shadows are reported from the cached rows themselves. The
			// measured saving is within run-to-run noise at 1,000 draws, so deriving
			// a budget by subtracting it from the every-frame fit would invent
			// precision the raw rows do not support.
			const cachedMeasured = measuredBudget(cachedPoints, budget);
			const cachedPasses = cachedMeasured.measured === null ? null : shadowPasses({ shadowCount: cachedMeasured.measured });
			cached[budget] = {
				method: 'measured',
				lights: cachedMeasured.measured,
				passes: cachedPasses,
				nextTested: cachedMeasured.nextTested,
				fitValue: null
			};
		}
		out[n] = { unshadowedPointLights: unshadowed, shadowed: shadowed, cachedShadowed: cached };
	}
	return out;
}

export async function runBackend(kind, canvas, onProgress = () => {}, onlyIds = null) {
	const created = await createBackend(kind, canvas);
	const { renderer, detail } = created;
	const timer = gpuTimerFor(renderer);
	const configs = allConfigs().filter((cfg) => onlyIds === null || onlyIds.includes(cfg.id));
	const rows = [];
	for (let index = 0; index < configs.length; index += 1) {
		const cfg = configs[index];
		onProgress({ index, total: configs.length, label: cfg.label });
		// Shadow cost is small on this machine and the GPU timer is noisy at that
		// scale; repeat those configs and use the median of their runs.
		const repeats = cfg.group === 'shadows' || cfg.group === 'shadow-cache' ? 3 : 1;
		const runs = [];
		for (let repeat = 0; repeat < repeats; repeat += 1) {
			runs.push(await measureOne(renderer, cfg, timer));
		}
		const row = mergeRepeats(runs);
		rows.push(row);
		onProgress({ index: index + 1, total: configs.length, label: cfg.label, row });
	}
	let compile = null;
	if (onlyIds === null) {
		onProgress({ index: configs.length, total: configs.length, label: 'compile step' });
		compile = await measureCompileStep(renderer);
	}
	const summary = summaryFor(rows, compile, detail);
	const budgets = budgetsFor(rows, summary);

	const battery = await batteryState();
	const result = {
		kind,
		label: BACKEND_LABELS[kind],
		available: true,
		detail,
		provenance: {
			userAgent: navigator.userAgent,
			platform: navigator.platform,
			hardwareConcurrency: navigator.hardwareConcurrency ?? null,
			deviceMemory: navigator.deviceMemory ?? null,
			language: navigator.language,
			dpr: DPR,
			canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
			threeRevision: THREE.REVISION,
			generatedAt: new Date().toISOString(),
			battery
		},
		timer: timer?.kind ?? null,
		gpuReason: rows.find((row) => row.gpuAvailable)?.gpuReason ?? rows[0]?.gpuReason ?? null,
		rows,
		summary,
		budgets
	};

	renderer.dispose();
	return result;
}

async function batteryState() {
	if (typeof navigator.getBattery !== 'function') {
		return { available: false, reason: 'navigator.getBattery() unavailable' };
	}
	try {
		const battery = await navigator.getBattery();
		return {
			available: true,
			charging: battery.charging,
			level: battery.level,
			chargingTime: battery.chargingTime,
			dischargingTime: battery.dischargingTime
		};
	} catch (error) {
		return { available: false, reason: error.message };
	}
}
