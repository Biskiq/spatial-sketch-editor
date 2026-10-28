/**
 * The harness's in-page ledger and frame clock (T3.P03.S02).
 *
 * Installed with `context.addInitScript` before any application module runs, so
 * the product's `perf-marks` helper sees `__BISKIQ_PERF__.enabled` at first
 * call. The script:
 *
 * - records one continuous requestAnimationFrame clock (the presentation
 *   opportunities the harness pairs marks with);
 * - buffers long tasks and Event Timing entries (page INP is reported
 *   separately from per-operation completion);
 * - optionally delays every application rAF callback, which simulates a late
 *   preview/presentation without changing the product: the correlation proof
 *   uses it to show latency instead of a dropped sample.
 *
 * The ledger records themselves are owned by the product helper
 * (`src/lib/platform/perf-marks.ts`); this script never fabricates one.
 */

export type LedgerRecord = {
	readonly kind: 'input' | 'install' | 'result' | 'mark';
	readonly name: string;
	readonly time: number;
	readonly sequence: number;
	readonly detail?: Readonly<Record<string, unknown>>;
};

export type LongTaskEntry = { readonly start: number; readonly duration: number };
export type EventEntry = { readonly name: string; readonly start: number; readonly duration: number };

export type RenderFrame = { readonly surface: string; readonly sourceContentId: string | null; readonly start: number; readonly end: number; readonly triangles: number };

export type PerfLedger = {
	readonly renderFrames: readonly RenderFrame[];
	readonly records: readonly LedgerRecord[];
	readonly ticks: readonly number[];
	readonly longTasks: readonly LongTaskEntry[];
	readonly events: readonly EventEntry[];
	readonly navigationStart: number;
	readonly paints: Readonly<Record<string, number>>;
	readonly lcp: number | null;
};

export type HarnessOptions = {
	/** Delay each application rAF callback by this many ms (correlation proof). */
	readonly frameDelayMs?: number;
};

type HarnessWindow = Window & {
	__BISKIQ_PERF__?: { enabled?: boolean; frameDelayMs?: number };
	__BISKIQ_PERF_RECORDS__?: LedgerRecord[];
	__BISKIQ_PERF_TICKS__?: number[];
	__BISKIQ_PERF_RENDER_FRAMES__?: RenderFrame[];
	__BISKIQ_PERF_LONG_TASKS__?: LongTaskEntry[];
	__BISKIQ_PERF_EVENTS__?: EventEntry[];
	__BISKIQ_PERF_LCP__?: number;
};

