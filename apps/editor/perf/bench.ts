/**
 * One owner-run bench pass (T1.P02.S06 A.3–A.8). Agents run only `--smoke`.
 *
 *   npm run perf:bench --workspace @portfolio/editor -- --label bench-1
 *   npm run perf:bench --workspace @portfolio/editor -- --smoke      # smoke, not evidence
 *   … -- --no-sweep-latency                                            # owner drops the sweep rows
 *   … -- --early-stop                                                  # opt-in decisive hard-budget stop
 *   … -- --xl-drag-cache warm                                          # D5: grid-XL F3/F4/F8 warm only
 *
 * A pass is one invocation that produces every row it needs:
 *
 * 1. takes the machine-wide perf lock, records the 1-minute load average, the
 *    top processes, the thermal state and the power source, and marks the pass
 *    contaminated when it starts above the load threshold (default 4.0) or a
 *    Vitest lane is running;
 * 2. refuses unless every workload it loads is generated and fresh, and (except
 *    in smoke mode) unless the installed Chrome is the pinned build
 *    (`chrome-pin.json`, the owner's D8 ruling);
 * 3. builds the production bundle once, refuses a bundle that carries Svelte
 *    dev-mode instrumentation, and serves it for every phase. Children never
 *    inherit `vite-node`'s `NODE_ENV=development`, which would make Vite compile
 *    Svelte in dev mode;
 * 4. runs the tiers peak first (realistic-L, L, XL, M, S: A.3, the same order in
 *    every pass), recording the thermal state at each tier boundary and a
 *    recorded cool-down before M and S; each tier runs F2 (with A.6's old-method
 *    rows at S/M), F3/F4/F8, F7, F13 and the traced stage windows;
 * 5. then the E5 browser counts, the report-only sweep latency rows (F3/F8 and
 *    F7 at museum ×1 and sweep-H10; the owner may drop them) and the
 *    transferred rows (F1, F10, F5/F6 when a local API stack is configured; the
 *    Stage initial-load delta from the bundle report written after the build);
 * 6. records each phase's wall time and exit, the setup time, the pass's total
 *    and the load average at the end, releases the lock and writes the manifest.
 *
 * A phase that fails is recorded with its cause and the pass is marked aborted.
 * It is never retried here: the owner rules whether the pass counts (A.7). An
 * interrupt (Ctrl-C, SIGTERM) is recorded the same way, with the manifest
 * written and the lock released. The exit code says which: 0 clean, 1 aborted,
 * 5 contaminated (and not aborted).
 */
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REDUCED_PASS } from './lib/config';
import { MILESTONE_MIN_RUNS, MILESTONE_MAX_RUNS, MILESTONE_HEADROOM } from './lib/milestone';
import { basePlan, parseProfile, type PerfProfile } from './lib/profile';
import { commitSha, machineFacts, resultsDirectory } from './lib/report';
import { BENCH_TIERS, REGENERATE_COMMAND, workloadStatus, type WorkloadId } from './lib/workloads/registry';

const EDITOR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME_PIN_PATH = join(EDITOR, 'perf', 'chrome-pin.json');
const CHROME_BINARY = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOCK_DIR = '/tmp/biskiq-perf.lock';
const DEFAULT_LOAD_THRESHOLD = 4.0;

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

/** `--profile` wins over `PERF_PROFILE`; an invalid or valueless flag refuses the pass. */
function resolveProfile(): PerfProfile {
	const index = process.argv.indexOf('--profile');
	if (index >= 0) {
		const value = process.argv[index + 1];
		if (value === undefined || value.startsWith('--')) {
			console.error('--profile takes acceptance, diagnostic or milestone');
			process.exit(2);
		}
		try {
			return parseProfile(value);
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(2);
		}
	}
	try {
		return parseProfile(process.env.PERF_PROFILE);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(2);
	}
}

