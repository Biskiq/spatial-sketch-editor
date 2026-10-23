/** Separate diagnostic: trace + visual identity perturb this flow. No budget claim. */
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { newMeasuredSession } from '../lib/browser';
import { fixtureProject } from '../lib/fixtures';
import { gotoCreateIntent, openSourceJson, selectFirstWallAndOpenDimensions, dragWallHandle, handlePoint, uniqueProjectId } from '../lib/flow';
import { readLedger } from '../lib/ledger';
import { resultsDirectory, startReport } from '../lib/report';
import { controlledDelayVerdict, installTraceFrameGate, type GateSnapshot, type TraceFrameGate } from '../lib/trace-frame-gate';
import { installTraceRuntimeObservation } from '../lib/trace-runtime-health';
import { resolveTracePresentation } from '../lib/trace-presentation';
import { clockAnchor, correlateTraceInputs, decodeTraceImages, normalizeTraceClock, startChromeTrace, type TraceEvent } from '../lib/trace-proof';

test('sequenced preview identity in Chrome trace images, mismatch and delayed controls', async ({ browser }, testInfo) => {
	test.setTimeout(240_000);
	const directory = resolve(resultsDirectory(), `trace-proof-${testInfo.project.name}-${Date.now()}`);
	mkdirSync(directory, { recursive: true });
	const observations: unknown[] = [];
	for (const mode of ['untraced', 'trace', 'delayed-trace', 'gated-trace', 'zero-hold-trace'] as const) {
		const traced = mode !== 'untraced';
		const gated = mode === 'gated-trace' || mode === 'zero-hold-trace';
		const session = await newMeasuredSession(browser, {
			viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N0', cacheState: 'cold',
			harness: { frameDelayMs: mode === 'delayed-trace' ? 500 : 0 }
		});
		let stop: (() => Promise<TraceEvent[]>) | undefined;
		try {
			const { page, cdp } = session;
			await page.addInitScript(installTraceRuntimeObservation);
			if (gated) await page.addInitScript(installTraceFrameGate);

			const id = uniqueProjectId(`trace-${mode}`);
			await gotoCreateIntent(page, id);
			await openSourceJson(page, await fixtureProject('S', id));
			await selectFirstWallAndOpenDimensions(page);
			const runtimeBefore = await readRuntimeHealth(page);
			const box = await page.locator('svg.overlay').boundingBox();
			if (!box) throw new Error('No Stage overlay bounds');
			if (traced) {
				await page.evaluate(() => {
					const target = window as Window & { __BISKIQ_PERF__?: Record<string, unknown> };
					if (!target.__BISKIQ_PERF__) throw new Error('Missing measurement harness');
					target.__BISKIQ_PERF__.traceProof = true;
				});
				stop = await startChromeTrace(cdp);
			}
			const begin = await clockAnchor(page, `biskiq-trace-clock-${mode}-begin`);
			// Declared hold is workload, not evidence: only trace image identity and
			// actual preview pixels below establish a captured matching preview.
			const gate = gated ? await gatedDrag(page, mode === 'gated-trace' ? 500 : 0) : null;
			if (!gated) await dragWallHandle(page, { samples: 60, distance: 6, settleMs: 900 });
			const end = await clockAnchor(page, `biskiq-trace-clock-${mode}-end`);
			const ledger = await readLedger(page);
			const runtimeAfter = await readRuntimeHealth(page);
			const modeDir = join(directory, mode); mkdirSync(modeDir);
			if (!traced) {
				expect(await page.locator('[data-perf-trace-proof]').count()).toBe(0);
				expect(ledger.records.some((record) => record.name.startsWith('trace:overlay:'))).toBe(false);
				observations.push({ mode, workloadElapsedMs: end.pageTimeMs - begin.pageTimeMs, records: ledger.records, runtimeBefore, runtimeAfter });
				continue;
			}
			const events = await stop!(); stop = undefined;
			writeFileSync(join(modeDir, 'chrome-trace.json'), JSON.stringify({ traceEvents: events }));
			const clock = normalizeTraceClock(events, [begin, end]);
			const images = await decodeTraceImages(events, ledger.records, { ...box, viewportWidth: 1920 }, clock, modeDir);
			expect(images.length, 'Screenshot cap exhausted; final preview evidence may be censored').toBeLessThan(450);
			const rows = correlateTraceInputs(ledger.records, images);
			const mismatched = correlateTraceInputs(ledger.records, images.map((image) => ({ ...image, signature: -1 })));
			const missingPreview = correlateTraceInputs(ledger.records, images.map((image) => ({ ...image, previewPixelMatches: false })));
			const finalImage = images.find((candidate) => candidate.index === rows.at(-1)?.tracePresentedFrameIndex);
			const finalScreenshot = events.find((event) => event.name === 'Screenshot' && event.ts === finalImage?.traceTimeUs);
			if (!finalScreenshot) throw new Error('Final preview has no trace-reported presentation');
			const positivePresentation = resolveTracePresentation(finalScreenshot, events);
			if (!positivePresentation.begin || !positivePresentation.end) throw new Error('Expected actual Chrome async presentation span');
			const presentationNegativeControls = {
				missingCompletion: resolveTracePresentation(finalScreenshot, events.filter((event) => event !== positivePresentation.end)),
				duplicateCompletion: resolveTracePresentation(finalScreenshot, [...events, { ...positivePresentation.end }]),
				partialOnly: resolveTracePresentation(finalScreenshot, events.map((event) => event === positivePresentation.begin ?
					{ ...event, args: { ...event.args, frame_reporter: { ...(event.args?.frame_reporter as Record<string, unknown>), state: 'STATE_PRESENTED_PARTIAL' } } } : event)),
				ambiguousHost: resolveTracePresentation(finalScreenshot, [...events, { ...positivePresentation.begin, args: {
					frame_reporter: { ...(positivePresentation.begin.args?.frame_reporter as Record<string, unknown>), layer_tree_host_id: -1 }
				} }])
			};
			const gateEvidence = gate && {
				gate, requiredHoldMs: 500, inputSequence: rows.at(-1)!.sequence, inputTimeMs: rows.at(-1)!.inputTimeMs,
				installTimeMs: rows.at(-1)!.installTimeMs, overlayTimeMs: rows.at(-1)!.overlayTimeMs,
				screenshotEventTimeMs: rows.at(-1)!.screenshotEventTimeMs,
				traceReportedPresentationTimeMs: rows.at(-1)!.traceReportedPresentationTimeMs,
				overlaysBeforeRelease: ledger.records.filter((record) => record.name.startsWith('trace:overlay:') &&
					record.time >= gate.armedAtMs! && record.time < gate.releasedAtMs!).length,
				matchingImagesBeforeRelease: images.filter((image) => image.sequence === rows.at(-1)!.sequence &&
					image.previewPixelMatches && image.pageTimeMs !== null && image.pageTimeMs < gate.releasedAtMs!).length,
				matchingPresentationsBeforeRelease: images.filter((image) => image.sequence === rows.at(-1)!.sequence &&
					image.previewPixelMatches && image.tracePresentation?.pageTimeMs != null && image.tracePresentation.pageTimeMs < gate.releasedAtMs!).length,
				traceMarksMatch: ['arm', 'seal', 'release'].every((name) => {
					const marks = events.filter((event) => event.name === `biskiq:trace-gate:${name}`);
					const milestone = gate.events.find((event) => event.name === name);
					return marks.length === 1 && milestone !== undefined && Math.abs(clock.toPageMs(marks[0]!.ts) - milestone.timeMs) <= 1;
				})
			};
			const causalDelay = gateEvidence && { evidence: gateEvidence, verdict: controlledDelayVerdict(gateEvidence) };
			const longEvents = events.filter((event) => event.ph === 'X' && (event.dur ?? 0) >= 50000);
			const runtimeTrace = { eventCount: events.length, longEventCount: longEvents.length,
				longestEvents: [...longEvents].sort((a, b) => b.dur! - a.dur!).slice(0, 12).map((event) => ({ name: event.name, durationMs: event.dur! / 1000, pid: event.pid })),
				softwareDrawQuadCount: events.filter((event) => event.name === 'SoftwareRenderer::DoDrawQuad').length };
			const observation = { mode, runtimeBefore, runtimeAfter, runtimeTrace, causalDelay, workloadElapsedMs: end.pageTimeMs - begin.pageTimeMs,
				clock: { offsetMs: clock.offsetMs, spreadMs: clock.spreadMs, anchors: clock.anchors }, images, rows, records: ledger.records,
				screenshotConfiguration: { maxSize: 500, maxCount: 450, actualCount: images.length },
				frameEventNames: [...new Set(events.filter((event) => /Frame|Present|Pipeline/.test(event.name)).map((event) => event.name))],
				presentationNegativeControls,
				negativeControls: { mismatchedIdentityMatches: mismatched.filter((row) => row.frameIndex !== null).length,
					missingPreviewMatches: missingPreview.filter((row) => row.frameIndex !== null).length } };
			observations.push(observation);
			writeFileSync(join(modeDir, 'correlation.json'), JSON.stringify(observation, null, 2));
			expect(rows).toHaveLength(60);
			if (causalDelay) {
				expect(causalDelay.verdict.passed, JSON.stringify(causalDelay)).toBe(mode === 'gated-trace');
				if (mode === 'zero-hold-trace') expect(causalDelay.verdict.reasons).toContain('zeroed-or-short-requested-hold');
			}
			expect(rows.some((row) => row.status === 'trace-image-matched')).toBe(true);
			expect(rows.at(-1)?.status).toBe('trace-image-matched');
			expect(rows.at(-1)?.tracePresentationStatus).toBe('trace-reported-presented');
			for (const control of Object.values(presentationNegativeControls)) expect(control.traceTimeUs).toBeNull();
			expect(images.some((image) => image.sequence === rows.at(-1)?.sequence && image.previewPixelMatches &&
				image.compositorEvidence?.states.includes('STATE_PRESENTED_ALL'))).toBe(true);
			expect(mismatched.every((row) => row.frameIndex === null)).toBe(true);
			expect(missingPreview.every((row) => row.frameIndex === null)).toBe(true);
		} finally {
			try { if (stop) await stop(); } finally {
				try { await session.page.evaluate(() => {
					const target = window as Window & { __BISKIQ_TRACE_FRAME_GATE__?: TraceFrameGate; __BISKIQ_TRACE_RUNTIME__?: { dispose(): void } };
					target.__BISKIQ_TRACE_FRAME_GATE__?.dispose(); target.__BISKIQ_TRACE_RUNTIME__?.dispose();
				}); } finally { await session.close(); }
			}
			writeFileSync(join(directory, 'diagnostic.json'), JSON.stringify({
				...startReport('trace-proof'), browser: browser.version(), observations,
				limitations: [
					'Fresh isolated cold contexts, N0 loopback, 1920x1080@1, 60 moves, S fixture, 900ms final-preview hold; diagnostic only.',
					'The delayed-stream condition globally delays application rAF and may reduce unrelated rendering load; its retained observations are not compared against independent-context maxima. The causal gate condition holds all pending application callbacks, seals after final installation, observes at least500ms on the page clock, and proves exact preview/ALL feedback after explicit trace-confirmed release. A real zero-hold control must fail this causal oracle even if its rendering is slow.',
					'Trace, barcode, 24px diagnostic square at actual preview transform and extra marks add uncalibrated overhead. Elapsed values describe this pass; one sequential observation is not an overhead estimate or baseline.',
					'Image decode occurs after recording. Screenshot sampling can omit previews; overlay-not-captured is not proof of supersession or non-presentation.',
					'Screenshot event observation timestamps use two exact user-timing anchors; consumer/delivery latency may be included, so these are not exact image capture instants. Expected display time and source/frame identity remain raw evidence, never actual physical display presentation.',
					'Input latency uses normalized event.timeStamp; handler time retained separately. No image match means null latency, never zero.',
					'Trace-reported times are from exact nonforked ALL PipelineReporter completion using Chrome presentation feedback. They describe the earliest captured matching frame with unambiguous evidence; screenshot sampling cannot rule out an earlier uncaptured matching frame. Headless compositor imagery does not prove visible physical scanout. No hard presentation budget or owner acceptance follows.'
				]
			}, null, 2));
			console.log(`trace diagnostic artifacts: ${directory}`);
		}
	}
	// Independent cold-context maxima can invert under software rendering. They
	// remain raw observations, never the oracle for this controlled injection.
});