/** The init script body. Serialized by Playwright; it must stay self-contained. */
export function perfInitScript(options: HarnessOptions): void {
	const target = window as HarnessWindow;
	const frameDelayMs = options.frameDelayMs ?? 0;
	target.__BISKIQ_PERF__ = { enabled: true, frameDelayMs };
	const records: LedgerRecord[] = [];
	const ticks: number[] = [];
	const renderFrames: RenderFrame[] = [];
	target.__BISKIQ_PERF_RENDER_FRAMES__ = renderFrames;
	const longTasks: LongTaskEntry[] = [];
	const events: EventEntry[] = [];
	target.__BISKIQ_PERF_RECORDS__ = records;
	target.__BISKIQ_PERF_TICKS__ = ticks;
	target.__BISKIQ_PERF_LONG_TASKS__ = longTasks;
	target.__BISKIQ_PERF_EVENTS__ = events;

	const nativeRaf = window.requestAnimationFrame.bind(window);
	// A delayed callback is a slow frame, not a different frame: the tick clock
	// below stays on the native callback so the harness still sees every
	// presentation opportunity the browser offered.
	if (frameDelayMs > 0) {
		window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
			nativeRaf((timestamp: number) => {
				setTimeout(() => callback(timestamp), frameDelayMs);
			})) as typeof window.requestAnimationFrame;
	}
	const tick = (timestamp: number) => {
		ticks.push(timestamp);
		nativeRaf(tick);
	};
	nativeRaf(tick);

	// T1.P02.S06 render counters. The product hands each surface's renderer to
	// this hook (`perfRenderer`); the harness wraps that instance's `render` and
	// its shadow map's `render`, so the counts are Three's own `info` per frame.
	// Three resets `info` before the shadow pass, so its calls include shadow
	// draws: `drawCalls` is the main pass only (total minus the calls issued
	// inside the shadow pass) and `shadowDrawCalls` the rest. A frame is "at
	// rest" when no pointer, wheel or key input arrived in the preceding second.
	// A harness readback sets `__BISKIQ_PERF_RENDER_PAUSED__` so its own render is
	// neither counted nor recorded as the surface's last scene and camera.
	//
	// The owner's D1 extensions read the same frames:
	// - `renderCpuMs`: main-thread time inside each `render()` call (CPU
	//   submission; WebGL work the driver defers is not in it), with per-frame
	//   samples for the window's distribution;
	// - GPU time from `EXT_disjoint_timer_query_webgl2` where the browser exposes
	//   it, one TIME_ELAPSED query per frame resolved frames later; where it is
	//   not exposed the surface records why, and no GPU time is claimed;
	// - a one-frame compatible-bin census on request: the drawn (program, material
	//   state, geometry) tuples of the main pass, reduced to counts at once so no
	//   scene object is retained.
	type RenderInfo = { render: { calls: number; triangles: number }; memory: { geometries: number; textures: number }; programs?: unknown[] | null };
	type DrawMaterial = Record<string, unknown> & { type?: string; defines?: Record<string, unknown> };
	type DrawGeometry = { uuid: string; index?: unknown; attributes?: Record<string, { itemSize?: number; normalized?: boolean; array?: { constructor: { name: string } } }> };
	type HookedRenderer = {
		render(scene: unknown, camera: unknown): void;
		renderBufferDirect(camera: unknown, scene: unknown, geometry: DrawGeometry, material: DrawMaterial, object: unknown, group: unknown): void;
		info: RenderInfo;
		shadowMap: { render(...args: unknown[]): void };
		properties: { get(material: object): { currentProgram?: { cacheKey?: string } } };
		getContext(): WebGL2RenderingContext;
	};
	type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
	type SurfaceState = {
		counters: Record<string, number>;
		cpuSamples: number[];
		gpu: { available: boolean; reason?: string };
		binCensusRequested?: boolean;
		binCensus?: Record<string, number>;
	};
	/** Per-frame CPU samples kept per window; a window longer than this keeps its first frames. */
	const CPU_SAMPLE_LIMIT = 20_000;
	const renderSurfaces: Record<string, SurfaceState> = {};
	const renderRefs: Record<string, { renderer: HookedRenderer; scene: unknown; camera: unknown }> = {};
	(target as unknown as Record<string, unknown>).__BISKIQ_PERF_RENDER__ = renderSurfaces;
	(target as unknown as Record<string, unknown>).__BISKIQ_PERF_RENDER_REFS__ = renderRefs;
	let lastInputAt = -Infinity;
	for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown']) {
		window.addEventListener(type, () => (lastInputAt = performance.now()), { capture: true, passive: true });
	}
	const materialState = (material: DrawMaterial): string => {
		const parts: string[] = [String(material.type)];
		for (const key of Object.keys(material).sort()) {
			if (key === 'uuid' || key === 'id' || key === 'name' || key === 'userData' || key === 'version' || key.startsWith('_')) continue;
			const value = material[key] as { isColor?: boolean; isTexture?: boolean; isVector2?: boolean; uuid?: string; getHexString?: () => string; x?: number; y?: number } | null;
			if (value === null || ['number', 'string', 'boolean'].includes(typeof value)) parts.push(`${key}=${String(value)}`);
			else if (value?.isColor === true) parts.push(`${key}=#${value.getHexString?.()}`);
			else if (value?.isTexture === true) parts.push(`${key}=tex:${value.uuid}`);
			else if (value?.isVector2 === true) parts.push(`${key}=${value.x},${value.y}`);
		}
		if (material.defines !== undefined) parts.push(`defines=${JSON.stringify(material.defines)}`);
		return parts.join(';');
	};
	const geometryLayout = (geometry: DrawGeometry): string => {
		const attributes = Object.entries(geometry.attributes ?? {})
			.map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized === true ? 1 : 0}:${attribute.array?.constructor.name}`)
			.sort();
		return `${attributes.join(',')}|${geometry.index ? 'indexed' : 'array'}`;
	};
	(target as unknown as Record<string, unknown>).__BISKIQ_PERF_ON_RENDERER__ = (candidate: object, surface: string) => {
		const renderer = candidate as HookedRenderer;
		const state = (renderSurfaces[surface] ??= {
			counters: { frames: 0, framesAtRest: 0, drawCalls: 0, triangles: 0, shadowMapRenders: 0, shadowDrawCalls: 0, programs: 0, geometries: 0, textures: 0, maxDrawCallsPerFrame: 0, maxTrianglesPerFrame: 0, renderCpuMs: 0, maxRenderCpuMs: 0, gpuMs: 0, gpuFrames: 0, gpuDisjointFrames: 0 },
			cpuSamples: [],
			gpu: { available: false, reason: 'not probed' }
		});
		const counters = state.counters;
		let gl: WebGL2RenderingContext | null = null;
		let timer: TimerExtension | null = null;
		try {
			gl = renderer.getContext();
			timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
			state.gpu = timer === null ? { available: false, reason: 'EXT_disjoint_timer_query_webgl2 is not exposed by this browser and GPU' } : { available: true };
		} catch (error) {
			state.gpu = { available: false, reason: `the timer probe failed: ${String(error)}` };
		}
		// Unresolved queries kept at most; an older one is dropped unread (never
		// counted), so a stalled or invalid query cannot grow the queue for a pass.
		const PENDING_QUERY_LIMIT = 32;
		const pendingQueries: WebGLQuery[] = [];
		let queryOpen = false;
		const resolveQueries = () => {
			if (gl === null || timer === null) return;
			const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT) as boolean;
			while (pendingQueries.length > 0) {
				const available = gl.getQueryParameter(pendingQueries[0]!, gl.QUERY_RESULT_AVAILABLE) as boolean | null;
				if (available === false && pendingQueries.length <= PENDING_QUERY_LIMIT) break;
				const query = pendingQueries.shift()!;
				if (available === true) {
					if (disjoint) counters.gpuDisjointFrames! += 1;
					else {
						counters.gpuMs! += (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6;
						counters.gpuFrames! += 1;
					}
				}
				gl.deleteQuery(query);
			}
		};
		const shadowMap = renderer.shadowMap;
		const shadowRender = shadowMap.render.bind(shadowMap);
		let shadowCallsThisFrame = 0;
		let inShadowPass = false;
		shadowMap.render = (...args: unknown[]) => {
			const before = renderer.info.render.calls;
			inShadowPass = true;
			try {
				shadowRender(...args);
			} finally {
				inShadowPass = false;
			}
			shadowCallsThisFrame += renderer.info.render.calls - before;
		};
		// One census frame: wrap the per-draw entry for exactly that frame.
		const censusFrame = (draw: () => void) => {
			const tuples: { geometry: DrawGeometry; material: DrawMaterial }[] = [];
			const direct = renderer.renderBufferDirect;
			renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
				if (!inShadowPass) tuples.push({ geometry, material });
				return direct.call(renderer, camera, scene, geometry, material, object, group);
			};
			try {
				draw();
			} finally {
				renderer.renderBufferDirect = direct;
			}
			const programIds = new Map<string, number>();
			const materialIds = new Map<string, number>();
			const merge = new Set<string>();
			const instance = new Set<string>();
			const states = new Set<string>();
			for (const { geometry, material } of tuples) {
				const programKey = renderer.properties.get(material).currentProgram?.cacheKey ?? 'unknown';
				const program = programIds.get(programKey) ?? programIds.set(programKey, programIds.size).size - 1;
				const stateKey = materialState(material);
				const materialId = materialIds.get(stateKey) ?? materialIds.set(stateKey, materialIds.size).size - 1;
				states.add(`${program}/${materialId}`);
				merge.add(`${program}/${materialId}/${geometryLayout(geometry)}`);
				instance.add(`${program}/${materialId}/${geometry.uuid}`);
			}
			state.binCensus = {
				draws: tuples.length,
				triangles: renderer.info.render.triangles,
				programs: programIds.size,
				materialStates: states.size,
				mergeBins: merge.size,
				instanceBins: instance.size
			};
		};
		// The managed renderer reassigns `render` after its lookup discovery and at
		// dispose; an accessor keeps this wrapper outermost across reassignment.
		let inner = renderer.render;
		const counted = (scene: unknown, camera: unknown) => {
			const paused = (target as unknown as Record<string, unknown>).__BISKIQ_PERF_RENDER_PAUSED__ === true;
			shadowCallsThisFrame = 0;
			if (paused) {
				inner.call(renderer, scene, camera);
				return;
			}
			// One TIME_ELAPSED query at a time: a render nested in another is inside
			// the outer query, and a throwing render still ends its query.
			let query: WebGLQuery | null = null;
			if (gl !== null && timer !== null && !queryOpen) {
				query = gl.createQuery();
				if (query !== null) {
					gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
					queryOpen = true;
				}
			}
			const sourceContentId = records.findLast((entry) => entry.name === 'stage:source-ready')?.detail?.sourceContentId;
			const begin = performance.now();
			try {
				if (state.binCensusRequested === true) {
					state.binCensusRequested = false;
					censusFrame(() => inner.call(renderer, scene, camera));
				} else {
					inner.call(renderer, scene, camera);
				}
			} finally {
				if (query !== null && gl !== null && timer !== null) {
					gl.endQuery(timer.TIME_ELAPSED_EXT);
					queryOpen = false;
					pendingQueries.push(query);
				}
			}
			const end = performance.now();
			const cpuMs = end - begin;
			if (renderFrames.length < 20_000) renderFrames.push({ surface, sourceContentId: typeof sourceContentId === 'string' ? sourceContentId : null, start: begin, end, triangles: renderer.info.render.triangles });
			resolveQueries();
			renderRefs[surface] = { renderer, scene, camera };
			const info = renderer.info;
			const mainPassCalls = info.render.calls - shadowCallsThisFrame;
			counters.frames! += 1;
			if (performance.now() - lastInputAt > 1000) counters.framesAtRest! += 1;
			if (shadowCallsThisFrame > 0) {
				counters.shadowMapRenders! += 1;
				counters.shadowDrawCalls! += shadowCallsThisFrame;
			}
			counters.drawCalls! += mainPassCalls;
			counters.triangles! += info.render.triangles;
			counters.renderCpuMs! += cpuMs;
			counters.maxRenderCpuMs = Math.max(counters.maxRenderCpuMs!, cpuMs);
			if (state.cpuSamples.length < CPU_SAMPLE_LIMIT) state.cpuSamples.push(cpuMs);
			counters.maxDrawCallsPerFrame = Math.max(counters.maxDrawCallsPerFrame!, mainPassCalls);
			counters.maxTrianglesPerFrame = Math.max(counters.maxTrianglesPerFrame!, info.render.triangles);
			counters.programs = info.programs?.length ?? 0;
			counters.geometries = info.memory.geometries;
			counters.textures = info.memory.textures;
		};
		Object.defineProperty(renderer, 'render', {
			configurable: true,
			get: () => counted,
			set: (next: HookedRenderer['render']) => {
				inner = next;
			}
		});
	};

	try {
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				longTasks.push({ start: entry.startTime, duration: entry.duration });
			}
		}).observe({ type: 'longtask', buffered: true });
	} catch {
		// Long tasks are optional instrumentation; the flow still runs.
	}
	try {
		new PerformanceObserver((list) => {
			const entries = list.getEntries();
			const last = entries[entries.length - 1];
			if (last !== undefined) target.__BISKIQ_PERF_LCP__ = last.startTime;
		}).observe({ type: 'largest-contentful-paint', buffered: true });
	} catch {
		// LCP is a Chromium observation; the flow still runs without it.
	}
	try {
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				const timing = entry as PerformanceEntry & { interactionId?: number };
				events.push({
					name: entry.name,
					start: entry.startTime,
					duration: entry.duration,
					...(timing.interactionId === undefined ? {} : { interactionId: timing.interactionId })
				} as EventEntry);
			}
		}).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
	} catch {
		// Event Timing is not available in every engine; INP is then reported absent.
	}
}

/** Release harness-owned observations before F13's GC; never clear application state. */
export async function clearObservations(page: import('@playwright/test').Page): Promise<void> {
	await page.evaluate(() => {
		const target = window as HarnessWindow;
		for (const entries of [target.__BISKIQ_PERF_RECORDS__, target.__BISKIQ_PERF_TICKS__,
			target.__BISKIQ_PERF_LONG_TASKS__, target.__BISKIQ_PERF_EVENTS__, target.__BISKIQ_PERF_RENDER_FRAMES__]) {
			if (entries) entries.length = 0;
		}
		// The last rendered scene per surface: a closed project's scene graph must
		// not survive a forced GC because the harness still points at it.
		const refs = (target as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, unknown> }).__BISKIQ_PERF_RENDER_REFS__;
		if (refs) for (const surface of Object.keys(refs)) delete refs[surface];
		performance.clearMarks();
	});
}

/** Read the ledger after the measured work has settled. */
export async function readLedger(page: import('@playwright/test').Page): Promise<PerfLedger> {
	return page.evaluate(() => {
		const target = window as HarnessWindow;
		const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
		const paints: Record<string, number> = {};
		for (const paint of performance.getEntriesByType('paint')) paints[paint.name] = paint.startTime;
		return {
			renderFrames: (target.__BISKIQ_PERF_RENDER_FRAMES__ ?? []).slice(),
			records: (target.__BISKIQ_PERF_RECORDS__ ?? []).slice(),
			ticks: (target.__BISKIQ_PERF_TICKS__ ?? []).slice(),
			longTasks: (target.__BISKIQ_PERF_LONG_TASKS__ ?? []).slice(),
			events: (target.__BISKIQ_PERF_EVENTS__ ?? []).slice(),
			navigationStart: navigation?.startTime ?? 0,
			paints,
			lcp: typeof target.__BISKIQ_PERF_LCP__ === 'number' ? target.__BISKIQ_PERF_LCP__ : null
		};
	});
}

/**
 * The first presented frame at or after `time`.
 *
 * A rAF timestamp is the frame's rendering opportunity. The harness labels this
 * attribution as an approximation for the hard presentation gate: only a trace
 * containing the presented image proves the pixels, and that is what the
 * owner-run reference rows use.
 */
export function firstFrameAtOrAfter(ticks: readonly number[], time: number): number | null {
	for (const tick of ticks) if (tick >= time) return tick;
	return null;
}

/** Frame intervals between two frame timestamps (rAF-to-rAF deltas). */
export function frameIntervals(ticks: readonly number[], from: number, to: number): number[] {
	const intervals: number[] = [];
	let previous: number | null = null;
	for (const tick of ticks) {
		if (tick < from || tick > to) continue;
		if (previous !== null) intervals.push(tick - previous);
		previous = tick;
	}
	return intervals;
}

export type CorrelatedSample = {
	readonly sequence: number;
	readonly inputTime: number;
	readonly installTime: number | null;
	readonly presentedTime: number | null;
	/** Input → matching preview presentation; `null` while unresolved. */
	readonly latency: number | null;
	readonly status: 'presented' | 'superseded' | 'unresolved' | 'refused';
};

/**
 * Correlate every recorded input with its install/presented frame.
 *
 * Every input keeps a row. An input whose sequence was replaced by a later
 * presentation before it painted is `superseded`, never dropped; an input with
 * no installation and no superseding work is `unresolved`. A refusal mark for
 * the same sequence is `refused`. This ledger is what makes a delayed preview
 * visible as latency rather than as a missing sample.
 *
 * Presentation is attributed through the product's `overlay:updated` mark, which
 * the route emits only when the marker set it paints actually changed, carrying
 * the newest input sequence. The first frame at or after that mark is the frame
 * that painted the preview. A next-frame-after-install attribution would
 * under-report a delayed callback as if it had painted early.
 */
export function correlateInputs(
	records: readonly LedgerRecord[],
	ticks: readonly number[],
	inputName = 'pointermove',
	installName = 'wall-preview'
): CorrelatedSample[] {
	const inputs = records.filter((record) => record.kind === 'input' && record.name === inputName);
	const installs = records.filter((record) => record.kind === 'install' && record.name === installName);
	const presents = records.filter(
		(record) => record.kind === 'mark' && record.name === 'overlay:updated' && record.detail?.preview === true
	);
	const refused = new Set(
		records
			.filter((record) => record.kind === 'mark' && record.name === `${installName}:refused`)
			.map((record) => record.sequence)
	);
	const installBySequence = new Map<number, LedgerRecord>();
	for (const install of installs) {
		const sequence = typeof install.detail?.sequence === 'number' ? install.detail.sequence : install.sequence;
		installBySequence.set(sequence, install);
	}
	const highestPresented = presents.length === 0 ? 0 : Math.max(...presents.map((present) => present.sequence));
	return inputs.map((input) => {
		const install = installBySequence.get(input.sequence) ?? null;
		// The first overlay update at or after this install. Later updates can carry
		// the same sequence (the preview keeps painting, then the commit changes the
		// overlay again); the first one is the sample's matching presentation.
		const present =
			install === null
				? null
				: (presents.find((candidate) => candidate.sequence === input.sequence && candidate.time >= install.time) ??
					null);
		if (install === null || present === null) {
			return {
				sequence: input.sequence,
				inputTime: input.time,
				installTime: install?.time ?? null,
				presentedTime: null,
				latency: null,
				status: refused.has(input.sequence)
					? 'refused'
					: input.sequence < highestPresented
						? 'superseded'
						: 'unresolved'
			};
		}
		const presented = firstFrameAtOrAfter(ticks, present.time);
		return {
			sequence: input.sequence,
			inputTime: input.time,
			installTime: install.time,
			presentedTime: presented,
			latency: presented === null ? null : presented - input.time,
			status: 'presented'
		};
	});
}

/** The age of the newest input at the moment a preview presented (ms). */
export function latestInputAge(samples: readonly CorrelatedSample[]): number[] {
	const ages: number[] = [];
	for (const sample of samples) {
		if (sample.presentedTime === null) continue;
		const newest = samples
			.filter((candidate) => candidate.inputTime <= sample.presentedTime!)
			.reduce((latest, candidate) => Math.max(latest, candidate.inputTime), 0);
		ages.push(sample.presentedTime - newest);
	}
	return ages;
}