const SMOKE = process.argv.includes('--smoke');
const PROFILE = resolveProfile();
const DIAGNOSTIC = PROFILE === 'diagnostic';
const MILESTONE = PROFILE === 'milestone';
/** The lean methods share Bench 2's interaction and cache-state coverage. */
const LEAN = DIAGNOSTIC || MILESTONE;
const PLAN = basePlan(PROFILE);
const LABEL = argument('--label') ?? (SMOKE ? 'smoke' : 'bench');
if (DIAGNOSTIC && !SMOKE && !/diagnostic/i.test(LABEL)) {
	console.error(`the diagnostic profile is not acceptance evidence: name the pass with a label containing "diagnostic" (got "${LABEL}").`);
	process.exit(2);
}
if (MILESTONE && !SMOKE && !/milestone/i.test(LABEL)) {
	console.error(`the milestone profile is S06 milestone acceptance only: name the pass with a label containing "milestone" (got "${LABEL}").`);
	process.exit(2);
}
const PROJECT = argument('--project') ?? process.env.PERF_PROJECT ?? 'chrome';
const PORT = process.env.PERF_PORT ?? '4173';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TIERS = (argument('--tiers')?.split(',') as WorkloadId[] | undefined) ?? [...BENCH_TIERS];
if (LEAN && TIERS.some((tier) => tier === 'grid-XL' || tier === 'realistic-L')) {
	console.error('the lean profiles run the hard tiers only: grid-XL and realistic-L are formal/report-only rows.');
	process.exit(2);
}
const HARD_TIERS: readonly WorkloadId[] = ['grid-L', 'grid-M', 'grid-S'];
/** A formal pass must contain every hard tier; a `--tiers` continuation is not acceptance evidence. */
const FULL_HARD_TIERS = HARD_TIERS.every((tier) => TIERS.includes(tier));
const COOLDOWN_SECONDS = SMOKE ? 0 : Number(process.env.PERF_COOLDOWN_SECONDS ?? 180);
/** grid-XL's report-only F3/F4/F8 cache states (D5): every state unless the owner names some. */
const XL_DRAG_CACHE = argument('--xl-drag-cache');
if (XL_DRAG_CACHE !== undefined && !XL_DRAG_CACHE.split(',').every((state) => ['cold', 'warm', 'repeat-use'].includes(state))) {
	console.error(`--xl-drag-cache takes cold, warm and/or repeat-use, not ${XL_DRAG_CACHE}`);
	process.exit(2);
}
/** The report-only sweep latency rows run in every formal bench unless dropped; the lean methods never run them. */
const SWEEP_LATENCY = !LEAN && !process.argv.includes('--no-sweep-latency') && process.env.PERF_SWEEP_LATENCY !== '0';
/**
 * Opt-in decisive-failure early stop (perf/lib/early-stop.ts). Off by default:
 * activating it changes the sample count of the rows it stops, so an accepted
 * pass needs the owner's ruling. The manifest records whether it was active.
 *
 * The milestone method owns its own stopping rule (the adaptive decision on
 * independent runs), so this series-wide stop is never combined with it: a
 * failure in one row must not cut short another row's authorized extension.
 */
const EARLY_STOP = !MILESTONE && (process.argv.includes('--early-stop') || process.env.PERF_EARLY_STOP === '1');
const LOAD_THRESHOLD = Number(process.env.PERF_LOAD_THRESHOLD ?? DEFAULT_LOAD_THRESHOLD);
const LOAD_THRESHOLD_REASON = process.env.PERF_LOAD_THRESHOLD_REASON;
if (LOAD_THRESHOLD !== DEFAULT_LOAD_THRESHOLD && LOAD_THRESHOLD_REASON === undefined) {
	console.error('PERF_LOAD_THRESHOLD differs from 4.0: set PERF_LOAD_THRESHOLD_REASON to record why (A.8).');
	process.exit(2);
}

/**
 * The environment every child runs in. `vite-node` sets `NODE_ENV=development`
 * for this process; a `vite build` that inherits it compiles Svelte in dev
 * mode, so the bench would time a build no creator runs.
 */
const CHILD_ENV: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'NODE_ENV'));

