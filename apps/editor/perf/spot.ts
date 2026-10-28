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
	selectFirstWall,
	setStageReading,
	uniqueProjectId,
	waitForAcceptedResult,
	waitForStageSettled
} from './lib/flow';
import { correlateInputs, readLedger, type LedgerRecord } from './lib/ledger';
import {
	FRAME_CAP,
	FRAME_FLOOR,
	MOVE_EDITOR_MS,
	SAMPLE_CAP,
	SAMPLE_FLOOR,
	SESSION_CAP,
	WALL_CAP_MS,
	frameStop,
	interactionDecision,
	nextSession,
	seriesStop,
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

type WorkSnapshot = { spans: Record<string, { count: number; totalMs: number; maxMs: number }>; counts: Record<string, number> };

type TierReport = {
	readonly tier: SpotTier;
	readonly workloadId: WorkloadId;
	readonly digest: string;
	readonly sessions: number;
	readonly label: SpotLabel;
	readonly onTheLine: boolean;
	readonly refreshPeriodMs: number;
	readonly refreshSource: string;
	readonly open: { editorMs: number | null; automationMs: number | null };
	readonly drag: { editorMs: number[]; presentedMs: number[]; automationMs: number[]; supersededFraction: number | null };
	readonly pan: { editorMs: number[]; presentedMs: number[]; automationMs: number[] };
	readonly frames: number[];
	readonly commit: { editorMs: number | null; presentedMs: number | null; automationMs: number | null };
	readonly undo: { required: boolean; editorMs: number | null };
	readonly pick: { beforeMs: number | null; afterMs: number | null; resolved: boolean | null; indexBuilds: number | null };
	readonly work: WorkSnapshot | null;
	readonly unsplit: boolean;
	readonly elapsedMs: number;
};

function gitRevision(): string {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
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

async function markDelta(page: Page, startName: string, endName: string): Promise<number | null> {
	return page.evaluate(([start, end]) => {
		const records = (window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] }).__BISKIQ_PERF_RECORDS__ ?? [];
		let started: number | null = null;
		let ended: number | null = null;
		for (const record of records) {
			if (record.name === start) started = record.time;
			if (record.name === end && started !== null && record.time >= started) ended = record.time;
		}
		return started === null || ended === null ? null : ended - started;
	}, [startName, endName] as const);
}

async function workSnapshot(page: Page): Promise<WorkSnapshot | null> {
	return page.evaluate(() => {
		const ledger = (globalThis as { __BISKIQ_PERF_WORK__?: WorkSnapshot }).__BISKIQ_PERF_WORK__;
		if (ledger === undefined) return null;
		return JSON.parse(JSON.stringify(ledger)) as WorkSnapshot;
	});
}

