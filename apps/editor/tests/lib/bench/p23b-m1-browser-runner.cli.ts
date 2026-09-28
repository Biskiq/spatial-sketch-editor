/**
 * Pre-P23B.8 follow-up M1 — the browser runner (DEV/test tooling; writes nothing
 * into the repo by itself).
 *
 * WHAT IT IS FOR. The plan's §4.3(b1) asks for a PRESENTATION-GRADE release-side
 * signal, "driven identically on both runtimes — Electron exposes CDP through its
 * remote debugging port, so one method covers both legs". This is that one
 * method: it attaches to a CDP endpoint, puts the harness page on the protocol's
 * viewport, runs `__P23B_M1_RUN__()` (the M1 protocol, which lives in
 * `routes/dev/perf/p23b/drive.ts`), and adds the release side the page cannot
 * measure about itself.
 *
 * WHY AN EXTERNAL PROCESS. A page cannot observe its own presentation: the only
 * page-side signals are rAF callback intervals (a proxy) and
 * long-animation-frame (incidence, over 50 ms only). A presented frame is
 * reported by the compositor, so it is read through CDP tracing.
 *
 * THE SIGNAL, STATED PRECISELY. `AnimationFrame::Presentation` instants from the
 * harness page's OWN renderer process — the marker the compositor emits when it
 * reports a frame as presented. It is NOT an rAF callback and not a paint
 * duration. In a headless runtime the frame is presented to an offscreen
 * surface, which the record's limitations state.
 *
 * THE CLOCK IS CALIBRATED, NOT ASSUMED. Trace timestamps are on the tracing
 * clock (`base::TimeTicks` µs), release spans are `performance.now()` ms. The
 * page emits `console.timeStamp(...)` and reads `performance.now()` in the same
 * synchronous block; the `TimeStamp` trace event that produces identifies both
 * the renderer's process id and the offset between the two clocks. The
 * calibration is taken twice — before and after the run — and its residual is
 * reported beside every latency row.
 *
 * USAGE
 *   vite-node --config vitest.config.ts tests/lib/bench/p23b-m1-browser-runner.cli.ts -- \
 *     --port 9223 --runtime "Google Chrome for Testing 152 (headless)" \
 *     --out <path>.json [--url http://127.0.0.1:5173/dev/perf/p23b] [--budget-ms 500]
 *     [--arms] [--label-arms] [--cpu-profile <raw>.json]
 *
 * `--arms` runs the BEFORE/AFTER arm mode on the same protocol: no pre-change
 * tree is needed, because the viewport can still run the path this change
 * removed behind a DEV-only switch (see `p23b-m1-room-drag-arm.ts`).
 *
 * `--label-arms` does the same for the Room-label placer's eligibility grid
 * (`p23b-m1-room-label-arm.ts`), with two differences that follow from what that
 * change is: the arm alternates in EVERY class (the placer runs on every Plan
 * render, so every class that redraws the Plan carries it), and the rows it moves
 * are the post-release WINDOW rows, which is what the `labelArms` block reports —
 * per arm and per class, with the same split re-priced from the CPU profile when
 * one was taken. The release row is deliberately not split: both arms are released
 * by the same click, so it is the unchanged control beside the split.
 */
import fs from 'node:fs';
import path from 'node:path';

import { summarizeM1Attribution } from '$lib/bench/p23b-m1-attribution';
import {
	summarizeCpuProfile,
	summarizeCpuProfileWindows,
	type P23BM1CpuProfile
} from '$lib/bench/p23b-m1-cpu-profile';
import {
	correlatePresentedFrames,
	p23bM1PricesTraceSpan,
	summarizePresentedWindowArms,
	summarizePresentedWindowPhases,
	P23B_M1_PRESENTED_FRAME_DEFINITION,
	P23B_M1_WINDOW_PHASE_DEFINITION,
	P23B_M1_WINDOW_PHASES,
	type P23BM1PresentedFrameRow,
	type P23BM1PresentedWindow,
	type P23BM1TraceSpan
} from '$lib/bench/p23b-m1-frame-timing';
import {
	summarizeLabelArmWindows,
	pairM1PostReleaseWithPresented,
	type P23BM1ClassRow,
	type P23BM1LabelArmWindowRow,
	type P23BM1Record
} from '$lib/bench/p23b-m1-record';
import { P23B_M1_ROOM_LABEL_ARMS, type P23BM1RoomLabelArm } from '$lib/editor/layout/p23b-m1-room-label-arm';

