/** Correlation used by the runner. Missing identities never fall back to an old mark. */
import type { LedgerRecord, PerfLedger } from './ledger';
import { MOVE_EDITOR_MS, SAMPLE_CAP, SAMPLE_FLOOR, SESSION_CAP, nextSession, presentedLimitMs, seriesStop, type SpotLabel, type SpotTier } from './spot-decision';

export type TimedOperation = {
	start: number | null; accepted: number | null; rendered: number | null; presented: number | null;
	operationId: string | null; sourceContentId: string | null;
	editorMs: number | null; renderedMs: number | null; presentedMs: number | null;
};

export function throughRender(ledger: PerfLedger, start: LedgerRecord | undefined, accepted: LedgerRecord | undefined): TimedOperation {
	const source = accepted?.detail?.sourceContentId;
	const valid = start !== undefined && accepted !== undefined && accepted.time >= start.time && typeof source === 'string';
	const frame = valid ? ledger.renderFrames.find((frame) => frame.surface === 'stage' && frame.sourceContentId === source && frame.start >= accepted.time && frame.triangles > 0) : undefined;
	const presented = frame === undefined ? null : ledger.ticks.find((tick) => tick >= frame.end) ?? null;
	return {
		start: start?.time ?? null, accepted: valid ? accepted.time : null,
		rendered: frame?.end ?? null, presented,
		operationId: typeof start?.detail?.operationId === 'string' ? start.detail.operationId : null,
		sourceContentId: valid ? source : null,
		editorMs: valid ? accepted.time - start.time : null,
		renderedMs: frame && start ? frame.end - start.time : null,
		presentedMs: presented !== null && start ? presented - start.time : null
	};
}

export function typedLengthTiming(ledger: PerfLedger, dispatched: number, wallId: string): TimedOperation {
	const starts = ledger.records.filter((record) => record.name === 'command:instrument' && record.time >= dispatched && record.detail?.taskKind === 'layout-wall-length' && record.detail.wallId === wallId && typeof record.detail.operationId === 'string');
	// More than one candidate is ambiguous, not a license to choose the fastest/latest.
	const start = starts.length === 1 ? starts[0] : undefined;
	const accepted = start === undefined ? undefined : ledger.records.find((record) => record.kind === 'result' && record.name === 'accepted-result' && record.detail?.operationId === start.detail?.operationId);
	return throughRender(ledger, start, accepted);
}

export function openTiming(ledger: PerfLedger, dispatched: number): TimedOperation {
	const start = ledger.records.find((record) => record.name === 'f2:open-requested' && record.time >= dispatched);
	const accepted = start === undefined ? undefined : ledger.records.find((record) => record.name === 'f2:open-admitted' && record.time >= start.time);
	return throughRender(ledger, start, accepted);
}

export type GestureObservation = {
	editorMs: number | null; presentedMs: number | null; automationMs: number | null;
	[key: string]: unknown;
};

/** One gesture, append-only; an attempt counts against the cap even if its instrumentation is missing. */
export async function collectGesture<T extends GestureObservation>(tier: SpotTier, refreshMs: number, sample: (index: number) => Promise<T>): Promise<T[]> {
	const observations: T[] = [];
	while (observations.length < SAMPLE_CAP) {
		observations.push(await sample(observations.length));
		if (observations.length < SAMPLE_FLOOR) continue;
		if (observations.some((row) => row.editorMs === null || row.presentedMs === null)) break;
		const editor = seriesStop(observations.map((row) => row.editorMs!), MOVE_EDITOR_MS[tier]);
		const presented = seriesStop(observations.map((row) => row.presentedMs!), presentedLimitMs(tier, refreshMs));
		// A clear miss already decides this gesture; do not dilute it with more moves.
		if (editor.classification === 'over' || presented.classification === 'over') break;
		if (editor.action === 'stop' && presented.action === 'stop') break;
	}
	return observations;
}

export function pickIdentity(mark: LedgerRecord | undefined, expectedId: string): boolean | null {
	if (mark === undefined || typeof mark.detail?.outcome !== 'string') return null;
	return mark.detail.outcome === 'resolved' && mark.detail.sourceKind === 'wall' && mark.detail.sourceId === expectedId;
}

/** A conservative summary; every session is still reported individually. */
export function sessionLabel(labels: readonly SpotLabel[]): SpotLabel {
	const order: SpotLabel[] = ['smooth', 'usable', 'not-smooth', 'not-usable', 'incomplete'];
	return labels.reduce((worst, label) => order.indexOf(label) > order.indexOf(worst) ? label : worst, labels[0] ?? 'incomplete');
}

export function previewProvenance(runnerRevision: string, runnerDirty: boolean, previewVersions: readonly (string | null)[]) {
	const versions = [...new Set(previewVersions)];
	const verified = !runnerDirty && /^[a-f0-9]{40}$/.test(runnerRevision) && versions.length === 1 && versions[0] === runnerRevision;
	return { status: verified ? 'verified' as const : 'unverified' as const, runnerRevision, runnerDirty, previewVersions: versions, revision: verified ? runnerRevision : null };
}

/** Session orchestration is append-only too; no last-session replacement. */
export async function collectSessions<T extends { label: SpotLabel; onTheLine: boolean }>(measure: (index: number) => Promise<T | null>) {
	const sessions: (T & { sessionRequest: ReturnType<typeof nextSession> })[] = [];
	while (sessions.length < SESSION_CAP) {
		const measured = await measure(sessions.length);
		if (measured === null) break;
		const previous = sessions.at(-1);
		const sessionRequest = nextSession({ sessionsSoFar: sessions.length + 1,
			onTheLine: measured.label !== 'incomplete' && measured.onTheLine,
			labelsDisagree: previous !== undefined && previous.label !== measured.label });
		sessions.push({ ...measured, sessionRequest });
		if (!sessionRequest.another) break;
	}
	return sessions;
}
