/** Chrome-reported presentation feedback, joined by frame and trace span identities.
 * cc/metrics/compositor_frame_reporter.cc ends PipelineReporter at termination;
 * compositor_frame_reporting_controller.cc supplies presentation_feedback.timestamp.
 * This remains browser-reported feedback, not independent physical scanout proof.
 */
import type { TraceEvent } from './trace-proof';

export type TracePresentation = {
	status: string;
	traceTimeUs: number | null;
	begin?: TraceEvent;
	end?: TraceEvent;
	layerTreeHostId?: number;
};

type Reporter = Record<string, unknown>;
const reporter = (event: TraceEvent) => event.args?.frame_reporter as Reporter | undefined;

function asyncKey(event: TraceEvent): string | null {
	if (event.id2?.global !== undefined) return JSON.stringify([event.name, event.cat, 'global', event.id2.global]);
	if (event.id2?.local !== undefined && typeof event.pid === 'number') {
		return JSON.stringify([event.name, event.cat, 'local', event.pid, event.id2.local]);
	}
	// Legacy unscoped IDs and synchronous B/E spans need different semantics.
	return null;
}

export function resolveTracePresentation(screenshot: TraceEvent, events: readonly TraceEvent[]): TracePresentation {
	const refused = (status: string): TracePresentation => ({ status, traceTimeUs: null });
	const source = screenshot.args?.source_id, frame = screenshot.args?.frame_sequence;
	if (typeof source !== 'number' || typeof frame !== 'number') return refused('unsupported-screenshot-frame-identity');
	const reports = events.filter((event) => event.name === 'PipelineReporter' &&
		(event.ph === 'b' || event.ph === 'X') && reporter(event)?.frame_source === source && reporter(event)?.frame_sequence === frame);
	if (!reports.length) return refused('missing-frame-reporter');
	const hosts = new Set(reports.map((event) => reporter(event)?.layer_tree_host_id));
	if ([...hosts].some((host) => typeof host !== 'number')) return refused('missing-layer-tree-host');
	if (hosts.size !== 1) return refused('ambiguous-layer-tree-host');
	const complete = reports.filter((event) => reporter(event)?.state === 'STATE_PRESENTED_ALL' && !reporter(event)?.frame_type);
	if (!complete.length) return refused('no-nonforked-ALL-reporter');
	if (complete.length !== 1) return refused('ambiguous-ALL-reporter');
	const begin = complete[0]!;
	if (reporter(begin)?.has_missing_content === true) return refused('reported-missing-content');
	const host = reporter(begin)!.layer_tree_host_id as number;
	if (begin.ph === 'X') {
		if (typeof begin.dur !== 'number' || !Number.isFinite(begin.dur) || begin.dur < 0) return refused('invalid-complete-span');
		return { status: 'trace-reported-presented', traceTimeUs: begin.ts + begin.dur, begin, layerTreeHostId: host };
	}
	const key = asyncKey(begin);
	if (!key) return refused('unsupported-async-span-identity');
	// IDs may be reused. Accept exactly one end in this ID lifetime and refuse
	// nesting/duplicate completions rather than choosing a nearby end timestamp.
	const lifetime = events.filter((event) => asyncKey(event) === key && event.ts >= begin.ts);
	const nextBegins = lifetime.filter((event) => event.ph === 'b' && event !== begin);
	const nextBeginUs = Math.min(Infinity, ...nextBegins.map((event) => event.ts));
	const ends = lifetime.filter((event) => event.ph === 'e' && event.ts < nextBeginUs);
	if (!ends.length) return refused('missing-async-span-completion');
	if (ends.length !== 1) return refused('ambiguous-async-span-completion');
	const end = ends[0]!;
	if (!Number.isFinite(end.ts) || end.ts < begin.ts) return refused('invalid-async-span-completion');
	return { status: 'trace-reported-presented', traceTimeUs: end.ts, begin, end, layerTreeHostId: host };
}