type GateWindow = Window & { __BISKIQ_TRACE_FRAME_GATE__?: TraceFrameGate; __BISKIQ_PERF_RECORDS__?: { kind: string; name: string; sequence: number }[] };
async function gatedDrag(page: import('@playwright/test').Page, holdMs: number): Promise<GateSnapshot> {
	const fixed = await handlePoint(page, 'Wall start'), start = await handlePoint(page, 'Wall end');
	const length = Math.hypot(start.x - fixed.x, start.y - fixed.y) || 1;
	await page.mouse.move(start.x, start.y); await page.mouse.down();
	await page.evaluate(() => (window as GateWindow).__BISKIQ_TRACE_FRAME_GATE__!.arm());
	for (let index = 1; index <= 60; index++) {
		await page.mouse.move(start.x + (start.x - fixed.x) / length * 6 * index / 60,
			start.y + (start.y - fixed.y) / length * 6 * index / 60);
	}
	const gate = await page.evaluate(async (holdMs) => {
		const target = window as GateWindow;
		const last = target.__BISKIQ_PERF_RECORDS__?.findLast((record) => record.kind === 'install' && record.name === 'wall-preview');
		if (!last) throw new Error('No real installed final preview to hold');
		target.__BISKIQ_TRACE_FRAME_GATE__!.seal(last.sequence);
		return target.__BISKIQ_TRACE_FRAME_GATE__!.releaseAfterHold(holdMs);
	}, holdMs);
	await page.waitForFunction(() => (window as GateWindow).__BISKIQ_PERF_RECORDS__?.some((record) =>
		record.name.startsWith('trace:overlay:60:')) === true);
	// Workload hold for trace sampling, not evidence: image identity/ALL is still required.
	await page.waitForTimeout(900); await page.mouse.up();
	return gate;
}

async function readRuntimeHealth(page: import('@playwright/test').Page): Promise<unknown> {
	return page.evaluate(() => (window as Window & { __BISKIQ_TRACE_RUNTIME__?: { read(): unknown } }).__BISKIQ_TRACE_RUNTIME__?.read() ?? null);
}