type Args = {
	port: number;
	runtime: string;
	out: string;
	url: string;
	budgetMs: number;
	timeoutMs: number;
	/**
	 * PREFLIGHT: attach, calibrate and prove the presentation signal without running
	 * the protocol. This is how a runtime is checked BEFORE a leg is started (§3.1:
	 * a leg that cannot run the protocol is a STOP, not a differently-run capture),
	 * and how the tracing cost is measured on a new runtime.
	 */
	dryRun: boolean;
	dryRunMs: number;
	/**
	 * BEFORE/AFTER mode: run the whole-Room class on BOTH code paths in this one
	 * session (the DEV arm switch) instead of on the shipped path alone. The
	 * record then carries the per-arm rows and the before/after table; the
	 * presentation-grade release row the runner adds stays what it always was,
	 * taken over the class's mixed population.
	 */
	arms: boolean;
	/**
	 * The ROOM-LABEL arm mode: EVERY class interleaves the shipped and the pre-change
	 * eligibility grid per attempt, and the record's windows, window phases and CPU
	 * slice are each reported per arm with a signed within-session delta. A separate
	 * switch from `--arms` on purpose — the two changes are orthogonal, and flipping
	 * both in one run would thin every cell to a quarter and confound them on the one
	 * class they share.
	 */
	labelArms: boolean;
	/**
	 * Where to write the RAW V8 CPU profile of the protocol. Passing this turns the
	 * profiler on; the record then carries the summarized self-time rows beside the
	 * window phases. The raw profile is written where it is asked to be written and
	 * nowhere else — it is a working artifact, not a record.
	 */
	cpuProfile: string | null;
	/** V8's sampling interval, µs. Finer costs memory linearly; 1000 is the default. */
	cpuProfileIntervalUs: number;
};

function parseArgs(argv: readonly string[]): Args {
	const flag = (name: string): string | null => {
		const index = argv.indexOf(`--${name}`);
		return index === -1 ? null : (argv[index + 1] ?? null);
	};
	const port = Number(flag('port') ?? '');
	const out = flag('out');
	if (!Number.isFinite(port) || port <= 0) throw new Error('--port is required');
	if (!out) throw new Error('--out is required');
	return {
		port,
		out,
		runtime: flag('runtime') ?? 'unlabelled runtime',
		url: flag('url') ?? 'http://127.0.0.1:5173/dev/perf/p23b',
		budgetMs: Number(flag('budget-ms') ?? '500'),
		timeoutMs: Number(flag('timeout-ms') ?? String(4 * 60 * 60 * 1000)),
		dryRun: argv.includes('--dry-run'),
		dryRunMs: Number(flag('dry-run-ms') ?? '4000'),
		arms: argv.includes('--arms'),
		labelArms: argv.includes('--label-arms'),
		cpuProfile: flag('cpu-profile'),
		cpuProfileIntervalUs: Number(flag('cpu-profile-interval-us') ?? '1000')
	};
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One distribution, stated as a distribution: never a mean, never a sum. */
function cadenceOf(timestampsMs: readonly number[]): {
	count: number;
	windowMs: number;
	gapsMs: { count: number; p50: number; p95: number; min: number; max: number } | null;
} {
	if (timestampsMs.length < 2) {
		return { count: timestampsMs.length, windowMs: 0, gapsMs: null };
	}
	const gaps: number[] = [];
	for (let index = 1; index < timestampsMs.length; index += 1) {
		gaps.push(timestampsMs[index]! - timestampsMs[index - 1]!);
	}
	const sorted = [...gaps].sort((a, b) => a - b);
	const at = (fraction: number): number =>
		Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]! * 1000) / 1000;
	return {
		count: timestampsMs.length,
		windowMs: Math.round((timestampsMs[timestampsMs.length - 1]! - timestampsMs[0]!) * 1000) / 1000,
		gapsMs: { count: gaps.length, p50: at(0.5), p95: at(0.95), min: at(0), max: at(0.999) }
	};
}

type TraceEvent = {
	name: string;
	ts: number;
	pid: number;
	/**
	 * Present only on COMPLETE events. Every row before the window-phase split needs
	 * the instants alone, so `dur` was never read here; the split cannot price
	 * anything without it.
	 */
	dur?: number;
	/**
	 * `b`/`e` for the ASYNC events (`AnimationFrame` and its children), which carry
	 * no `dur`: they are paired by `id` (and `id2`, where the emitter scope-qualifies
	 * them) below. Every row before the window-phase split reads instants only, so
	 * this pairing never existed here.
	 */
	id?: number | string;
	id2?: unknown;
	cat?: string;
	ph?: string;
	args?: Record<string, unknown>;
};

class Cdp {
	private id = 0;
	private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
	private readonly listeners = new Map<string, ((params: any, sessionId?: string) => void)[]>();

	constructor(private readonly socket: WebSocket) {
		socket.addEventListener('message', (event) => {
			const message = JSON.parse((event as MessageEvent).data as string) as {
				id?: number;
				method?: string;
				params?: unknown;
				sessionId?: string;
				result?: unknown;
				error?: unknown;
			};
			if (message.id !== undefined && this.pending.has(message.id)) {
				const { resolve, reject } = this.pending.get(message.id)!;
				this.pending.delete(message.id);
				if (message.error) reject(new Error(JSON.stringify(message.error)));
				else resolve(message.result);
				return;
			}
			if (message.method) {
				if (process.env.M1_CDP_DEBUG) console.log('[cdp]', message.method, message.sessionId ?? '');
				for (const listener of this.listeners.get(message.method) ?? []) {
					listener(message.params, message.sessionId);
				}
			}
		});
	}