function countDelta(before: WorkSnapshot | null, after: WorkSnapshot | null, name: string): number | null {
	if (before === null || after === null) return null;
	return (after.counts[name] ?? 0) - (before.counts[name] ?? 0);
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

async function dragSamples(page: Page, wanted: number): Promise<{ editor: number[]; presented: number[]; automation: number[]; superseded: number; inputs: number }> {
	const startHandle = await handlePoint(page, 'Wall start');
	const end = await handlePoint(page, 'Wall end');
	const dx = end.x - startHandle.x;
	const dy = end.y - startHandle.y;
	const length = Math.hypot(dx, dy) || 1;
	const direction = { x: dx / length, y: dy / length };
	const ledgerBefore = (await readLedger(page)).records.length;
	await page.mouse.move(end.x, end.y);
	await page.mouse.down();
	const editor: number[] = [];
	const presented: number[] = [];
	const automation: number[] = [];
	for (let index = 1; index <= wanted; index += 1) {
		const progress = (24 * index) / wanted;
		const dispatched = await pageNow(page);
		await page.mouse.move(end.x + direction.x * progress, end.y + direction.y * progress);
		await page.waitForTimeout(32);
		const ledger = await readLedger(page);
		const fresh = ledger.records.slice(ledgerBefore);
		const sample = correlateInputs(fresh, ledger.ticks).at(-1);
		if (sample === undefined) continue;
		automation.push(Math.max(0, sample.inputTime - dispatched));
		if (sample.installTime !== null) editor.push(sample.installTime - sample.inputTime);
		if (sample.latency !== null) presented.push(sample.latency);
	}
	await page.mouse.up();
	const ledger = await readLedger(page);
	const samples = correlateInputs(ledger.records.slice(ledgerBefore), ledger.ticks);
	const superseded = samples.filter((sample) => sample.status === 'superseded').length;
	return { editor, presented, automation, superseded, inputs: samples.length };
}

async function panSamples(page: Page, cdp: CDPSession, wanted: number): Promise<{ editor: number[]; presented: number[]; automation: number[] }> {
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) return { editor: [], presented: [], automation: [] };
	await cdp.send('Performance.enable');
	await page.evaluate(() => {
		const target = window as Window & { __spotPan?: { received: number; presented: number }[] };
		target.__spotPan = [];
		if ((target as Window & { __spotPanBound?: boolean }).__spotPanBound) return;
		(target as Window & { __spotPanBound?: boolean }).__spotPanBound = true;
		document.addEventListener('pointermove', (event) => {
			if (event.buttons === 0) return;
			const received = event.timeStamp;
			requestAnimationFrame((time) => {
				target.__spotPan?.push({ received, presented: time });
			});
		}, true);
	});
	const editor: number[] = [];
	const presented: number[] = [];
	const automation: number[] = [];
	const originX = box.x + 12;
	const originY = box.y + box.height * 0.15;
	await page.mouse.move(originX, originY);
	await page.mouse.down();
	for (let index = 1; index <= wanted; index += 1) {
		const beforeCount = await page.evaluate(() => (window as Window & { __spotPan?: unknown[] }).__spotPan?.length ?? 0);
		const before = await cdp.send('Performance.getMetrics');
		const dispatched = await pageNow(page);
		await page.mouse.move(originX + index * 12, originY);
		await page.waitForFunction((count) => ((window as Window & { __spotPan?: unknown[] }).__spotPan?.length ?? 0) > count, beforeCount, { timeout: 1000 }).catch(() => undefined);
		const after = await cdp.send('Performance.getMetrics');
		const sample = await page.evaluate(() => (window as Window & { __spotPan?: { received: number; presented: number }[] }).__spotPan?.at(-1) ?? null);
		const taskSeconds = metric(after, 'TaskDuration') - metric(before, 'TaskDuration');
		const editorMs = Number.isFinite(taskSeconds) ? Math.max(0, taskSeconds * 1000) : Number.NaN;
		if (sample === null) continue;
		if (Number.isFinite(editorMs)) editor.push(editorMs);
		presented.push(Math.max(0, sample.presented - sample.received));
		automation.push(Math.max(0, sample.received - dispatched));
	}
	await page.mouse.up();
	return { editor, presented, automation };
}

function metric(payload: { metrics: { name: string; value: number }[] }, name: string): number {
	return payload.metrics.find((entry) => entry.name === name)?.value ?? Number.NaN;
}

async function clickPick(page: Page): Promise<{ elapsedMs: number | null; resolved: boolean | null; indexBuilds: number | null }> {
	const before = await workSnapshot(page);
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) return { elapsedMs: null, resolved: null, indexBuilds: null };
	const marksBefore = (await readLedger(page)).records.length;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(50);
	const ledger = await readLedger(page);
	const mark = [...ledger.records.slice(marksBefore)].reverse().find((record) => record.name === 'stage:pick');
	const elapsed = typeof mark?.detail?.elapsedMs === 'number' ? mark.detail.elapsedMs : null;
	const after = await workSnapshot(page);
	return {
		elapsedMs: elapsed,
		resolved: mark === undefined ? null : true,
		indexBuilds: countDelta(before, after, 'plan-pick:node-built')
	};
}