const TIER_FLOWS = ['flows/project-open.spec.ts', 'flows/drag-correlation.spec.ts', 'flows/orbit.spec.ts', 'flows/cycles.spec.ts', 'flows/stage-trace.spec.ts'];
/** The lean methods trace only grid-L; M and S phases skip the trace spec. */
function tierFlows(tier: WorkloadId): string[] {
	return LEAN && tier !== 'grid-L' ? TIER_FLOWS.filter((spec) => !spec.includes('stage-trace')) : TIER_FLOWS;
}

type Snapshot = { at: string; loadAverage1m: number; topProcesses: string; thermal: string; power: string; vitestRunning: boolean };
type Phase = { name: string; kind: 'setup' | 'cooldown' | 'flows'; startedAt: string; wallSeconds: number; exitCode: number | null; cause?: string; thermalBefore?: string };

function run(command: string, args: string[]): string {
	try {
		return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return `unavailable (${command} ${args.join(' ')})`;
	}
}

function snapshot(): Snapshot {
	const processes = run('ps', ['-Ao', 'pid,pcpu,pmem,comm', '-r']);
	return {
		at: new Date().toISOString(),
		loadAverage1m: Number(loadavg()[0]!.toFixed(2)),
		topProcesses: processes.split('\n').slice(0, 12).join('\n'),
		thermal: run('pmset', ['-g', 'therm']),
		power: run('pmset', ['-g', 'batt']).split('\n')[0] ?? 'unknown',
		vitestRunning: /\bvitest\b/.test(run('ps', ['-Ao', 'command']))
	};
}

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

let lockHeld = false;

function takeLock(): void {
	try {
		mkdirSync(LOCK_DIR);
	} catch {
		const holderPath = join(LOCK_DIR, 'holder.json');
		const holder = existsSync(holderPath) ? (JSON.parse(readFileSync(holderPath, 'utf8')) as { pid: number; label: string; startedAt: string }) : null;
		if (holder !== null && !processAlive(holder.pid)) {
			console.error(`perf lock ${LOCK_DIR} is stale (pid ${holder.pid}, ${holder.label}, ${holder.startedAt} is gone). Remove it after checking: rm -r ${LOCK_DIR}`);
		} else {
			console.error(`perf lock ${LOCK_DIR} is held${holder === null ? '' : ` by pid ${holder.pid} (${holder.label}, since ${holder.startedAt})`}: only one pass runs at a time.`);
		}
		process.exit(3);
	}
	lockHeld = true;
	writeFileSync(join(LOCK_DIR, 'holder.json'), JSON.stringify({ pid: process.pid, label: LABEL, commit: commitSha(), startedAt: new Date().toISOString(), user: process.env.USER ?? 'unknown' }, null, 2));
}

function releaseLock(): void {
	if (lockHeld) rmSync(LOCK_DIR, { recursive: true, force: true });
	lockHeld = false;
}

function timed(name: string, kind: Phase['kind'], work: () => number | null, extra: Partial<Phase> = {}): Phase {
	const startedAt = new Date().toISOString();
	const started = performance.now();
	let exitCode: number | null = null;
	let cause: string | undefined;
	try {
		exitCode = work();
		if (exitCode !== 0) cause = `exit ${exitCode}`;
	} catch (error) {
		cause = error instanceof Error ? error.message : String(error);
	}
	const phase: Phase = { name, kind, startedAt, wallSeconds: Number(((performance.now() - started) / 1000).toFixed(1)), exitCode, ...(cause === undefined ? {} : { cause }), ...extra };
	console.log(`[bench] ${name}: ${phase.wallSeconds} s${cause === undefined ? '' : ` — ${cause}`}`);
	return phase;
}

/**
 * One Playwright invocation. Playwright empties its output directory at every
 * start, so each phase writes its failure artifacts to its own directory.
 */
function playwright(phase: string, specs: string[], env: Record<string, string>): number | null {
	const output = join(env.PERF_RESULTS_DIR ?? resultsDirectory(), 'artifacts', phase.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase());
	const result = spawnSync('npx', ['playwright', 'test', '--config', 'perf/playwright.config.ts', `--project=${PROJECT}`, `--output=${output}`, ...specs], {
		cwd: EDITOR,
		stdio: 'inherit',
		env: { ...CHILD_ENV, ...env }
	});
	return result.status;
}

