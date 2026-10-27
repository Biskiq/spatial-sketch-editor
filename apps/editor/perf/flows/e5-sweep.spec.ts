/**
 * E5 — irrelevance sweep, browser counts (T1.P02.S06 C). "Count, not timing."
 *
 * The Node census (`perf:census`) counts compile, validation, digest and F4
 * work. This spec reads what only the browser has, at the fixed view and the
 * fixed edit, for the museum at ×1 and the sweep workloads at ×3 and ×10:
 *
 * - render counters per frame at rest (draws, triangles, shadow-map passes and
 *   shadow draws) and the renderer's live programs, geometries and textures;
 * - the work and render counts of the fixed edit's commit (the focus Wall's
 *   exact length, typed through the shipped Dimensions instrument);
 * - **visual non-influence**: the Stage scene rendered at the authored fixed
 *   View ("Focus wing — enfilade") and read back from the drawing buffer, before
 *   and after the fixed edit. Variant H must be pixel-identical to ×1; variant D
 *   (beyond the fixed view's far end, on its axis) and the connected variant C
 *   (the owner's D3 ruling; joined to the museum, with Openings) are recorded,
 *   not asserted.
 *
 * A renderer crash at a D or C workload is recorded as a bounded failure row
 * for that workload (the owner's D4 ruling) and the sweep continues; a crash at
 * the museum or an H workload fails the census, since they carry its proof.
 *
 * The readback renders the same scene with a clone of the Stage camera posed at
 * the View, synchronously, then reads the buffer in the same task; the Stage's
 * own camera and next frame are untouched. Timings here are never cited.
 */

import { expect, test, type Page } from '@playwright/test';

import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT, passLimitations } from '../lib/config';
import { acceptedResultCount, commitPrecisionLength, gotoCreateIntent, openSourceJson, uniqueProjectId, waitForAcceptedResult, waitForStageSettled } from '../lib/flow';
import { fileReport, startReport } from '../lib/report';
import {
	COUNT_LABEL,
	crashRow,
	E5_FIXED_VIEW_LABEL,
	isRendererCrash,
	E5_FOCUS_WALL_NAME,
	readRenderCounters,
	readResidentBytes,
	readWork,
	renderCounterDelta,
	residentMetrics,
	resetRenderMaxima,
	SMOKE_LABEL,
	SMOKE,
	tierAvailability,
	tierProject,
	workDelta,
	workMetrics,
	unrunRow
} from '../lib/tiers';
import type { WorkloadId } from '../lib/workloads/registry';

const FIXED_VIEW_LABEL = E5_FIXED_VIEW_LABEL;
const FOCUS_WALL_NAME = E5_FOCUS_WALL_NAME;
const REST_WINDOW_MS = 1_000;
/**
 * C10 is opening-heavy: an isolated reproduction reached `f2:open-admitted` at
 * 322.4 s, just beyond the 300 s large-tier bound while H10 admitted in 2.1 s.
 * E5 is count/visual correctness, not a timing row, so C10 gets a bound with
 * margin instead of aborting the gate; the measured open time is not a metric.
 */
const C10_OPEN_WAIT_MS = 600_000;

const SWEEP: readonly { readonly id: WorkloadId; readonly factor: number; readonly variant: 'base' | 'H' | 'D' | 'C' }[] = [
	{ id: 'museum', factor: 1, variant: 'base' },
	{ id: 'sweep-H3', factor: 3, variant: 'H' },
	{ id: 'sweep-H10', factor: 10, variant: 'H' },
	{ id: 'sweep-D3', factor: 3, variant: 'D' },
	{ id: 'sweep-D10', factor: 10, variant: 'D' },
	{ id: 'sweep-C3', factor: 3, variant: 'C' },
	{ id: 'sweep-C10', factor: 10, variant: 'C' }
];

type View = { eye: number[]; target: number[]; fov: number };
type Framebuffer = { width: number; height: number; hash: string; pixels: string };

