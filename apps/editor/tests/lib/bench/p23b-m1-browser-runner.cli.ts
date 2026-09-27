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
 */
import fs from 'node:fs';
import path from 'node:path';

import {
	correlatePresentedFrames,
	P23B_M1_PRESENTED_FRAME_DEFINITION,
	type P23BM1PresentedFrameRow
} from '$lib/bench/p23b-m1-frame-timing';
import type { P23BM1ClassRow, P23BM1Record } from '$lib/bench/p23b-m1-record';

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
		dryRunMs: Number(flag('dry-run-ms') ?? '4000')
	};
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type TraceEvent = {
	name: string;
	ts: number;
	pid: number;
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
			ready = (await evaluate<boolean>('typeof globalThis.__P23B_M1_RUN__ === "function"')) === true;
		} catch {
			// navigating
		}
		if (!ready) await sleep(500);
	}
	if (!ready) throw new Error('the harness page never published __P23B_M1_RUN__');

	const observed = await evaluate<string>(
		`JSON.stringify({ ua: navigator.userAgent, dpr: devicePixelRatio, width: innerWidth, height: innerHeight, childFrames: window.length, longAnimationFrame: PerformanceObserver.supportedEntryTypes.includes('long-animation-frame') })`
	);

	// ---- tracing: only the category that carries the presentation marker ----
	/** Every presentation marker seen while tracing, with the process that emitted it. */
	const presentedAll: { ts: number; pid: number }[] = [];
	const nameCounts = new Map<string, number>();
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
			record = await evaluate<P23BM1Record>('globalThis.__P23B_M1_RUN__()', true);
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
	}

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
			notMeasuredReason:
				presented.length === 0 || offsetMs === null
					? 'NOT MEASURED — no presentation-grade signal was correlated on this runtime; the release row stays the labelled browser-frame PROXY.'
					: null,
			nameCounts: Object.fromEntries([...nameCounts].sort((a, b) => b[1] - a[1]))
		},
		limitations: [
			...record.limitations,
			'The release-side presented-frame row is a compositor presentation marker read over CDP tracing; it is not paint time, GPU time or a promise of what a display shows. On a headless runtime the presented surface is offscreen, which the row states rather than hides.',
			'Tracing runs for the whole M1 protocol and its own overhead is not subtracted from anything; both legs carry it identically.'
		]
	} as unknown as P23BM1Record & { presented: unknown };

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

void main().then(
	() => process.exit(0),
	(error) => {
		console.error(error instanceof Error ? error.stack ?? error.message : String(error));
		process.exit(1);
	}
);