/** The crash-handler watchdog (`lib/crash-handler-watchdog.mjs`), for the whole pass. */
function startCrashHandlerWatchdog(logPath: string): ChildProcess {
	const preexisting = run('pgrep', ['-f', 'chrome_crashpad_handler']).split('\n').filter((pid) => /^\d+$/.test(pid));
	// Its stderr goes to the log, so a failing watchdog is visible in the pass directory.
	const errors = openSync(logPath, 'a');
	return spawn('node', ['perf/lib/crash-handler-watchdog.mjs', logPath, ...preexisting], { cwd: EDITOR, stdio: ['ignore', 'ignore', errors] });
}

type ChromePin = { readonly version: string; readonly pinnedAt: string; readonly ruling: string };

/** The installed branded Chrome against the pinned build (D8): one build for all three passes. */
function chromeAgainstPin(): { installed: string; pinned: ChromePin | null; matches: boolean } {
	const installed = /([\d.]+)\s*$/.exec(run(CHROME_BINARY, ['--version']))?.[1] ?? 'unavailable';
	const pinned = existsSync(CHROME_PIN_PATH) ? (JSON.parse(readFileSync(CHROME_PIN_PATH, 'utf8')) as ChromePin) : null;
	return { installed, pinned, matches: pinned !== null && pinned.version === installed };
}

/**
 * The client chunks that carry Svelte dev-mode instrumentation: a dev build
 * stamps each component with its absolute source path (`x[FILENAME]="/…/X.svelte"`).
 */
function devModeChunks(): string[] {
	const root = join(EDITOR, '.svelte-kit', 'output', 'client', '_app', 'immutable');
	const marker = /\[[\w$]{1,3}\]="\/[^"]*\.svelte"/;
	const listed = run('find', [root, '-name', '*.js']);
	const chunks = listed.startsWith('unavailable') ? [] : listed.split('\n').filter((path) => path !== '');
	// No chunk to inspect is not a clean build: the guard must see the bundle it passes.
	if (chunks.length === 0) throw new Error(`the build has no client chunks under ${root}`);
	return chunks.filter((path) => marker.test(readFileSync(path, 'utf8')));
}

/**
 * The decision rows this profile's plan promises: F2 cold+warm at S/M, F3 warm
 * at S/M/L, F7 warm at S/M and F13 cold+repeat-use at S/M/L. The manifest uses
 * it to notice a row that never reported, so an omitted measurement cannot be
 * read as a pass.
 */
function expectedMilestoneDecisionRows(): number {
	const hard = TIERS.filter((tier) => tier === 'grid-L' || tier === 'grid-M' || tier === 'grid-S');
	const open = hard.filter((tier) => tier !== 'grid-L');
	const f2 = open.length * PLAN.cacheStates.f2.filter((state) => state === 'cold' || state === 'warm').length;
	const f3 = PLAN.cacheStates.f3.includes('warm') ? hard.length : 0;
	const f7 = PLAN.cacheStates.f7.includes('warm') ? open.length : 0;
	const f13 =
		hard.length * PLAN.cacheStates.f13.filter((state) => state === 'cold' || state === 'repeat-use').length;
	return f2 + f3 + f7 + f13;
}

/** Every verdict a row recorded: one `milestone:verdict`, or several `name=verdict` entries. */
function rowVerdicts(metrics: Record<string, unknown>): string[] {
	const many = metrics['milestone:verdicts'];
	if (typeof many === 'string') return many.split(',').map((entry) => entry.slice(entry.lastIndexOf('=') + 1));
	const one = metrics['milestone:verdict'];
	return typeof one === 'string' ? [one] : [];
}

/**
 * The pass-scoped milestone gate: every promised decision row reported, and
 * every verdict it recorded is `pass`. A row written before the pass aborted is
 * still read; the abort itself already removes acceptance evidence.
 */