async function undoIfCommitted(page: Page, before: number): Promise<void> {
	const accepted = await acceptedResultCount(page);
	if (accepted <= before) return;
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await waitForAcceptedResult(page, accepted).catch(() => undefined);
}

async function runOnce(page: Page, cdp: CDPSession, tier: SpotTier, projectId: string, canonicalJson: string): Promise<Omit<TierReport, 'tier' | 'workloadId' | 'digest' | 'sessions' | 'label' | 'onTheLine' | 'elapsedMs'>> {
	const refresh = await refreshPeriod(page);
	const openWallStart = Date.now();
	await page.goto(`${BASE_URL}/project/${encodeURIComponent(projectId)}/spatial?create=1`);
	await page.getByRole('dialog', { name: 'Start a project' }).waitFor();
	await openSourceJson(page, { size: tier, projectId, envelope: JSON.parse(canonicalJson), canonicalJson, facts: { walls: 0, openings: 0, rooms: 0 } });
	const openWallMs = Date.now() - openWallStart;
	const openEditor = await markDelta(page, 'f2:open-requested', 'f2:open-admitted');
	await setStageReading(page, 'Plan');
	await fitStage(page);
	await waitForStageSettled(page, 30_000);
	await selectFirstWall(page);

	const beforeDrag = await acceptedResultCount(page);
	let dragWanted = SAMPLE_FLOOR;
	let drag = await dragSamples(page, dragWanted);
	let dragStop = seriesStop(drag.editor, MOVE_EDITOR_MS[tier]);
	while (dragStop.action === 'extend' && dragWanted < SAMPLE_CAP) {
		await undoIfCommitted(page, beforeDrag);
		dragWanted += 1;
		drag = await dragSamples(page, dragWanted);
		dragStop = seriesStop(drag.editor, MOVE_EDITOR_MS[tier]);
	}
	await undoIfCommitted(page, beforeDrag);

	const pickBefore = await clickPick(page);
	await selectFirstWall(page);
	const lengthField = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
	await lengthField.waitFor({ state: 'visible' });
	const currentLength = Number(await lengthField.inputValue());
	const nextLength = Number((currentLength + 0.05).toFixed(3));
	const commitDispatch = await pageNow(page);
	const acceptedBefore = await acceptedResultCount(page);
	await commitPrecisionLength(page, Number.isFinite(nextLength) ? nextLength : currentLength + 0.05);
	const accepted = await waitForAcceptedResult(page, acceptedBefore);
	const command = [...(await readLedger(page)).records].reverse().find((record) => record.name === 'command:commit');
	const commitEditor = command === undefined ? null : accepted.time - command.time;
	const ledger = await readLedger(page);
	const presentedTick = ledger.ticks.find((tick) => tick >= accepted.time);
	const commitPresented = command === undefined || presentedTick === undefined ? null : presentedTick - command.time;
	const commitAutomation = command === undefined ? null : Math.max(0, command.time - commitDispatch);

	const pickAfter = await clickPick(page);
	let panWanted = SAMPLE_FLOOR;
	let pan = await panSamples(page, cdp, panWanted);
	let panStop = seriesStop(pan.editor, MOVE_EDITOR_MS[tier]);
	while (panStop.action === 'extend' && panWanted < SAMPLE_CAP) {
		panWanted += 1;
		pan = await panSamples(page, cdp, panWanted);
		panStop = seriesStop(pan.editor, MOVE_EDITOR_MS[tier]);
	}

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
		undoEditor = undone.time - undoDispatch;
	}

	const work = await workSnapshot(page);
	const supersededFraction = drag.inputs === 0 ? null : drag.superseded / drag.inputs;
	return {
		refreshPeriodMs: refresh.ms,
		refreshSource: refresh.source,
		open: {
			editorMs: openEditor,
			automationMs: openEditor === null ? null : Math.max(0, openWallMs - openEditor)
		},
		drag: { editorMs: drag.editor, presentedMs: drag.presented, automationMs: drag.automation, supersededFraction },
		pan: { editorMs: pan.editor, presentedMs: pan.presented, automationMs: pan.automation },
		frames,
		commit: { editorMs: commitEditor, presentedMs: commitPresented, automationMs: commitAutomation },
		undo: { required: undoIsRequired, editorMs: undoEditor },
		pick: {
			beforeMs: pickBefore.elapsedMs,
			afterMs: pickAfter.elapsedMs,
			resolved: pickBefore.resolved === null && pickAfter.resolved === null ? null : pickBefore.resolved !== false && pickAfter.resolved !== false,
			indexBuilds: pickAfter.indexBuilds
		},
		work,
		unsplit: openEditor === null && drag.editor.length === 0
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
		pickMeasured: measured.pick.beforeMs !== null || measured.pick.afterMs !== null,
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
	const measuredStarted = Date.now();
	const browser = await launchBrowser();
	const browserVersion = browser.version();
	const reports: TierReport[] = [];
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
			const tierStarted = Date.now();
			let sessions = 0;
			let last: TierReport | null = null;
			let previousLabel: SpotLabel | null = null;
			while (sessions < SESSION_CAP) {
				if (Date.now() - measuredStarted > WALL_CAP_MS) {
					capped = true;
					break;
				}
				const session = await newMeasuredSession(browser, {
					viewport: { width: 1920, height: 1080 },
					deviceScaleFactor: 1,
					network: 'N0',
					cacheState: 'cold'
				});
				try {
					await session.page.goto(BASE_URL);
					const measured = await runOnce(session.page, session.cdp, tier.tier, projectId, canonicalJson);
					const decision = interactionDecision(decisionInput(tier.tier, measured));
					sessions += 1;
					last = {
						tier: tier.tier,
						workloadId: tier.id,
						digest: loaded.meta.contentDigest,
						sessions,
						label: decision.label,
						onTheLine: decision.onTheLine,
						elapsedMs: Date.now() - tierStarted,
						...measured
					};
					const request = nextSession({
						sessionsSoFar: sessions,
						onTheLine: decision.onTheLine,
						transientContaminationCouldFlip: false,
						labelsDisagree: previousLabel !== null && previousLabel !== decision.label
					});
					previousLabel = decision.label;
					if (!request.another) break;
				} finally {
					await session.close();
				}
			}
			if (last !== null) reports.push(last);
		}
	} finally {
		await browser.close();
	}
	const labels = reports.map((report) => report.label);
	const elapsedMs = Date.now() - measuredStarted;
	const report = {
		command: 'perf:spot',
		revision: gitRevision(),
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
		tiers: reports
	};
	const directory = process.env.PERF_RESULTS_DIR ?? join(tmpdir(), 'biskiq-spot');
	mkdirSync(directory, { recursive: true });
	const file = join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-spot.json`);
	writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
	for (const tier of reports) {
		console.log(`${tier.tier} ${tier.workloadId} ${tier.label} sessions=${tier.sessions} refresh=${tier.refreshPeriodMs.toFixed(2)} ms (${tier.refreshSource}) elapsed=${(tier.elapsedMs / 1000).toFixed(1)} s`);
		console.log(`  open editor=${fmt(tier.open.editorMs)} automation=${fmt(tier.open.automationMs)}`);
		console.log(`  drag editor max=${fmt(maxOf(tier.drag.editorMs))} presented max=${fmt(maxOf(tier.drag.presentedMs))} n=${tier.drag.editorMs.length}`);
		console.log(`  pan editor max=${fmt(maxOf(tier.pan.editorMs))} presented max=${fmt(maxOf(tier.pan.presentedMs))} n=${tier.pan.editorMs.length}`);
		console.log(`  commit editor=${fmt(tier.commit.editorMs)} presented=${fmt(tier.commit.presentedMs)} undo=${tier.undo.required ? fmt(tier.undo.editorMs) : 'not required'}`);
	}
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
