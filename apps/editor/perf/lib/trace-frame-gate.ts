/** Harness-only frame hold. Install before application startup; arm only after setup.
 * Native callbacks already pending at arm are cancelled and retained, not allowed
 * to slip through. The trace/page clock and input dispatch keep running.
 */
export type GateEvent = { name: string; timeMs: number; sequence?: number; pending?: number; requestedHoldMs?: number };
export type GateSnapshot = {
	armedAtMs: number | null; sealedAtMs: number | null; releasedAtMs: number | null;
	sequence: number | null; requestedHoldMs: number | null; pending: number;
	pendingAtArm: number; cancelled: number; callbacksRun: number; events: GateEvent[];
};
export type TraceFrameGate = {
	arm(): GateSnapshot;
	seal(sequence: number): GateSnapshot;
	releaseAfterHold(milliseconds: number): Promise<GateSnapshot>;
	snapshot(): GateSnapshot;
	dispose(): void;
};
export type FrameGateHost = {
	requestAnimationFrame: (callback: FrameRequestCallback) => number;
	cancelAnimationFrame: (handle: number) => void;
	performance: Pick<Performance, 'now' | 'mark'>;
	setTimeout: (callback: () => void, delay: number) => number;
	clearTimeout: (handle: number) => void;
	__BISKIQ_TRACE_FRAME_GATE__?: TraceFrameGate;
};

/** Serialized by Playwright: deliberately self-contained, with no module closure. */
export function installTraceFrameGate(host: FrameGateHost = window as unknown as FrameGateHost): void {
	if (host.__BISKIQ_TRACE_FRAME_GATE__) throw new Error('Trace frame gate already installed');
	const originalRequest = host.requestAnimationFrame, originalCancel = host.cancelAnimationFrame;
	const nativeRequest = originalRequest.bind(host), nativeCancel = originalCancel.bind(host);
	const pending = new Map<number, { callback: FrameRequestCallback; native: number | null }>();
	let nextHandle = 1, held = false, disposed = false, timer: number | null = null;
	let releaseReject: ((error: Error) => void) | null = null;
	const state: GateSnapshot = { armedAtMs: null, sealedAtMs: null, releasedAtMs: null, sequence: null,
		requestedHoldMs: null, pending: 0, pendingAtArm: 0, cancelled: 0, callbacksRun: 0, events: [] };
	const snapshot = (): GateSnapshot => ({ ...state, pending: pending.size, events: state.events.map((event) => ({ ...event })) });
	const mark = (name: string, extra: Omit<GateEvent, 'name' | 'timeMs'> = {}) => {
		const timeMs = host.performance.now();
		state.events.push({ name, timeMs, ...extra });
		host.performance.mark(`biskiq:trace-gate:${name}`, { startTime: timeMs, detail: extra });
		return timeMs;
	};
	const schedule = (handle: number) => {
		const entry = pending.get(handle);
		if (!entry || held || disposed) return;
		entry.native = nativeRequest((timestamp) => {
			entry.native = null;
			if (!pending.has(handle) || disposed || held) return;
			pending.delete(handle);
			state.callbacksRun++;
			entry.callback(timestamp);
		});
	};
	const request = (callback: FrameRequestCallback) => {
		if (disposed) throw new Error('Trace frame gate disposed');
		const handle = nextHandle++;
		pending.set(handle, { callback, native: null });
		schedule(handle);
		return handle;
	};
	const cancel = (handle: number) => {
		const entry = pending.get(handle);
		if (!entry) return;
		if (entry.native !== null) nativeCancel(entry.native);
		pending.delete(handle);
		state.cancelled++;
	};
	host.requestAnimationFrame = request;
	host.cancelAnimationFrame = cancel;
	host.__BISKIQ_TRACE_FRAME_GATE__ = {
		snapshot,
		arm() {
			if (disposed || state.armedAtMs !== null) throw new Error('Trace frame gate cannot arm twice');
			held = true;
			state.pendingAtArm = pending.size;
			for (const entry of pending.values()) {
				if (entry.native !== null) nativeCancel(entry.native);
				entry.native = null;
			}
			state.armedAtMs = mark('arm', { pending: pending.size });
			return snapshot();
		},
		seal(sequence) {
			if (!held || disposed || state.sealedAtMs !== null) throw new Error('Trace frame gate is not awaiting final input');
			state.sequence = sequence;
			state.sealedAtMs = mark('seal', { sequence, pending: pending.size });
			return snapshot();
		},
		releaseAfterHold(milliseconds) {
			if (!held || disposed || state.sealedAtMs === null || state.requestedHoldMs !== null || !Number.isFinite(milliseconds) || milliseconds < 0) {
				return Promise.reject(new Error('Trace frame gate requires one valid sealed hold'));
			}
			state.requestedHoldMs = milliseconds;
			return new Promise<GateSnapshot>((resolve, reject) => {
				releaseReject = reject;
				const release = () => {
					const remaining = state.sealedAtMs! + milliseconds - host.performance.now();
					if (remaining > 0) { timer = host.setTimeout(release, Math.max(1, remaining)); return; }
					timer = null;
					state.releasedAtMs = mark('release', { sequence: state.sequence!, requestedHoldMs: milliseconds, pending: pending.size });
					held = false;
					for (const handle of pending.keys()) schedule(handle);
					releaseReject = null;
					resolve(snapshot());
				};
				timer = host.setTimeout(release, milliseconds);
			});
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (timer !== null) host.clearTimeout(timer);
			releaseReject?.(new Error('Trace frame gate disposed before release'));
			releaseReject = null;
			for (const entry of pending.values()) if (entry.native !== null) nativeCancel(entry.native);
			pending.clear();
			if (host.requestAnimationFrame === request) host.requestAnimationFrame = originalRequest;
			if (host.cancelAnimationFrame === cancel) host.cancelAnimationFrame = originalCancel;
			delete host.__BISKIQ_TRACE_FRAME_GATE__;
		}
	};
}