	on(method: string, listener: (params: any, sessionId?: string) => void): void {
		this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
	}

	send<T = any>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
		const id = ++this.id;
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
			this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
		});
	}
}

async function endpoint(port: number): Promise<{ webSocketDebuggerUrl: string; version: Record<string, string> }> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (response.ok) {
				const version = (await response.json()) as Record<string, string>;
				return { webSocketDebuggerUrl: version.webSocketDebuggerUrl!, version };
			}
		} catch {
			// not up yet
		}
		await sleep(250);
	}
	throw new Error(`no CDP endpoint answered on 127.0.0.1:${port}`);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const { webSocketDebuggerUrl, version } = await endpoint(args.port);
	const socket = new WebSocket(webSocketDebuggerUrl);
	await new Promise<void>((resolve, reject) => {
		socket.addEventListener('open', () => resolve());
		socket.addEventListener('error', () => reject(new Error('CDP socket failed')));
	});
	const cdp = new Cdp(socket);

	// One target, one harness tab. A runtime that cannot create a target (Electron's
	// browser target does not implement `Target.createTarget`) falls back to the page
	// target it already hosts — the same one-tab protocol either way, and the fallback
	// is recorded in the output so a leg never silently differs from the other.
	let targetId: string;
	let targetOrigin: 'created' | 'existing' = 'created';
	try {
		({ targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' }));
	} catch {
		const targets = await cdp.send<{ targetInfos: { targetId: string; type: string; url: string }[] }>(
			'Target.getTargets'
		);
		const page =
			targets.targetInfos.find(
				(candidate) => candidate.type === 'page' && candidate.url.includes('/dev/perf/p23b')
			) ?? targets.targetInfos.find((candidate) => candidate.type === 'page');
		if (!page) throw new Error('no page target to attach to on this runtime');
		targetId = page.targetId;
		targetOrigin = 'existing';
	}
	const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
		targetId,
		flatten: true
	});
	const call = <T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> =>
		cdp.send<T>(method, params, sessionId);

	await call('Page.enable');
	await call('Runtime.enable');
	await call('Emulation.setDeviceMetricsOverride', {
		width: 1500,
		height: 1000,
		deviceScaleFactor: 1,
		mobile: false
	});
	/**
	 * BLANK FIRST, THEN THE HARNESS. A runtime that already hosts the harness page
	 * (Electron's leg does: the host loads this same URL at start-up) can be told to
	 * navigate to the exact URL it is already on, and the browser then keeps the
	 * document it has — so the protocol would run against a tree and a commit from
	 * whenever that document was first built, while the capture claims to be the one
	 * being run now. Going through `about:blank` forces a real document load on both
	 * runtimes, and `documentAgeMs` below reports how old the document actually is.
	 */
	await call('Page.navigate', { url: 'about:blank' });
	await call('Page.navigate', { url: args.url });

	const evaluate = async <T = unknown>(expression: string, awaitPromise = false): Promise<T> => {
		const result = await call<{
			result: { value?: T };
			exceptionDetails?: unknown;
		}>('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
		if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
		return result.result.value as T;
	};

	// Wait for the harness page to publish the M1 entry point.
	let ready = false;
	for (let attempt = 0; attempt < 120 && !ready; attempt += 1) {
		try {
			const entry = args.arms
				? '__P23B_M1_RUN_ARMS__'
				: args.labelArms
					? '__P23B_M1_RUN_LABEL_ARMS__'
					: '__P23B_M1_RUN__';
			ready = (await evaluate<boolean>(`typeof globalThis.${entry} === "function"`)) === true;
		} catch {
			// navigating
		}
		if (!ready) await sleep(500);
	}
	if (!ready) throw new Error('the harness page never published __P23B_M1_RUN__');

	const observed = await evaluate<string>(
		`JSON.stringify({ ua: navigator.userAgent, dpr: devicePixelRatio, width: innerWidth, height: innerHeight, childFrames: window.length, longAnimationFrame: PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'), documentAgeMs: Math.round(performance.now()), navigationType: performance.getEntriesByType('navigation')[0]?.type ?? null })`
	);
	// A document that has been open for a while is a document built from an older
	// tree: the leg is stopped rather than recorded as the current one.
	{
		const observedAge = (JSON.parse(observed) as { documentAgeMs?: number }).documentAgeMs ?? 0;
		if (observedAge > 120000) {
			throw new Error(`the harness document is ${Math.round(observedAge / 1000)} s old; the run was not started`);
		}
	}

	// ---- tracing: only the category that carries the presentation marker ----
	/** Every presentation marker seen while tracing, with the process that emitted it. */
	const presentedAll: { ts: number; pid: number }[] = [];
	const nameCounts = new Map<string, number>();
	/**
	 * THE ONE PLACE THIS RUNNER RETAINS DURATIONS. Every row before the window-phase
	 * split needs only INSTANTS, which is why a capture could say how long the
	 * post-release wait is and nothing about its contents. Only the spans the
	 * window split prices are kept (`p23bM1PricesTraceSpan`), so the retention stays
	 * bounded and a capture that does not ask the question pays nothing for it.
	 */
	const traceSpans: P23BM1TraceSpan[] = [];
	/** Async spans opened by a `b` phase, closed by their matching `e`. */
	const openSpans = new Map<
		string,
		{ name: string; startMs: number; functionName?: string | null; url?: string | null; lineNumber?: number | null; columnNumber?: number | null }
	>();
	type Marker = { pid: number; ts: number };
	// The trace markers arrive from an event callback and the page-clock readings
	// from an awaited evaluate; they are kept apart and only joined once tracing has
	// closed, because tracing may deliver its buffer only at the end of the session
	// (so an event's arrival order says nothing about when it happened).
	const markers: { before: Marker | null; after: Marker | null } = { before: null, after: null };
	let beforePageNow: number | null = null;
	let afterPageNow: number | null = null;
	cdp.on('Tracing.dataCollected', (params: { value?: TraceEvent[] }) => {
		for (const event of params.value ?? []) {
			nameCounts.set(event.name, (nameCounts.get(event.name) ?? 0) + 1);
			if (p23bM1PricesTraceSpan(event.name)) {
				const data = (
					event.args as
						| { data?: { functionName?: string; url?: string; lineNumber?: number; columnNumber?: number } }
						| undefined
				)?.data;
				// `FunctionCall` is the one priced family that can be NAMED; everything
				// else is priced by family. The position CDP reports is the callee's
				// DEFINITION site, which is what maps a row in a pre-bundled dependency
				// chunk back to a source line.
				const meta =
					event.name === 'FunctionCall'
						? {
								functionName: data?.functionName ?? null,
								url: data?.url ?? null,
								lineNumber: data?.lineNumber ?? null,
								columnNumber: data?.columnNumber ?? null
							}
						: {};
				if (typeof event.dur === 'number' && event.dur > 0) {
					// A COMPLETE event carries its own duration.
					traceSpans.push({ name: event.name, startMs: event.ts / 1000, durMs: event.dur / 1000, ...meta });
				} else if (event.ph === 'b' && event.id !== undefined) {
					// An ASYNC event: `AnimationFrame` and its children. Pairing them is what
					// makes frame occupancy measurable at all — the first version of this
					// instrument retained `dur` alone and reported every window as zero
					// frames while 9 k frame events sat unread in the same trace.
					openSpans.set(`${event.pid}:${event.id}:${String(event.id2 ?? '')}`, {
						name: event.name,
						startMs: event.ts / 1000,
						...meta
					});
				} else if (event.ph === 'e' && event.id !== undefined) {
					const key = `${event.pid}:${event.id}:${String(event.id2 ?? '')}`;
					const open = openSpans.get(key);
					if (open && open.name === event.name) {
						openSpans.delete(key);
						const durMs = event.ts / 1000 - open.startMs;
						if (durMs > 0) traceSpans.push({ ...open, durMs });
					}
				}
			}
			if (event.name === 'TimeStamp') {
				const message = (event.args as { data?: { message?: string } } | undefined)?.data?.message;
				if (message === 'p23b-m1-calibration-before') {
					markers.before = { pid: event.pid, ts: event.ts };
				}
				if (message === 'p23b-m1-calibration-after') {
					markers.after = { pid: event.pid, ts: event.ts };
				}
			}
			if (event.name === 'AnimationFrame::Presentation') {
				presentedAll.push({ ts: event.ts, pid: event.pid });
			}
		}
	});

	await call('Tracing.start', {
		categories: 'devtools.timeline',
		transferMode: 'ReportEvents',
		bufferUsageReportingInterval: 500
	});

	/**
	 * THE SECOND INSTRUMENT, for the same window. The trace prices the post-release
	 * window by phase and names the function that CONTAINS the work; a CPU profile
	 * attributes each sample to the top frame on the stack, which is the only way to
	 * separate a function's own time from the time it merely contains (V8 emits no
	 * span for a frame it inlined). Started BEFORE the calibration marker below, so
	 * that marker's trace instant is the profile clock's anchor — the summary
	 * reports the difference between them rather than assuming the clocks agree.
	 */
	let samplingIntervalUs: number | null = null;
	if (args.cpuProfile) {
		await call('Profiler.enable');
		await call('Profiler.setSamplingInterval', { interval: args.cpuProfileIntervalUs });
		await call('Profiler.start');
		samplingIntervalUs = args.cpuProfileIntervalUs;
	}

	/**
	 * Emit the calibration marker and read the page clock in the SAME synchronous
	 * block, so the two clocks are sampled at one instant. The trace event itself is
	 * matched after the session closes (tracing may flush only at the end), which is
	 * why this never waits.
	 */
	const calibrate = async (label: 'before' | 'after'): Promise<void> => {
		const pageNow = await evaluate<number>(
			`(() => { console.timeStamp('p23b-m1-calibration-${label}'); return performance.now(); })()`
		);
		if (label === 'before') beforePageNow = pageNow;
		else afterPageNow = pageNow;
	};

	await calibrate('before');
	const started = Date.now();
	const progress = setInterval(() => {
		void evaluate<string>('JSON.stringify(globalThis.__P23B_M1_STATUS__ ?? null)')
			.then((status) => {
				console.log(
					`[${Math.round((Date.now() - started) / 1000)}s] M1 status: ${status ?? 'no status yet'}`
				);
			})
			.catch(() => {});
	}, 30000);

	let record: P23BM1Record | null = null;
	let runFailure: string | null = null;
	let cpuProfileRaw: P23BM1CpuProfile | null = null;
	try {
		if (args.dryRun) {
			// Same clocks, same tracing, same protocol viewport — everything except the
			// fixtures: a plain rAF loop for a few seconds so the presented-frame signal
			// and the calibration can be checked on this runtime before a leg is spent.
			await evaluate(`new Promise((resolve) => {
				const until = performance.now() + ${args.dryRunMs};
				const loop = () => { if (performance.now() >= until) resolve('dry-run complete'); else requestAnimationFrame(loop); };
				requestAnimationFrame(loop);
			})`, true);
		} else {
			record = await evaluate<P23BM1Record>(
				args.arms
					? 'globalThis.__P23B_M1_RUN_ARMS__()'
					: args.labelArms
						? 'globalThis.__P23B_M1_RUN_LABEL_ARMS__()'
						: 'globalThis.__P23B_M1_RUN__()',
				true
			);
		}
	} catch (error) {
		runFailure = error instanceof Error ? error.message : String(error);
	} finally {
		clearInterval(progress);
		await calibrate('after');
		await new Promise<void>((resolve) => {
			cdp.on('Tracing.tracingComplete', () => resolve());
			void call('Tracing.end');
		});
		if (args.cpuProfile) {
			// Stopped AFTER tracing has closed, so the profile covers the protocol's
			// whole span and not a prefix of it.
			const stopped = await call<{ profile?: P23BM1CpuProfile }>('Profiler.stop');
			cpuProfileRaw = stopped.profile ?? null;
			await call('Profiler.disable').catch(() => {});
		}
	}

	/**
	 * WHY THE RUN PRODUCED NO RECORD. The page's M1 entry point catches its own
	 * failure and resolves to `null` (so a failed run cannot look like a completed
	 * one), which means the rejection carries no message: the reason lives in the
	 * page's status. Read it here, or a failed leg reports a bare `null`.
	 */
	type M1RunStatus = { running?: boolean; step?: string; failure?: string };
	let runStatus: M1RunStatus | null = null;
	if (!record && !args.dryRun) {
		runStatus = await evaluate<M1RunStatus | null>(
			'JSON.parse(JSON.stringify(globalThis.__P23B_M1_STATUS__ ?? null))'
		).catch(() => null);
		runFailure ??= runStatus?.failure ?? null;
		if (runStatus?.failure) console.error(`M1 page failure: ${runStatus.failure}`);
	}

	// A calibration pair whose trace marker never arrived is `null`: the
	// presentation row is then NOT MEASURED rather than correlated on a guess.
	type Calibration = Marker & { pageNow: number };
	const before: Calibration | null =
		markers.before && beforePageNow !== null ? { ...markers.before, pageNow: beforePageNow } : null;
	const after: Calibration | null =
		markers.after && afterPageNow !== null ? { ...markers.after, pageNow: afterPageNow } : null;
	const calibrationResidualMs =
		before && after
			? Math.abs((before.ts - before.pageNow * 1000) - (after.ts - after.pageNow * 1000)) / 1000
			: null;
	// page ms → trace ms
	const offsetMs = before === null ? null : (before.ts - before.pageNow * 1000) / 1000;
	const rendererPid = before?.pid ?? null;
	// Only the harness page's OWN renderer presents the frames this row may claim,
	// and only inside the calibrated window: the two markers bracket exactly the run.
	const windowStart = before?.ts ?? -Infinity;
	const windowEnd = after?.ts ?? Infinity;
	const presented = presentedAll
		.filter(
			(event) =>
				(rendererPid === null || event.pid === rendererPid) &&
				event.ts >= windowStart &&
				event.ts <= windowEnd
		)
		.map((event) => event.ts / 1000)
		.sort((a, b) => a - b);
	const presentedInPageClock = offsetMs === null ? [] : presented.map((traceMs) => traceMs - offsetMs);

	const outPath = path.resolve(process.cwd(), args.out);
	if (args.dryRun || !record) {
		const probe = {
			schema: {
				note: args.dryRun
					? 'M1 runner PREFLIGHT — the protocol was not run. It reports only whether this runtime answers CDP, honours the protocol viewport and exposes a presentation-grade signal.'
					: 'M1 runner failure — the page-side record was never produced.'
			},
			runtime: args.runtime,
			url: args.url,
			runFailure,
			runStatus,
			observed,
			calibration: { offsetMs, calibrationResidualMs, rendererPid },
			presentedFrames: presented.length,
			presentedFramesAllProcesses: presentedAll.length,
			/**
			 * THE D6 FALSIFIER, and the reason it lives in the preflight. The preflight's
			 * only work is a bare `requestAnimationFrame` loop — no fixtures, no drags, no
			 * compiles. The cadence of the presented frames it produces is therefore the
			 * MEASUREMENT SURFACE's own pacing floor: if a runtime presents an idle rAF loop
			 * every ~150–200 ms, then a release-to-next-presented interval of the same size
			 * says nothing about the work released, and every presented-wait row in the slice
			 * needs that caveat before it is used to justify anything. Reported as gaps
			 * between consecutive presented frames (p50/p95), in the same page clock the
			 * release rows are correlated on. `null` where fewer than two frames arrived.
			 */
			presentedCadence: {
				note: 'Gaps between consecutive presented frames of the preflight rAF loop (idle, no fixtures). This is the surface pacing floor, never a latency of any app work.',
				...cadenceOf(presented)
			},
			nameCounts: Object.fromEntries([...nameCounts].sort((a, b) => b[1] - a[1]))
		};
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, JSON.stringify(probe, null, 2));
		console.log(
			`M1 runner preflight (${args.runtime}): ${presented.length} presented frame(s) of ${presentedAll.length} across processes, offset ${offsetMs?.toFixed(3)} ms (residual ${calibrationResidualMs?.toFixed(3)} ms) → ${outPath}`
		);
		if (!args.dryRun) throw new Error(`the M1 run failed: ${runFailure} (diagnostics written to ${outPath})`);
		socket.close();
		return;
	}

	// ---- merge the presented-frame row into each class ----
	const presentedRows: Record<string, P23BM1PresentedFrameRow | null> = {};
	/** Every class's windows, collected so the span scan happens ONCE for the run. */
	const windows: P23BM1PresentedWindow[] = [];
	/**
	 * The same windows by class key. The arm split needs ONE class's windows and the
	 * span scan needs all of them, so the two are kept side by side rather than one
	 * being filtered out of the other at the end.
	 */
	const windowsByClass = new Map<string, P23BM1PresentedWindow[]>();
	const classes = record.fixtures.flatMap((fixture) => fixture.classes);
	for (const entry of classes) {
		if (offsetMs === null || presented.length === 0 || entry.releaseSpans.length === 0) {
			presentedRows[keyOf(entry)] = null;
			continue;
		}
		const row = correlatePresentedFrames({
			// The correlation runs in the TRACE clock on both sides, so the release's
			// page-clock end is shifted by the calibration offset exactly once.
			presented,
			releaseSpans: entry.releaseSpans.map((span) => ({
				actionIndex: span.actionIndex,
				path: span.path,
				outcome: span.outcome,
				start: span.start,
				end: span.end
			})),
			offsetMs,
			budgetMs: args.budgetMs
		});
		presentedRows[keyOf(entry)] = row;
		// THE RESTORE-VERSUS-COMMIT SPLIT (D6): the class's own page-side window after
		// each release, paired action-by-action with the presented instant measured for
		// that same release. Both sides are per action; the pairing counts its matches.
		entry.postReleaseVsPresented = pairM1PostReleaseWithPresented(entry.postRelease, row.samples);
		// THE SAME PAIRING, PRICED BY THE TRACE'S OWN DURATIONS: the window one
		// accepted release opened (its synchronous end → the presented instant it
		// correlated to), handed to the window-phase summarizer below.
		const releaseEndById = new Map(
			entry.releaseSpans.map((span) => [span.actionIndex, span.end + offsetMs])
		);
		for (const sample of row.samples) {
			const startMs = releaseEndById.get(sample.actionIndex);
			if (startMs === undefined) continue;
			const window: P23BM1PresentedWindow = {
				key: keyOf(entry),
				actionIndex: sample.actionIndex,
				startMs,
				endMs: sample.presentedMs
			};
			windows.push(window);
			const sameClass = windowsByClass.get(window.key) ?? [];
			sameClass.push(window);
			windowsByClass.set(window.key, sameClass);
		}
		entry.releaseRow = {
			...entry.releaseRow,
			signal: 'presented-frame',
			definition: P23B_M1_PRESENTED_FRAME_DEFINITION,
			distribution: row.distribution,
			coverage: {
				releases: row.coverage.releases,
				coveredReleases: row.coverage.measuredReleases,
				coveredShare: row.coverage.measuredShare
			}
		};
		// The partition is refreshed against the row the class now reports: leaving
		// the page-side PROXY in `attribution.presentation` while `releaseRow` says
		// `presented-frame` would put two different signals in one record, and the
		// presentation-grade one is the signal the attribution pass reads.
		entry.attribution = summarizeM1Attribution({
			marks: entry.marks,
			boundaries: entry.boundaries,
			releaseRow: entry.releaseRow,
			measuredActions: entry.population.measuredAccepted
		});
	}

	// ---- the post-release window, priced per phase ----
	const windowRows = summarizePresentedWindowPhases({ windows, spans: traceSpans });
	for (const entry of classes) entry.presentedWindow = windowRows[keyOf(entry)] ?? null;

	// ---- …and the same window, priced by V8's own samples ----
	const cpuProfile =
		cpuProfileRaw === null
			? null
			: summarizeCpuProfile({
					profile: cpuProfileRaw,
					windows,
					// The calibration marker is taken a round trip after the profiler starts,
					// and its trace instant is the only shared point between the two clocks.
					markerTraceMs: before === null ? null : before.ts / 1000,
					samplingIntervalUs
				});

	// ---- the label-arm split: the same windows and the same samples, per arm ----
	const labelArmRows = labelArmWindowsOf({
		classes,
		windowsByClass,
		spans: traceSpans,
		profile: cpuProfileRaw,
		samplingIntervalUs
	});

	const merged = {
		...record,
		provenance: {
			...record.provenance,
			runtimeLabel: args.runtime,
			runtimeVersion: version,
			targetOrigin,
			harnessTabs: 1,
			harnessUrl: args.url,
			observed: JSON.parse(observed)
		},
		presented: {
			signal: 'AnimationFrame::Presentation (compositor frame-presented marker, page renderer only)',
			definition: P23B_M1_PRESENTED_FRAME_DEFINITION,
			tracingCategories: 'devtools.timeline',
			rendererPid,
			calibration: {
				method:
					'console.timeStamp(...) emits a TimeStamp trace event; the page reads performance.now() in the same synchronous block, so  traceMs(pageMs) = pageMs + offsetMs. Taken before and after the run.',
				offsetMs,
				residualMs: calibrationResidualMs,
				before,
				after
			},
			budgetMs: args.budgetMs,
			presentedFrames: presented.length,
			presentedFramesAllProcesses: presentedAll.length,
			presentedInPageClock,
			rows: presentedRows,
			windowPhases: {
				definition: P23B_M1_WINDOW_PHASE_DEFINITION,
				phases: P23B_M1_WINDOW_PHASES.map((matcher) => matcher.phase),
				spansRetained: traceSpans.length,
				rows: windowRows,
				notMeasuredReason:
					windows.length === 0 || traceSpans.length === 0
						? 'NOT MEASURED — no release was paired with a presented instant, or the trace retained no priced span; the wait is then reported without a contents split rather than as a zero.'
						: null
			},
			notMeasuredReason:
				presented.length === 0 || offsetMs === null
					? 'NOT MEASURED — no presentation-grade signal was correlated on this runtime; the release row stays the labelled browser-frame PROXY.'
					: null,
			cpuProfile,
			/**
			 * THE LABEL ARM'S OWN EVIDENCE, per class. The page records which arm each
			 * resolved action ran under; only this process can price what that arm moved,
			 * because a presented frame and a trace duration are both read here.
			 */
			labelArms: summarizeLabelArmWindows({ rows: labelArmRows, presentedWindows: windows.length }),
			nameCounts: Object.fromEntries([...nameCounts].sort((a, b) => b[1] - a[1]))
		},
		limitations: [
			...record.limitations,
			'The release-side presented-frame row is a compositor presentation marker read over CDP tracing; it is not paint time, GPU time or a promise of what a display shows. On a headless runtime the presented surface is offscreen, which the row states rather than hides.',
			'The window-phase row prices the post-release window from trace DURATIONS on the page renderer. Its phases NEST (`AnimationFrame` contains `Render`, which contains `Paint`), so they are reported separately and never summed; the only partition stated is frame occupancy versus the window minus it. Compositor- and GPU-side phases are not in `devtools.timeline` on this surface, which is exactly why `outsideFramesMs` is a remainder and not an attribution to the compositor.',
			'Tracing runs for the whole M1 protocol and its own overhead is not subtracted from anything; both legs carry it identically.',
			...(cpuProfile === null
				? []
				: [
						'The CPU profile is SAMPLED, not instrumented: a row is the work V8 attributed to that frame while it was the top frame on the stack, so a function whose callees were inlined into it carries their time and a function that ran but was never sampled carries none. It is also taken with the profiler and tracing both on, so its own overhead is in every row it prices.'
					])
		]
	} as unknown as P23BM1Record & { presented: unknown };

	if (args.cpuProfile && cpuProfileRaw !== null) {
		const profilePath = path.resolve(process.cwd(), args.cpuProfile);
		fs.mkdirSync(path.dirname(profilePath), { recursive: true });
		fs.writeFileSync(profilePath, JSON.stringify(cpuProfileRaw));
		console.log(
			`M1 runner: CPU profile — ${cpuProfileRaw.samples.length} sample(s) over ${Math.round((cpuProfileRaw.endTime - cpuProfileRaw.startTime) / 1000)} ms at ${samplingIntervalUs} µs → ${profilePath}`
		);
	}

	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
	console.log(
		`M1 runner: ${classes.length} class row(s), ${presented.length} presented frame(s), calibration offset ${offsetMs?.toFixed(3)} ms (residual ${calibrationResidualMs?.toFixed(3)} ms) → ${outPath}`
	);
	socket.close();
}

