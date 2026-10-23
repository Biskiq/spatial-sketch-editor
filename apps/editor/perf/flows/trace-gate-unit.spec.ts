import { expect, test } from '@playwright/test';
import { controlledDelayVerdict, installTraceFrameGate, type ControlledDelayEvidence, type FrameGateHost } from '../lib/trace-frame-gate';

function fakeBrowser() {
	let time = 0, next = 1;
	const frames = new Map<number, FrameRequestCallback>();
	const timers = new Map<number, { at: number; callback: () => void }>();
	const host: FrameGateHost = {
		requestAnimationFrame(callback) { const id = next++; frames.set(id, callback); return id; },
		cancelAnimationFrame(id) { frames.delete(id); },
		performance: { now: () => time, mark: (name, options) => performance.mark(name, options) },
		setTimeout(callback, delay) { const id = next++; timers.set(id, { at: time + delay, callback }); return id; },
		clearTimeout(id) { timers.delete(id); }
	};
	return { host, frames, timers,
		advance(to: number) {
			time = to;
			for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); }
		},
		frame(to: number) { time = to; const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(to); }
	};
}

test('gate captures native callbacks already pending at arm and preserves cancellation and release clock', async () => {
	const browser = fakeBrowser();
	const request = browser.host.requestAnimationFrame, cancel = browser.host.cancelAnimationFrame;
	installTraceFrameGate(browser.host);
	const calls: number[] = [];
	browser.host.requestAnimationFrame((time) => calls.push(time));
	expect(browser.frames.size).toBe(1);
	const gate = browser.host.__BISKIQ_TRACE_FRAME_GATE__!;
	expect(gate.arm().pendingAtArm).toBe(1);
	expect(browser.frames.size).toBe(0);
	const cancelled = browser.host.requestAnimationFrame(() => { throw new Error('Cancelled callback ran'); });
	browser.host.cancelAnimationFrame(cancelled);
	gate.seal(60);
	const release = gate.releaseAfterHold(500);
	browser.advance(499); browser.frame(499);
	expect(calls).toEqual([]);
	browser.advance(500);
	const snapshot = await release;
	expect(snapshot.releasedAtMs! - snapshot.sealedAtMs!).toBe(500);
	expect(snapshot.pending).toBe(1);
	browser.frame(501); browser.frame(502);
	expect(calls).toEqual([501]);
	gate.dispose();
	expect(browser.host.requestAnimationFrame).toBe(request);
	expect(browser.host.cancelAnimationFrame).toBe(cancel);
	expect(browser.host.__BISKIQ_TRACE_FRAME_GATE__).toBeUndefined();
});

test('gate disposal cancels pending frames and hold timer and rejects an unfinished release', async () => {
	const browser = fakeBrowser(); installTraceFrameGate(browser.host);
	browser.host.requestAnimationFrame(() => { throw new Error('Disposed callback ran'); });
	const gate = browser.host.__BISKIQ_TRACE_FRAME_GATE__!;
	gate.arm(); gate.seal(60);
	const release = gate.releaseAfterHold(500);
	gate.dispose();
	await expect(release).rejects.toThrow('disposed before release');
	browser.advance(1000); browser.frame(1000);
	expect(browser.timers.size).toBe(0);
	expect(browser.frames.size).toBe(0);
});

function positiveEvidence(): ControlledDelayEvidence {
	return { gate: { armedAtMs: 100, sealedAtMs: 200, releasedAtMs: 700, sequence: 60, requestedHoldMs: 500,
		pending: 2, pendingAtArm: 2, cancelled: 0, callbacksRun: 10, events: [] },
		requiredHoldMs: 500, inputSequence: 60, inputTimeMs: 180, installTimeMs: 190,
		overlayTimeMs: 710, screenshotEventTimeMs: 720, traceReportedPresentationTimeMs: 730,
		overlaysBeforeRelease: 0, matchingImagesBeforeRelease: 0, matchingPresentationsBeforeRelease: 0, traceMarksMatch: true };
}

test('causal oracle accepts an observed hold even when unrelated baseline maxima are much larger', () => {
	const evidence = positiveEvidence(), unrelatedBaselineMaximum = 1200;
	expect(evidence.traceReportedPresentationTimeMs! - evidence.inputTimeMs).toBeLessThan(unrelatedBaselineMaximum);
	expect(controlledDelayVerdict(evidence)).toEqual({ passed: true, reasons: [], heldMs: 500 });
});

test('missing/early release, bypassed imagery and zeroed delay fail despite arbitrarily slow delivered latency', () => {
	const evidence = { ...positiveEvidence(), screenshotEventTimeMs: 10000, traceReportedPresentationTimeMs: 11000 };
	const controls: ControlledDelayEvidence[] = [
		{ ...evidence, gate: { ...evidence.gate, releasedAtMs: null } },
		{ ...evidence, gate: { ...evidence.gate, releasedAtMs: 699 } },
		{ ...evidence, gate: { ...evidence.gate, requestedHoldMs: 0 } },
		{ ...evidence, overlaysBeforeRelease: 1 },
		{ ...evidence, matchingImagesBeforeRelease: 1 },
		{ ...evidence, matchingPresentationsBeforeRelease: 1 },
		{ ...evidence, traceMarksMatch: false },
		{ ...evidence, gate: { ...evidence.gate, pendingAtArm: 0 } }
	];
	for (const control of controls) expect(controlledDelayVerdict(control).passed).toBe(false);
});