function milestoneGate(directory: string): {
	expectedDecisionRows: number;
	observedDecisionRows: number;
	notPass: string[];
	missing: string[];
	complete: boolean;
} {
	const rows = (() => {
		try {
			return readdirSync(directory)
				.filter((name) => name.endsWith('.json') && name !== 'manifest.json')
				.flatMap((name) => {
					try {
						const parsed = JSON.parse(readFileSync(join(directory, name), 'utf8')) as {
							rows?: { id?: string; metrics?: Record<string, unknown> }[];
						};
						return parsed.rows ?? [];
					} catch {
						return [];
					}
				});
		} catch {
			return [];
		}
	})();
	const decisionRows = rows
		.map((row) => ({ id: row.id ?? 'unnamed', verdicts: rowVerdicts(row.metrics ?? {}) }))
		.filter((row) => row.verdicts.length > 0);
	const notPass = decisionRows
		.filter((row) => row.verdicts.some((verdict) => verdict !== 'pass'))
		.map((row) => `${row.id}: ${row.verdicts.join(',')}`);
	const expected = expectedMilestoneDecisionRows();
	return {
		expectedDecisionRows: expected,
		observedDecisionRows: decisionRows.length,
		notPass,
		missing:
			decisionRows.length >= expected
				? []
				: [`${expected - decisionRows.length} of ${expected} promised decision rows did not report`],
		complete: decisionRows.length >= expected && notPass.length === 0
	};
}