async function framebufferAt(page: Page, view: View): Promise<Framebuffer> {
	return page.evaluate(async ({ eye, target, fov }) => {
		type Vec = { set(x: number, y: number, z: number): void };
		type Cam = { clone(): Cam; position: Vec; up: Vec; lookAt(x: number, y: number, z: number): void; fov: number; aspect: number; near: number; far: number; matrixAutoUpdate: boolean; updateProjectionMatrix(): void; updateMatrixWorld(force?: boolean): void };
		const refs = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { renderer: { render(s: unknown, c: unknown): void; getContext(): WebGL2RenderingContext }; scene: unknown; camera: Cam }> }).__BISKIQ_PERF_RENDER_REFS__;
		const stage = refs?.stage;
		if (stage === undefined) throw new Error('no Stage renderer was handed to the harness');
		const camera = stage.camera.clone();
		// The Stage writes its pose straight into the matrix and fits its clip
		// planes to the whole project from afar; the clone inherits both, so it
		// recomposes its matrix from the View pose and clips for an eye in a room.
		camera.matrixAutoUpdate = true;
		camera.near = 0.05;
		camera.far = 1_000;
		camera.position.set(eye[0]!, eye[1]!, eye[2]!);
		camera.up.set(0, 1, 0);
		camera.lookAt(target[0]!, target[1]!, target[2]!);
		camera.fov = fov;
		const gl = stage.renderer.getContext();
		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld(true);
		// The readback is not a Stage frame: pause the counters for this one render.
		const flags = window as unknown as { __BISKIQ_PERF_RENDER_PAUSED__?: boolean };
		const pixels = new Uint8Array(width * height * 4);
		flags.__BISKIQ_PERF_RENDER_PAUSED__ = true;
		try {
			stage.renderer.render(stage.scene, camera);
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		} finally {
			flags.__BISKIQ_PERF_RENDER_PAUSED__ = false;
		}
		let uniform = true;
		for (let index = 4; index < pixels.length && uniform; index += 4) {
			if (pixels[index] !== pixels[0] || pixels[index + 1] !== pixels[1] || pixels[index + 2] !== pixels[2] || pixels[index + 3] !== pixels[3]) uniform = false;
		}
		if (uniform) throw new Error('the fixed View read back as one colour: the readback sees no scene, so no equality could prove anything');
		const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
		let binary = '';
		for (let index = 0; index < pixels.length; index += 0x8000) binary += String.fromCharCode(...pixels.subarray(index, index + 0x8000));
		return { width, height, hash: [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join(''), pixels: btoa(binary) };
	}, view);
}

function differingPixels(a: Framebuffer, b: Framebuffer): number {
	if (a.width !== b.width || a.height !== b.height) return Number.POSITIVE_INFINITY;
	const left = Buffer.from(a.pixels, 'base64');
	const right = Buffer.from(b.pixels, 'base64');
	let differing = 0;
	for (let index = 0; index < left.length; index += 4) {
		if (left[index] !== right[index] || left[index + 1] !== right[index + 1] || left[index + 2] !== right[index + 2] || left[index + 3] !== right[index + 3]) differing += 1;
	}
	return differing;
}

