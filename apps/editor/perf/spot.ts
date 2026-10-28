/**
 * M/L editor spot check.
 *
 *   npm run perf:spot
 *
 * The preview must already be running (default http://127.0.0.1:4173).
 * One fresh context per workload. Four samples, extended to eight only while
 * a preserved maximum sits in a threshold margin. Editor time, presentation
 * delay and automation time are separate fields. The run prints a short
 * summary and writes a JSON report. It does not take screenshots or traces.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type CDPSession, type Page } from '@playwright/test';

import { newMeasuredSession } from './lib/browser';
import {
	acceptedResultCount,
	commitPrecisionLength,
	fitStage,
	frameWindow,
	handlePoint,
	openSourceJson,
	selectWallById,
	setStageReading,
	uniqueProjectId,
	waitForAcceptedResult,
	waitForStageSettled
} from './lib/flow';
import { clickPick, installPanObserver, workSnapshot, type WorkSnapshot } from './lib/spot-browser';
import { collectSessions, collectGesture, openTiming, typedLengthTiming, sessionLabel, previewProvenance, type GestureObservation, type TimedOperation } from './lib/spot-measurement';
import { correlateInputs, readLedger, type LedgerRecord } from './lib/ledger';
import {
	FRAME_CAP,
	FRAME_FLOOR,
	WALL_CAP_MS,
	frameStop,
	interactionDecision,
	spotExitCode,
	undoRequired,
	type InteractionInput,
	type SpotLabel,
	type SpotTier
} from './lib/spot-decision';
import { loadWorkload, workloadJsonFor, workloadStatus, type WorkloadId } from './lib/workloads/registry';

const EDITOR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(EDITOR, '../..');
const BASE_URL = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:4173';
const TIERS: readonly { id: WorkloadId; tier: SpotTier }[] = [
	{ id: 'grid-M', tier: 'M' },
	{ id: 'grid-L', tier: 'L' }
];


type TierReport = {
	readonly tier: SpotTier;
	readonly workloadId: WorkloadId;
	readonly digest: string;
	readonly sessions: number;
	readonly label: SpotLabel;
	readonly onTheLine: boolean;
	readonly refreshPeriodMs: number;
	readonly refreshSource: string;
	readonly previewVersion: string | null;
	readonly open: TimedOperation & { admissionMs: number | null; automationMs: number | null; totalMs: number; editorThroughRenderMs: number | null };
	readonly drag: { observations: GestureObservation[]; editorMs: number[]; presentedMs: number[]; automationMs: number[]; supersededFraction: number | null };
	readonly pan: { observations: GestureObservation[]; editorMs: number[]; presentedMs: number[]; automationMs: number[] };
	readonly frames: number[];
	readonly commit: TimedOperation & { automationMs: number | null };
	readonly undo: { required: boolean; editorMs: number | null };
	readonly pick: { beforeMs: number | null; afterMs: number | null; resolved: boolean | null; indexBuilds: number | null };
	readonly sessionRequest?: { another: boolean; reason: string };
	readonly pickEvidence: { expectedId: string; before: unknown; after: unknown };
	readonly observations: Awaited<ReturnType<typeof readLedger>>;
	readonly work: WorkSnapshot | null;
	readonly unsplit: boolean;
	readonly elapsedMs: number;
};

function gitRevision(): string {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

function generateWorkload(id: WorkloadId): void {
	if (workloadStatus(id).kind === 'fresh') return;
	console.log(`${id}: cache ${workloadStatus(id).kind}, generating`);
	execFileSync('npx', ['vite-node', 'perf/generate-workloads.ts', '--one', id], {
		cwd: EDITOR,
		stdio: 'inherit',
		env: process.env
	});
}

async function previewIsUp(): Promise<boolean> {
	try {
		const response = await fetch(BASE_URL, { redirect: 'manual' });
		return response.status < 500;
	} catch {
		return false;
	}
}

async function pageNow(page: Page): Promise<number> {
	return page.evaluate(() => performance.now());
}

async function refreshPeriod(page: Page): Promise<{ ms: number; source: string }> {
	const screenRate = await page.evaluate(() => {
		const rate = (screen as Screen & { refreshRate?: number }).refreshRate;
		return typeof rate === 'number' && rate >= 30 && rate <= 240 ? rate : null;
	});
	if (screenRate !== null) return { ms: 1000 / screenRate, source: 'screen.refreshRate' };
	const intervals = await page.evaluate(() => new Promise<number[]>((resolveIntervals) => {
		const samples: number[] = [];
		let last = 0;
		let count = 0;
		const tick = (time: number) => {
			if (last > 0) samples.push(time - last);
			last = time;
			if (++count < 16) requestAnimationFrame(tick);
			else resolveIntervals(samples);
		};
		requestAnimationFrame(tick);
	}));
	const sorted = [...intervals].sort((a, b) => a - b);
	const median = sorted[Math.floor(sorted.length / 2)] ?? 16.7;
	return { ms: median, source: 'idle-raf' };
}

function gestureColumns(observations: GestureObservation[]) {
	const values = (key: 'editorMs' | 'presentedMs' | 'automationMs') => observations.flatMap((row) => typeof row[key] === 'number' && Number.isFinite(row[key]) ? [row[key] as number] : []);
	return { observations, editor: values('editorMs'), presented: values('presentedMs'), automation: values('automationMs') };
}

export async function dragSamples(page: Page, tier: SpotTier, refreshMs: number) {
	const startHandle = await handlePoint(page, 'Wall start');
	const end = await handlePoint(page, 'Wall end');
	const length = Math.hypot(end.x - startHandle.x, end.y - startHandle.y) || 1;
	const direction = { x: (end.x - startHandle.x) / length, y: (end.y - startHandle.y) / length };
	const ledgerBefore = (await readLedger(page)).records.length;
	await page.mouse.move(end.x, end.y);
	await page.mouse.down();
	let observations: GestureObservation[];
	try {
		observations = await collectGesture(tier, refreshMs, async (index) => {
			const before = (await readLedger(page)).records.length;
			const dispatched = await pageNow(page);
			await page.mouse.move(end.x + direction.x * 6 * (index + 1), end.y + direction.y * 6 * (index + 1));
			await page.waitForTimeout(32);
			const ledger = await readLedger(page);
			const inputs = correlateInputs(ledger.records.slice(before), ledger.ticks);
			const sample = inputs.length === 1 ? inputs[0] : undefined;
			return { dispatched, inputs, editorMs: sample?.installTime == null ? null : sample.installTime - sample.inputTime,
				presentedMs: sample?.latency ?? null, automationMs: sample === undefined ? null : sample.inputTime - dispatched };
		});
	} finally { await page.mouse.up(); }
	const ledger = await readLedger(page);
	const inputs = correlateInputs(ledger.records.slice(ledgerBefore), ledger.ticks);
	return { ...gestureColumns(observations), inputs: inputs.length, superseded: inputs.filter((row) => row.status === 'superseded').length };
}

export async function panSamples(page: Page, cdp: CDPSession, tier: SpotTier, refreshMs: number) {
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) return gestureColumns([]);
	await cdp.send('Performance.enable');
	await page.evaluate(installPanObserver);
	const originX = box.x + 12;
	const originY = box.y + box.height * 0.15;
	await page.mouse.move(originX, originY);
	await page.mouse.down();
	try {
		return gestureColumns(await collectGesture(tier, refreshMs, async (index) => {
			const beforeCount = await page.evaluate(() => (window as Window & { __spotPan?: unknown[] }).__spotPan?.length ?? 0);
			const before = await cdp.send('Performance.getMetrics');
			const dispatched = await pageNow(page);
			await page.mouse.move(originX + (index + 1) * 12, originY);
			await page.waitForFunction((count) => ((window as Window & { __spotPan?: unknown[] }).__spotPan?.length ?? 0) > count, beforeCount, { timeout: 1000 }).catch(() => undefined);
			const after = await cdp.send('Performance.getMetrics');
			const fresh = await page.evaluate((count) => (window as Window & { __spotPan?: { received: number; presented: number }[] }).__spotPan?.slice(count) ?? [], beforeCount);
			const sample = fresh.length === 1 ? fresh[0] : undefined;
			const taskMs = (metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000;
			return { dispatched, taskWindowMs: taskMs, events: fresh,
				editorMs: sample && Number.isFinite(taskMs) ? taskMs : null,
				presentedMs: sample ? sample.presented - sample.received : null,
				automationMs: sample ? sample.received - dispatched : null };
		}));
	} finally { await page.mouse.up(); }
}

function metric(payload: { metrics: { name: string; value: number }[] }, name: string): number {
	return payload.metrics.find((entry) => entry.name === name)?.value ?? Number.NaN;
}

async function waitForRelevantFrame(page: Page, timing: () => Promise<TimedOperation>): Promise<TimedOperation> {
	const deadline = Date.now() + 10_000;
	let measured = await timing();
	while (measured.presentedMs === null && Date.now() < deadline) {
		await page.waitForTimeout(16);
		measured = await timing();
	}
	return measured;
}

async function undoIfCommitted(page: Page, before: number): Promise<void> {
	const accepted = await acceptedResultCount(page);
	if (accepted <= before) return;
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await waitForAcceptedResult(page, accepted).catch(() => undefined);
}

async function runOnce(page: Page, cdp: CDPSession, tier: SpotTier, projectId: string, canonicalJson: string, wallId: string): Promise<Omit<TierReport, 'tier' | 'workloadId' | 'digest' | 'sessions' | 'label' | 'onTheLine' | 'elapsedMs'>> {
	const refresh = await refreshPeriod(page);
	const openWallStart = Date.now();
	const openDispatch = 0;
	await page.goto(`${BASE_URL}/project/${encodeURIComponent(projectId)}/spatial?create=1`);
	await page.getByRole('dialog', { name: 'Start a project' }).waitFor();
	await openSourceJson(page, { size: tier, projectId, envelope: JSON.parse(canonicalJson), canonicalJson, facts: { walls: 0, openings: 0, rooms: 0 } });
	const opened = await waitForRelevantFrame(page, async () => openTiming(await readLedger(page), openDispatch));
	const openWallMs = Date.now() - openWallStart;
	const previewVersion = await page.evaluate(() => {
		const records = (window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] }).__BISKIQ_PERF_RECORDS__ ?? [];
		const version = records.findLast((record) => record.name === 'build:identity')?.detail?.version;
		return typeof version === 'string' ? version : null;
	});
	if (process.env.SPOT_REQUIRE_VERIFIED === '1' && previewVersion !== gitRevision()) throw new Error(`Preview revision mismatch: ${previewVersion} vs ${gitRevision()}`);
	await setStageReading(page, 'Plan');
	await fitStage(page);
	await waitForStageSettled(page, 30_000);
	await selectWallById(page, wallId);
	const beforeDrag = await acceptedResultCount(page);
	const drag = await dragSamples(page, tier, refresh.ms);
	await waitForAcceptedResult(page, beforeDrag);
	await undoIfCommitted(page, beforeDrag);
	const pickBefore = await clickPick(page, wallId);
	await selectWallById(page, wallId);
	const lengthField = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
	await lengthField.waitFor({ state: 'visible' });
	const currentLength = Number(await lengthField.inputValue());
	const nextLength = Number((currentLength + 0.05).toFixed(3));
	const commitDispatch = await pageNow(page);
	const acceptedBefore = await acceptedResultCount(page);
	await commitPrecisionLength(page, Number.isFinite(nextLength) ? nextLength : currentLength + 0.05);
	await waitForAcceptedResult(page, acceptedBefore);
	const commit = await waitForRelevantFrame(page, async () => typedLengthTiming(await readLedger(page), commitDispatch, wallId));
	const commitEditor = commit.editorMs;
	const commitAutomation = commit.start === null ? null : commit.start - commitDispatch;
	const pickAfter = await clickPick(page, wallId);
	const pan = await panSamples(page, cdp, tier, refresh.ms);

	const frameFrom = await pageNow(page);
	await page.evaluate(() => new Promise<void>((resolveFrames) => {
		let left = 10;
		const step = () => {
			if (--left <= 0) resolveFrames();
			else requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}));
	let frames = (await frameWindow(page, frameFrom, await pageNow(page))).intervals;
	while (frameStop(frames, refresh.ms).action === 'extend' && frames.length < FRAME_CAP) {
		await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame())));
		frames = (await frameWindow(page, frameFrom, await pageNow(page))).intervals;
	}
	if (frames.length > FRAME_CAP) frames = frames.slice(0, FRAME_CAP);
	if (frames.length < FRAME_FLOOR) {
		/* The idle beat above is the whole frame sample. A shortfall stays incomplete. */
	}

	const undoIsRequired = undoRequired(tier, commitEditor);
	let undoEditor: number | null = null;
	if (undoIsRequired) {
		const undoBefore = await acceptedResultCount(page);
		const undoDispatch = await pageNow(page);
		await page.getByRole('button', { name: 'Undo', exact: true }).click();
		const undone = await waitForAcceptedResult(page, undoBefore);
		const marks = (await readLedger(page)).records.filter((record) => record.name === 'command:undo' && record.time >= undoDispatch);
		undoEditor = marks.length === 1 ? undone.time - marks[0]!.time : null;
	}

	const work = await workSnapshot(page);
	const supersededFraction = drag.inputs === 0 ? null : drag.superseded / drag.inputs;
	return {
		previewVersion,
		refreshPeriodMs: refresh.ms,
		refreshSource: refresh.source,
		open: { ...opened, admissionMs: opened.editorMs, editorThroughRenderMs: opened.renderedMs,
			editorMs: opened.renderedMs, totalMs: openWallMs,
			automationMs: opened.presentedMs === null ? null : Math.max(0, openWallMs - opened.presentedMs) },
		drag: { observations: drag.observations, editorMs: drag.editor, presentedMs: drag.presented, automationMs: drag.automation, supersededFraction },
		pan: { observations: pan.observations, editorMs: pan.editor, presentedMs: pan.presented, automationMs: pan.automation },
		frames,
		commit: { ...commit, automationMs: commitAutomation },
		undo: { required: undoIsRequired, editorMs: undoEditor },
		pick: {
			beforeMs: pickBefore.elapsedMs,
			afterMs: pickAfter.elapsedMs,
			resolved: pickBefore.resolved === null || pickAfter.resolved === null ? null : pickBefore.resolved === true && pickAfter.resolved === true,
			indexBuilds: pickAfter.indexBuilds
		},
		pickEvidence: { expectedId: wallId, before: pickBefore, after: pickAfter },
		observations: await readLedger(page),
		work,
		unsplit: opened.renderedMs === null || commit.presentedMs === null || drag.observations.some((row) => row.editorMs === null || row.presentedMs === null) || pan.observations.some((row) => row.editorMs === null || row.presentedMs === null)
	};
}

