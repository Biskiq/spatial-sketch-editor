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

export type PerfLedger = {
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
	// Shadow draws are the calls issued inside the shadow pass. A frame is "at
	// rest" when no pointer, wheel or key input arrived in the preceding second.
	type RenderInfo = { render: { calls: number; triangles: number }; memory: { geometries: number; textures: number }; programs?: unknown[] | null };
	type HookedRenderer = {
		render(scene: unknown, camera: unknown): void;
		info: RenderInfo;
		shadowMap: { render(...args: unknown[]): void };
	};
	const renderSurfaces: Record<string, { counters: Record<string, number> }> = {};
	const renderRefs: Record<string, { renderer: HookedRenderer; scene: unknown; camera: unknown }> = {};
	(target as unknown as Record<string, unknown>).__BISKIQ_PERF_RENDER__ = renderSurfaces;
	(target as unknown as Record<string, unknown>).__BISKIQ_PERF_RENDER_REFS__ = renderRefs;
	let lastInputAt = -Infinity;
	for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown']) {
		window.addEventListener(type, () => (lastInputAt = performance.now()), { capture: true, passive: true });
	}
	(target as unknown as Record<string, unknown>).__BISKIQ_PERF_ON_RENDERER__ = (candidate: object, surface: string) => {
		const renderer = candidate as HookedRenderer;
		const state = (renderSurfaces[surface] ??= {
			counters: { frames: 0, framesAtRest: 0, drawCalls: 0, triangles: 0, shadowMapRenders: 0, shadowDrawCalls: 0, programs: 0, geometries: 0, textures: 0, maxDrawCallsPerFrame: 0, maxTrianglesPerFrame: 0 }
		});
		const counters = state.counters;
		const shadowMap = renderer.shadowMap;
		const shadowRender = shadowMap.render.bind(shadowMap);
		shadowMap.render = (...args: unknown[]) => {
			const before = renderer.info.render.calls;
			shadowRender(...args);
			const issued = renderer.info.render.calls - before;
			if (issued > 0) {
				counters.shadowMapRenders! += 1;
				counters.shadowDrawCalls! += issued;
			}
		};
		// The managed renderer reassigns `render` after its lookup discovery and at
		// dispose; an accessor keeps this wrapper outermost across reassignment.
		let inner = renderer.render;
		const counted = (scene: unknown, camera: unknown) => {
			inner.call(renderer, scene, camera);
			renderRefs[surface] = { renderer, scene, camera };
			const info = renderer.info;
			counters.frames! += 1;
			if (performance.now() - lastInputAt > 1000) counters.framesAtRest! += 1;
			counters.drawCalls! += info.render.calls;
			counters.triangles! += info.render.triangles;
			counters.maxDrawCallsPerFrame = Math.max(counters.maxDrawCallsPerFrame!, info.render.calls);
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
			target.__BISKIQ_PERF_LONG_TASKS__, target.__BISKIQ_PERF_EVENTS__]) {
			if (entries) entries.length = 0;
		}
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