export type ControlledDelayEvidence = {
	gate: GateSnapshot; requiredHoldMs: number; inputSequence: number;
	inputTimeMs: number; installTimeMs: number | null; overlayTimeMs: number | null;
	screenshotEventTimeMs: number | null; traceReportedPresentationTimeMs: number | null;
	overlaysBeforeRelease: number; matchingImagesBeforeRelease: number; matchingPresentationsBeforeRelease: number; traceMarksMatch: boolean;
};

/** Causal oracle: independent of ordinary-run outliers or relative distributions. */
export function controlledDelayVerdict(evidence: ControlledDelayEvidence): { passed: boolean; reasons: string[]; heldMs: number | null } {
	const { gate, requiredHoldMs, inputSequence, inputTimeMs, installTimeMs, overlayTimeMs,
		screenshotEventTimeMs, traceReportedPresentationTimeMs } = evidence;
	const reasons: string[] = [];
	const fail = (condition: boolean, reason: string) => { if (!condition) reasons.push(reason); };
	fail(gate.armedAtMs !== null && gate.sealedAtMs !== null && gate.releasedAtMs !== null, 'missing-arm-seal-or-release');
	fail(gate.sequence === inputSequence, 'wrong-final-input-sequence');
	fail(gate.pendingAtArm > 0 && gate.pending > 0, 'no-held-pending-frame');
	fail(gate.requestedHoldMs !== null && gate.requestedHoldMs >= requiredHoldMs, 'zeroed-or-short-requested-hold');
	const heldMs = gate.sealedAtMs === null || gate.releasedAtMs === null ? null : gate.releasedAtMs - gate.sealedAtMs;
	fail(heldMs !== null && heldMs >= requiredHoldMs, 'missing-or-short-observed-hold');
	fail(installTimeMs !== null && gate.armedAtMs !== null && gate.sealedAtMs !== null &&
		gate.armedAtMs <= inputTimeMs && inputTimeMs <= installTimeMs && installTimeMs <= gate.sealedAtMs, 'final-input-install-not-inside-gate');
	fail(evidence.overlaysBeforeRelease === 0, 'preview-bypassed-held-frame');
	fail(evidence.matchingImagesBeforeRelease === 0, 'matching-image-before-release');
	fail(evidence.matchingPresentationsBeforeRelease === 0, 'matching-presentation-before-release');
	fail(evidence.traceMarksMatch, 'gate-milestones-not-confirmed-in-trace');
	for (const [name, time] of [['overlay', overlayTimeMs], ['screenshot-event', screenshotEventTimeMs], ['trace-presentation', traceReportedPresentationTimeMs]] as const) {
		fail(time !== null && gate.releasedAtMs !== null && time >= gate.releasedAtMs, `${name}-missing-or-before-release`);
	}
	fail(traceReportedPresentationTimeMs !== null && traceReportedPresentationTimeMs - inputTimeMs >= requiredHoldMs, 'held-interval-missing-from-delivered-latency');
	return { passed: reasons.length === 0, reasons, heldMs };
}