function decisionInput(tier: SpotTier, measured: Omit<TierReport, 'tier' | 'workloadId' | 'digest' | 'sessions' | 'label' | 'onTheLine' | 'elapsedMs'>): InteractionInput {
	return {
		tier,
		refreshMs: measured.refreshPeriodMs,
		moveEditor: measured.drag.editorMs,
		movePresented: measured.drag.presentedMs,
		panEditor: measured.pan.editorMs,
		panPresented: measured.pan.presentedMs,
		frameIntervals: measured.frames,
		commitEditorMs: measured.commit.editorMs,
		commitPresentedMs: measured.commit.presentedMs,
		supersededFraction: measured.drag.supersededFraction,
		pickMeasured: measured.pick.beforeMs !== null && measured.pick.afterMs !== null,
		pickResolved: measured.pick.resolved,
		undoRequired: measured.undo.required,
		undoEditorMs: measured.undo.editorMs,
		unsplit: measured.unsplit
	};
}

async function launchBrowser() {
	if (process.env.SPOT_BROWSER !== 'chromium') {
		try {
			return await chromium.launch({ channel: 'chrome' });
		} catch {
			console.log('Branded Chrome is not installed; using Playwright Chromium.');
		}
	}
	return chromium.launch();
}

async function main(): Promise<void> {
	if (!(await previewIsUp())) {
		console.error(`No preview at ${BASE_URL}. Start \`npm run preview -w @portfolio/editor\` after a production build, then re-run.`);
		process.exit(1);
	}
	const setupStarted = Date.now();
	for (const tier of TIERS) generateWorkload(tier.id);
	const setupMs = Date.now() - setupStarted;
	if (process.env.SPOT_REQUIRE_VERIFIED === '1') {
		const preview = await fetch(`${BASE_URL}/_app/version.json`, { cache: 'no-store' }).then((response) => response.json()) as { version?: string };
		if (preview.version !== gitRevision()) throw new Error(`Preview build is ${preview.version ?? 'unknown'}, expected ${gitRevision()}`);
		if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: REPO, encoding: 'utf8' }).trim()) throw new Error('Verified spot check requires a clean committed runner');
	}
	const measuredStarted = Date.now();
	const browser = await launchBrowser();
	const browserVersion = browser.version();
	const reports: TierReport[] = [];
	const failures: { tier: SpotTier; session: number; error: string; observations: unknown }[] = [];
	const runnerDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: REPO, encoding: 'utf8' }).trim() !== '';
	let capped = false;
	try {
		for (const tier of TIERS) {
			if (Date.now() - measuredStarted > WALL_CAP_MS) {
				capped = true;
				break;
			}
			const loaded = loadWorkload(tier.id);
			const projectId = uniqueProjectId(tier.tier);
			const canonicalJson = workloadJsonFor(loaded, projectId);
			const source = JSON.parse(canonicalJson) as { units: { layout: { data: { walls: { id: string }[] } } } };
			const wallId = loaded.meta.focusWallId ?? source.units.layout.data.walls[0]?.id;
			if (!wallId) throw new Error(`Missing known wall for ${tier.id}`);
			const tierStarted = Date.now();
			reports.push(...await collectSessions<TierReport>(async (sessionIndex) => {
				if (Date.now() - measuredStarted > WALL_CAP_MS) { capped = true; return null; }
				const session = await newMeasuredSession(browser, {
					viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0', cacheState: 'cold'
				});
				try {
					await session.page.goto(BASE_URL);
					const measured = await runOnce(session.page, session.cdp, tier.tier, projectId, canonicalJson, wallId);
					const decision = interactionDecision(decisionInput(tier.tier, measured));
					return { tier: tier.tier, workloadId: tier.id, digest: loaded.meta.contentDigest,
						sessions: sessionIndex + 1, label: decision.label, onTheLine: decision.onTheLine,
						elapsedMs: Date.now() - tierStarted, ...measured };
				} catch (error) {
					failures.push({ tier: tier.tier, session: sessionIndex + 1, error: String(error), observations: await readLedger(session.page).catch(() => null) });
					return null;
				} finally { await session.close(); }
			}));
		}
	} finally {
		await browser.close();
	}
	const tiers = TIERS.map(({ tier }) => {
		const sessions = reports.filter((report) => report.tier === tier);
		return { tier, label: sessionLabel([...sessions.map((session) => session.label), ...failures.filter((failure) => failure.tier === tier).map(() => 'incomplete' as const)]), sessions };
	});
	const labels = tiers.map((tier) => tier.label);
	const previewVersions = [...new Set([...reports.map((row) => row.previewVersion), ...failures.map(() => null)])];
	const runnerRevision = gitRevision();
	const provenance = previewProvenance(runnerRevision, runnerDirty, previewVersions);
	const elapsedMs = Date.now() - measuredStarted;
	const report = {
		command: 'perf:spot',
		revision: provenance.revision,
		provenance,
		baseUrl: BASE_URL,
		machine: {
			platform: process.platform,
			arch: process.arch,
			node: process.version,
			cpu: cpus()[0]?.model ?? 'unknown',
			loadAverage: loadavg()[0]
		},
		browser: { version: browserVersion },
		setupMs,
		elapsedMs,
		capped,
		labels,
		failures,
		tiers
	};
	const directory = process.env.PERF_RESULTS_DIR ?? join(tmpdir(), 'biskiq-spot');
	mkdirSync(directory, { recursive: true });
	const file = join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-spot.json`);
	writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
	for (const tier of reports) {
		console.log(`${tier.tier} ${tier.workloadId} ${tier.label} sessions=${tier.sessions} refresh=${tier.refreshPeriodMs.toFixed(2)} ms (${tier.refreshSource}) elapsed=${(tier.elapsedMs / 1000).toFixed(1)} s`);
		console.log(`  open admission=${fmt(tier.open.admissionMs)} editor-through-render=${fmt(tier.open.editorMs)} presented=${fmt(tier.open.presentedMs)} automation=${fmt(tier.open.automationMs)}`);
		console.log(`  drag editor max=${fmt(maxOf(tier.drag.editorMs))} presented max=${fmt(maxOf(tier.drag.presentedMs))} n=${tier.drag.editorMs.length}`);
		console.log(`  pan editor max=${fmt(maxOf(tier.pan.editorMs))} presented max=${fmt(maxOf(tier.pan.presentedMs))} n=${tier.pan.editorMs.length}`);
		console.log(`  commit editor=${fmt(tier.commit.editorMs)} presented=${fmt(tier.commit.presentedMs)} automation=${fmt(tier.commit.automationMs)} undo=${tier.undo.required ? fmt(tier.undo.editorMs) : 'not required'}`);
	}
	for (const failure of failures) console.error(`${failure.tier} session ${failure.session}: ${failure.error}`);
	console.log(`spot ${capped ? 'capped' : 'finished'} in ${(elapsedMs / 1000).toFixed(1)} s (setup ${(setupMs / 1000).toFixed(1)} s) → ${file}`);
	process.exit(spotExitCode(labels, capped));
}

function maxOf(values: readonly number[]): number | null {
	const finite = values.filter((value) => Number.isFinite(value));
	return finite.length === 0 ? null : Math.max(...finite);
}

function fmt(value: number | null): string {
	return value === null || !Number.isFinite(value) ? 'missing' : `${value.toFixed(1)} ms`;
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