function keyOf(row: P23BM1ClassRow): string {
	return `${row.fixtureId}/${row.actionClass}`;
}

/**
 * Split every class's post-release windows — and, when a profile was taken, V8's own
 * samples inside them — by the Room-label arm the released action ran under.
 *
 * THE ARM IS PER ATTEMPT, THE WINDOW IS PER MEASURED ACTION, and the two are joined
 * on the action index the driver recorded the arm against. A window whose action has
 * no arm recorded cannot be placed in either side and is counted as unassigned rather
 * than assumed into one: the classes that ran no arm at all are skipped here, and the
 * record then says so instead of reporting an empty split as a comparison.
 *
 * The CPU slice keys each bucket `arm::class` because `summarizeCpuProfileWindows`
 * groups by the window's own key and both arms would otherwise land in one bucket;
 * the key is parsed back so the rows the record carries stay keyed the way the trace
 * rows beside them are keyed — by the arm, inside the class row it belongs to.
 */
function labelArmWindowsOf(input: {
	classes: readonly P23BM1ClassRow[];
	windowsByClass: ReadonlyMap<string, readonly P23BM1PresentedWindow[]>;
	spans: readonly P23BM1TraceSpan[];
	profile: P23BM1CpuProfile | null;
	samplingIntervalUs: number | null;
}): P23BM1LabelArmWindowRow[] {
	const arms = P23B_M1_ROOM_LABEL_ARMS;
	const armKeyedWindows: P23BM1PresentedWindow[] = [];
	const rows: P23BM1LabelArmWindowRow[] = [];
	for (const entry of input.classes) {
		const key = keyOf(entry);
		const byAction = new Map<number, P23BM1RoomLabelArm>(
			(entry.labelArms?.byAction ?? []).map((assignment) => [assignment.actionIndex, assignment.arm])
		);
		// A class that ran no label arm has no assignment to split by: it is skipped,
		// never split into two empty halves that could read like a measured pair.
		if (byAction.size === 0) continue;
		const own = input.windowsByClass.get(key) ?? [];
		const split = summarizePresentedWindowArms({
			windows: own,
			spans: input.spans,
			byAction,
			arms,
			afterArm: 'pruned-grid',
			beforeArm: 'per-cell-grid'
		});
		for (const window of own) {
			const arm = byAction.get(window.actionIndex);
			if (arm === undefined) continue;
			armKeyedWindows.push({ ...window, key: `${arm}::${key}` });
		}
		rows.push({
			key,
			unassignedWindows: split.unassignedWindows,
			arms: split.rows,
			comparison: split.comparison,
			cpu: []
		});
	}
	if (input.profile !== null && armKeyedWindows.length > 0) {
		const byClass = new Map(rows.map((row) => [row.key, row]));
		for (const cpuRow of summarizeCpuProfileWindows({
			profile: input.profile,
			windows: armKeyedWindows
		})) {
			const parsed = parseArmBucketKey(cpuRow.key, arms);
			if (parsed === null) continue;
			const row = byClass.get(parsed.key);
			if (!row) continue;
			row.cpu.push({ ...cpuRow, key: parsed.arm });
		}
		for (const row of rows) {
			row.cpu.sort((left, right) => right.sampledInWindowMs - left.sampledInWindowMs);
		}
	}
	return rows;
}

/** The reverse of the `arm::class` bucket key, or `null` for a key it cannot own. */
function parseArmBucketKey(
	bucket: string,
	arms: readonly P23BM1RoomLabelArm[]
): { arm: P23BM1RoomLabelArm; key: string } | null {
	for (const arm of arms) {
		if (bucket.startsWith(`${arm}::`)) return { arm, key: bucket.slice(arm.length + 2) };
	}
	return null;
}

void main().then(
	() => process.exit(0),
	(error) => {
		console.error(error instanceof Error ? error.stack ?? error.message : String(error));
		process.exit(1);
	}
);