test.describe('E5 browser counts and visual non-influence', () => {
	test.setTimeout(3_600_000);
	test('fixed view and fixed edit across the sweep', async ({ browser }, testInfo) => {
		const report = startReport(`e5-sweep-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const frames: Record<string, { before: Framebuffer; after: Framebuffer }> = {};
		for (const entry of SWEEP) {
			const availability = tierAvailability(entry.id);
			if (!availability.available) {
				report.rows.push(unrunRow(`E5-${entry.id}-unrun`, 'E5 browser counts', entry.id, testInfo.project.name, availability.reason));
				continue;
			}
			// One warm session per workload: E5 counts, not cache-state timings.
			const session = await newMeasuredSession(browser, { viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: 'N0', cacheState: 'warm' });
			try {
				const { page } = session;
				const projectId = uniqueProjectId(`e5-${entry.id}`);
				const project = tierProject(entry.id, projectId);
				const view = project.envelope.units.camera.data.views.find((candidate) => candidate.label === FIXED_VIEW_LABEL);
				if (view === undefined) throw new Error(`${entry.id} has no "${FIXED_VIEW_LABEL}" View`);
				const focus = project.envelope.units.layout.data.walls.find((wall) => wall.name === FOCUS_WALL_NAME);
				if (focus === undefined) throw new Error(`${entry.id} has no "${FOCUS_WALL_NAME}" Wall`);
				const junction = (id: string) => project.envelope.units.layout.data.junctions.find((candidate) => candidate.id === id)!.point;
				const [sx, sz] = junction(focus.startJunctionId);
				const [ex, ez] = junction(focus.endJunctionId);
				const fixedLength = Number((Math.hypot(ex - sx, ez - sz) * 0.98).toFixed(3));

				await gotoCreateIntent(page, projectId);
				await openSourceJson(page, project, entry.id === 'sweep-C10' ? C10_OPEN_WAIT_MS : undefined);
				await waitForStageSettled(page);

				await page.waitForTimeout(1_100);
				await resetRenderMaxima(page);
				const restBefore = await readRenderCounters(page);
				await page.waitForTimeout(REST_WINDOW_MS);
				const rest = renderCounterDelta(restBefore, await readRenderCounters(page)).stage;
				const residentAtRest = await readResidentBytes(page);
				const before = await framebufferAt(page, view);

				// The fixed edit: the focus Wall's exact length through the shipped instrument.
				// The Index labels a Wall by its id (`wall · <id>`); search narrows a large list.
				await page.locator('#plate-index-search').fill(focus.id);
				await page.locator('button.item-row', { hasText: focus.id }).first().click();
				await page.locator('.contributed-item button.item-row', { hasText: 'Dimensions' }).first().click();
				const workBefore = await readWork(page);
				const renderBefore = await readRenderCounters(page);
				const accepted = await acceptedResultCount(page);
				await commitPrecisionLength(page, fixedLength);
				await waitForAcceptedResult(page, accepted);
				await waitForStageSettled(page);
				const commitWork = workDelta(workBefore, await readWork(page));
				const commitRender = renderCounterDelta(renderBefore, await readRenderCounters(page)).stage;
				const after = await framebufferAt(page, view);
				frames[entry.id] = { before, after };

				const perFrame = (value: number | undefined) => (value ?? 0) / Math.max(1, rest?.frames ?? 0);
				report.rows.push({
					id: `E5-${entry.id}`,
					flow: 'E5 browser counts',
					workload: `${entry.id} (×${entry.factor}, variant ${entry.variant}; ${project.contentDigest})`,
					cacheState: 'warm',
					network: 'N0',
					browser: testInfo.project.name,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						factor: entry.factor,
						variant: entry.variant,
						'rest:framesInWindow': rest?.frames ?? 0,
						'rest:drawCallsPerFrame': perFrame(rest?.drawCalls),
						'rest:trianglesPerFrame': perFrame(rest?.triangles),
						'rest:shadowMapRendersPerFrame': perFrame(rest?.shadowMapRenders),
						'rest:shadowDrawCallsPerFrame': perFrame(rest?.shadowDrawCalls),
						'live:programs': rest?.programs ?? 0,
						'live:geometries': rest?.geometries ?? 0,
						'live:textures': rest?.textures ?? 0,
						'commit:geometriesAfter': commitRender?.geometries ?? 0,
						'commit:texturesAfter': commitRender?.textures ?? 0,
						'commit:frames': commitRender?.frames ?? 0,
						...Object.fromEntries(Object.entries(workMetrics(commitWork)).filter(([name]) => name.startsWith('work:')).map(([name, value]) => [`commit:${name}`, value])),
						...residentMetrics(residentAtRest, 'rest'),
						fixedViewHashBefore: before.hash,
						fixedViewHashAfter: after.hash
					},
					limitations: [COUNT_LABEL, ...passLimitations(), ...(SMOKE ? [SMOKE_LABEL] : []), 'framebuffer read back from a clone of the Stage camera posed at the fixed View; stage time is never cited']
				});
			} catch (error) {
				// Only the recorded variants are bounded; the museum and H carry the proof.
				const bounded = (entry.variant === 'D' || entry.variant === 'C') && isRendererCrash(error);
				if (bounded) {
					report.rows.push(crashRow(`E5-${entry.id}`, 'E5 browser counts', `${entry.id} (×${entry.factor}, variant ${entry.variant})`, testInfo.project.name, 'warm', error));
				} else {
					// A timeout used to abort the pass without saying which workload it
					// was. Name the entry so the manifest's abort cause is actionable.
					const message = error instanceof Error ? error.message : String(error);
					throw new Error(`E5 ${entry.id} (variant ${entry.variant}, ×${entry.factor}): ${message}`, { cause: error });
				}
			} finally {
				await session.close();
			}
		}
		const base = frames.museum;
		const verdicts: Record<string, string | number> = {};
		for (const entry of SWEEP.filter((candidate) => candidate.variant !== 'base')) {
			const at = frames[entry.id];
			if (base === undefined || at === undefined) continue;
			verdicts[`${entry.id}:beforeEditDifferingPixels`] = differingPixels(base.before, at.before);
			verdicts[`${entry.id}:afterEditDifferingPixels`] = differingPixels(base.after, at.after);
		}
		if (base !== undefined) verdicts['museum:editChangedPixels'] = differingPixels(base.before, base.after);
		report.rows.push({ id: 'E5-visual-non-influence', flow: 'E5 framebuffer equality', browser: testInfo.project.name, cpuRate: 1, viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`, metrics: verdicts, limitations: [COUNT_LABEL, ...passLimitations(), 'variant H must be pixel-identical to ×1 at the fixed View; variants D and C are recorded, not asserted'] });
		console.log(`E5 visual non-influence: ${JSON.stringify(verdicts)}`);
		console.log(`raw results: ${fileReport(report)}`);
		// The proof: the edit is visible at the fixed View (the check can see a
		// change), and adding variant H's unrelated work changes no pixel there.
		if (base !== undefined) expect(verdicts['museum:editChangedPixels']).toBeGreaterThan(0);
		for (const entry of SWEEP.filter((candidate) => candidate.variant === 'H')) {
			if (frames[entry.id] === undefined) continue;
			expect(verdicts[`${entry.id}:beforeEditDifferingPixels`], `${entry.id} before the edit`).toBe(0);
			expect(verdicts[`${entry.id}:afterEditDifferingPixels`], `${entry.id} after the edit`).toBe(0);
		}
	});
});