async function waitForServer(): Promise<void> {
	for (let attempt = 0; attempt < 120; attempt++) {
		try {
			const response = await fetch(`${BASE_URL}/projects`);
			if (response.ok) return;
		} catch {
			// not up yet
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
	}
	throw new Error(`the preview server did not answer at ${BASE_URL}`);
}

async function main(): Promise<void> {
	const needed: WorkloadId[] = [...TIERS, 'museum', 'sweep-H3', 'sweep-H10', 'sweep-D3', 'sweep-D10', 'sweep-C3', 'sweep-C10'];
	const unready = needed
		.map((id) => [id, workloadStatus(id)] as const)
		.filter(([, status]) => status.kind !== 'fresh' && status.kind !== 'blocked');
	if (unready.length > 0) {
		for (const [id, status] of unready) console.error(`${id}: ${'reason' in status ? status.reason : status.kind}`);
		console.error(`Generate the workloads first: ${REGENERATE_COMMAND}`);
		process.exit(4);
	}
	const digests = Object.fromEntries(
		needed.map((id) => {
			const status = workloadStatus(id);
			return [id, status.kind === 'fresh' ? status.meta.contentDigest : `${status.kind}: ${status.reason}`];
		})
	);

	const chrome = chromeAgainstPin();
	if (!chrome.matches && !SMOKE) {
		console.error(`installed Chrome ${chrome.installed} is not the pinned build ${chrome.pinned?.version ?? '(no perf/chrome-pin.json)'}: every pass runs one Chrome build (D8). The owner re-pins with a recorded reason.`);
		process.exit(6);
	}

	takeLock();
	const methodLabel = DIAGNOSTIC
		? 'diagnostic, NOT acceptance evidence'
		: MILESTONE
			? 'S06 milestone gate (adaptive decision method; not rare-tail certification)'
			: 'acceptance method';
	console.log(`[bench] profile: ${PROFILE} — ${methodLabel}`);
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const passDir = join(resultsDirectory(), `${stamp}-${LABEL}`);
	mkdirSync(passDir, { recursive: true });
	const start = snapshot();
	const contamination: string[] = [];
	if (start.loadAverage1m > LOAD_THRESHOLD) contamination.push(`1-minute load ${start.loadAverage1m} > ${LOAD_THRESHOLD} at start`);
	if (start.vitestRunning) contamination.push('a Vitest process was running at start');
	// Recorded, not contamination: the owner rules on each (A.7).
	const deviations: string[] = [];
	if (!SMOKE && !/Battery Power/.test(start.power)) deviations.push(`power source at start: ${start.power} (the owner direction is on battery, Low Power Mode off)`);
	const phases: Phase[] = [];
	const passStarted = performance.now();
	let server: ChildProcess | null = null;
	const flowEnv = {
		PERF_BASE_URL: BASE_URL,
		PERF_RESULTS_DIR: passDir,
		PERF_PROFILE: PROFILE,
		...(SMOKE ? { PERF_SMOKE: '1' } : {}),
		...(EARLY_STOP ? { PERF_EARLY_STOP: '1' } : {}),
		...(XL_DRAG_CACHE === undefined ? {} : { PERF_XL_DRAG_CACHE: XL_DRAG_CACHE })
	};
	const writeManifest = (end: Snapshot | null) => {
		const totalSeconds = (performance.now() - passStarted) / 1000;
		const setupSeconds = phases.filter((phase) => phase.kind === 'setup').reduce((sum, phase) => sum + phase.wallSeconds, 0);
		const cooldownSeconds = phases.filter((phase) => phase.kind === 'cooldown').reduce((sum, phase) => sum + phase.wallSeconds, 0);
		const aborted = phases.filter((phase) => phase.cause !== undefined);
		const gate = MILESTONE ? milestoneGate(passDir) : null;
		const evidence =
			PLAN.acceptanceEvidence &&
			!SMOKE &&
			!REDUCED_PASS &&
			FULL_HARD_TIERS &&
			contamination.length === 0 &&
			aborted.length === 0 &&
			(gate === null || gate.complete);
		const manifest = {
			label: SMOKE ? `${LABEL} — smoke, not evidence` : LABEL,
			smoke: SMOKE,
			profile: PROFILE,
			// Only a plan that certifies something, run at full coverage, clean and
			// unbroken, is acceptance evidence. A contaminated or aborted pass never
			// is, whatever its profile — and the diagnostic plan never is.
			acceptanceEvidence: evidence,
			samplePlan: PLAN,
			...(gate === null ? {} : { milestoneGate: gate }),
			...(DIAGNOSTIC
				? {
						diagnosticOmissions: [
							'F2 repeat-use cache state',
							'F7 cold and repeat-use cache states',
							'F13 reduced to 1/2/1 measured cycles at 10 edits',
							'stage traces at grid-L only',
							'A.6 old-method rows',
							'delayed-preview correlation proof',
							'F1/preview lifecycle use the diagnostic RUNS (3), not the formal 10'
						]
					}
				: {}),
			...(MILESTONE
				? {
						milestoneOmissions: [
							'F2 repeat-use cache state',
							'F7 cold and repeat-use cache states',
							'cold/repeat-use F3/F4/F8 are single-run checks, not statistical gates',
							'F2 L and F7 L are Target rows, not hard gates',
							'stage traces at grid-L only',
							'A.6 old-method rows',
							'delayed-preview correlation proof',
							'grid-XL, realistic-L and sweep latency rows (report-only, deferred)',
							'F1/preview lifecycle use the milestone RUNS (3)',
							'F3/F4/F8 frame-time and long-task clauses are not measured by the drag flow; F7 supplies frame intervals for the orbit only',
							'F13 live WebGL contexts and detached nodes are not captured; GPU object counts and post-GC heap are the evidence',
							'F13 warm is one cycle and is not a decision row; only cold and repeat-use carry ten-cycle growth',
							'the per-edit Layout evaluation is adjudicated at M only; S/L values are recorded, since the contract makes only M hard'
						]
					}
				: {}),
			commit: commitSha(),
			dirtyTree: run('git', ['status', '--porcelain']).length > 0,
			project: PROJECT,
			machine: machineFacts(),
			lock: { path: LOCK_DIR, holderPid: process.pid },
			loadThreshold: { value: LOAD_THRESHOLD, ...(LOAD_THRESHOLD_REASON === undefined ? {} : { reason: LOAD_THRESHOLD_REASON }) },
			contaminated: contamination.length > 0,
			contamination,
			deviations,
			chrome,
			xlDragCacheStates: XL_DRAG_CACHE ?? 'cold,warm,repeat-use',
			method: {
				profile: PROFILE,
				acceptanceEvidence: evidence,
				earlyStop: EARLY_STOP,
				...(MILESTONE
					? {
							decisionPolicy: {
								minRuns: MILESTONE_MIN_RUNS,
								maxRuns: { f2: MILESTONE_MAX_RUNS.f2, f3: MILESTONE_MAX_RUNS.f3, f7: MILESTONE_MAX_RUNS.f7 },
								passHeadroom: MILESTONE_HEADROOM,
								decisionRows: [
									'F3 input latency, latest-input age, F4 completion and F8 Undo/Redo warm at S/M/L',
									'per-edit Layout compile at M (≤ 8 ms)',
									'F2 cold+warm at S/M',
									'F7 warm p95, p99 and zero long tasks at S/M',
									'F13 cold and repeat-use ten-cycle growth at S/M/L'
								],
								nonGates: [
									'cold/repeat-use F3/F4/F8 single-run checks',
									'F2 L and F7 L Target rows',
									'F13 warm (one cycle)'
								],
								note: 'a row stops as soon as every decision row is decided; a borderline row extends one independent run at a time to its bound; at the bound the contract pooled p95 decides and any instability is recorded; contaminated or aborted passes are never evidence'
							}
						}
					: {}),
				note: DIAGNOSTIC
					? `${PLAN.note}. earlyStop stops only a hard row whose every measured run already exceeds the budget by the recorded margin; a stopped row is a demonstrated failure, never a pass`
					: MILESTONE
						? `${PLAN.note}. A row that is undecided after its minimum extends by one independent run; the run count and the rule are recorded on the row`
						: 'earlyStop stops only a hard row whose every measured run already exceeds the budget by the recorded margin; a stopped row is a demonstrated failure with a partial sample count, never a pass'
			},
			sweepLatency: SWEEP_LATENCY,
			aborted: aborted.length > 0,
			abortCauses: aborted.map((phase) => `${phase.name}: ${phase.cause}`),
			tiers: TIERS,
			fixtureDigests: digests,
			start,
			end,
			accounting: {
				totalSeconds: Number(totalSeconds.toFixed(1)),
				setupSeconds: Number(setupSeconds.toFixed(1)),
				cooldownSeconds: Number(cooldownSeconds.toFixed(1)),
				setupShare: totalSeconds > 0 ? Number((setupSeconds / totalSeconds).toFixed(3)) : null,
				note: 'pass-level setup is the build and server start; per-run setup (the JSON load) is reported in each flow row as setupMs/setupShare'
			},
			phases,
			crashHandlerWatchdog: existsSync(watchdogLog) ? readFileSync(watchdogLog, 'utf8').trim().split('\n') : []
		};
		writeFileSync(join(passDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
		return manifest;
	};
	const watchdogLog = join(passDir, 'crash-handler-watchdog.log');
	const watchdog = startCrashHandlerWatchdog(watchdogLog);
	const finish = (): ReturnType<typeof writeManifest> => {
		server?.kill('SIGTERM');
		watchdog.kill('SIGTERM');
		const end = snapshot();
		const manifest = writeManifest(end);
		releaseLock();
		console.log(`\n[bench] ${manifest.label}: ${manifest.accounting.totalSeconds} s total, setup ${manifest.accounting.setupSeconds} s, cool-down ${manifest.accounting.cooldownSeconds} s`);
		console.log(`[bench] load ${start.loadAverage1m} → ${end.loadAverage1m}; contaminated: ${manifest.contaminated ? manifest.contamination.join('; ') : 'no'}; aborted: ${manifest.aborted ? manifest.abortCauses.join('; ') : 'no'}`);
		console.log(`[bench] results: ${passDir}`);
		process.exitCode = manifest.aborted ? 1 : manifest.contaminated ? 5 : 0;
		return manifest;
	};
	// An interrupt still leaves a manifest and a free lock. Ctrl-C also reaches
	// the running Playwright process, which ends its phase; the handler only runs
	// once the synchronous phase returns, so the pass stops at the next boundary.
	let interrupted: NodeJS.Signals | null = null;
	for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => (interrupted = signal));
	const boundary = async (): Promise<void> => {
		await new Promise((resolvePromise) => setImmediate(resolvePromise));
		if (interrupted !== null) throw new Error(`interrupted by ${interrupted}`);
	};
	try {
		phases.push(timed('build', 'setup', () => spawnSync('npm', ['run', 'build'], { cwd: EDITOR, stdio: 'inherit', env: CHILD_ENV }).status));
		await boundary();
		if (phases[0]!.cause !== undefined) throw new Error(`build failed: ${phases[0]!.cause}`);
		const devChunks = devModeChunks();
		if (devChunks.length > 0) throw new Error(`the build carries Svelte dev-mode instrumentation in ${devChunks.length} chunks (first: ${devChunks[0]}): not a production build`);
		// The Stage initial-load delta (transferred row): the delivery report over this build.
		phases.push(timed('bundle report', 'setup', () => spawnSync('node', ['perf/bundle-report.mjs', '--json', join(passDir, 'bundle-report.json')], { cwd: EDITOR, stdio: 'inherit', env: CHILD_ENV }).status));
		const serverStarted = performance.now();
		server = spawn('node', ['perf/serve.mjs'], { cwd: EDITOR, stdio: 'inherit', env: { ...CHILD_ENV, PERF_SKIP_BUILD: '1', PERF_PORT: PORT } });
		await waitForServer();
		phases.push({ name: 'serve', kind: 'setup', startedAt: new Date().toISOString(), wallSeconds: Number(((performance.now() - serverStarted) / 1000).toFixed(1)), exitCode: 0 });

		for (const tier of TIERS) {
			if ((tier === 'grid-M' || tier === 'grid-S') && COOLDOWN_SECONDS > 0) {
				const before = run('pmset', ['-g', 'therm']);
				phases.push(timed(`cooldown before ${tier}`, 'cooldown', () => {
					spawnSync('sleep', [String(COOLDOWN_SECONDS)]);
					return 0;
				}, { thermalBefore: before }));
				await boundary();
			}
			phases.push(timed(`tier ${tier}`, 'flows', () => playwright(`tier ${tier}`, tierFlows(tier), { ...flowEnv, PERF_TIERS: tier }), { thermalBefore: run('pmset', ['-g', 'therm']) }));
			await boundary();
		}
		phases.push(timed('E5 browser counts', 'flows', () => playwright('e5', ['flows/e5-sweep.spec.ts'], flowEnv), { thermalBefore: run('pmset', ['-g', 'therm']) }));
		await boundary();
		if (SWEEP_LATENCY) {
			// F3 (the fixed edits on the focus Wall) and F7 at sweep ×1 and ×10, variant H.
			phases.push(timed('sweep latency rows (report-only)', 'flows', () => playwright('sweep latency', ['flows/drag-correlation.spec.ts', 'flows/orbit.spec.ts'], { ...flowEnv, PERF_TIERS: 'museum,sweep-H10' }), { thermalBefore: run('pmset', ['-g', 'therm']) }));
			await boundary();
		}
		const transferred = ['flows/startup.spec.ts', 'flows/preview-lifecycle.spec.ts', ...(process.env.PERF_API_ORIGIN !== undefined && process.env.E2E_TEST_AUTH_SECRET !== undefined ? ['flows/import.spec.ts'] : [])];
		phases.push(timed(`transferred rows (${transferred.map((spec) => spec.replace(/^flows\/|\.spec\.ts$/g, '')).join(', ')})`, 'flows', () => playwright('transferred', transferred, flowEnv), { thermalBefore: run('pmset', ['-g', 'therm']) }));
	} catch (error) {
		phases.push({ name: 'pass', kind: 'flows', startedAt: new Date().toISOString(), wallSeconds: 0, exitCode: null, cause: error instanceof Error ? error.message : String(error) });
	} finally {
		finish();
	}
	if (interrupted !== null) process.exit(interrupted === 'SIGINT' ? 130 : 143);
}

main().catch((error: unknown) => {
	console.error(error);
	releaseLock();
	process.exit(1);
});
