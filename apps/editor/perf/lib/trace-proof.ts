/** Chrome trace image identity proof; deliberately separate from timing baselines.
 * Schema: ChromeDevTools/devtools-frontend models/trace/types/TraceEvents.ts.
 * Screenshot.ts observes OnFrameFromVideoConsumer after bitmap acquisition. It
 * can include consumer/delivery latency; it is neither exact image capture nor
 * physical display time.
 */
import type { CDPSession, Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { LedgerRecord } from './ledger';
import { resolveTracePresentation, type TracePresentation } from './trace-presentation';

export type TraceEvent = { name: string; ts: number; cat?: string; ph?: string; pid?: number; tid?: number; args?: Record<string, unknown>; dur?: number; id2?: { local?: string | number; global?: string | number } };
export type TraceImage = {
	index: number; traceTimeUs: number; pageTimeMs: number | null; timingIssue?: string; sequence: number | null;
	signature: number | null; previewPixelMatches: boolean; sourceId: unknown;
	tracePresentation?: TracePresentation & { pageTimeMs: number | null };
	frameSequence: unknown; expectedDisplayTime: unknown; imagePath: string; compositorEvidence?: { states: string[]; layerTreeHostIds: unknown[]; matchingReports: unknown[] }; width?: number; height?: number;
};
export type OverlayRect = { x: number; y: number; width: number; viewportWidth: number };
export type ClockAnchor = { name: string; pageTimeMs: number };

export async function clockAnchor(page: Page, name: string): Promise<ClockAnchor> {
	return page.evaluate((name) => {
		const pageTimeMs = performance.now();
		performance.mark(name, { startTime: pageTimeMs });
		return { name, pageTimeMs };
	}, name);
}

export function normalizeTraceClock(events: readonly TraceEvent[], anchors: readonly ClockAnchor[]) {
	const offsets = anchors.map((anchor) => {
		const found = events.filter((event) => event.name === anchor.name);
		if (found.length !== 1) throw new Error(`Expected one trace anchor ${anchor.name}, got ${found.length}`);
		return found[0]!.ts / 1000 - anchor.pageTimeMs;
	});
	if (offsets.length < 2) throw new Error('Two clock anchors required');
	const spreadMs = Math.max(...offsets) - Math.min(...offsets);
	if (spreadMs > 1) throw new Error(`Trace/page clock discrepancy ${spreadMs}ms`);
	const offsetMs = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
	return { offsetMs, spreadMs, anchors, toPageMs: (traceTimeUs: number) => traceTimeUs / 1000 - offsetMs };
}

export async function startChromeTrace(cdp: CDPSession): Promise<() => Promise<TraceEvent[]>> {
	const events: TraceEvent[] = [];
	const onData = (event: { value: object[] }) => {
		for (const entry of event.value) {
			if ('name' in entry && typeof entry.name === 'string' && 'ts' in entry && typeof entry.ts === 'number') {
				events.push(entry as TraceEvent);
			}
		}
	};
	cdp.on('Tracing.dataCollected', onData);
	try { await cdp.send('Tracing.start', {
		categories: 'blink.user_timing,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.screenshot,cc,viz,benchmark',
		transferMode: 'ReportEvents', options: 'record-as-much-as-possible', screenshotMaxSize: 500, screenshotMaxCount: 450
	}); } catch (error) { cdp.off('Tracing.dataCollected', onData); throw error; }
	return async () => {
		try {
			const complete = new Promise<{ dataLossOccurred?: boolean }>((resolve) => cdp.once('Tracing.tracingComplete', resolve));
			await cdp.send('Tracing.end');
			if ((await complete).dataLossOccurred) throw new Error('Chrome trace buffer lost data');
			return events;
		} finally { cdp.off('Tracing.dataCollected', onData); }
	};
}

/** Decode only the 8x8 identity grid; ambiguous pixels/checksums are rejected. */
export function decodeGrid(values: readonly number[]): { sequence: number; signature: number } | null {
	if (values.length !== 64 || values.some((value) => value > 70 && value < 185)) return null;
	const words = Array.from({ length: 4 }, (_, word) => values.slice(word * 16, word * 16 + 16)
		.reduce((value, pixel) => value * 2 + (pixel < 128 ? 1 : 0), 0));
	if (words[0] !== 0xb17e || words[1] === 0 || (words[0]! ^ words[1]! ^ words[2]!) !== words[3]) return null;
	return { sequence: words[1]!, signature: words[2]! };
}

/** JPEG decoding happens AFTER trace recording ends, never on the measured page. */
export async function decodeTraceImages(
	events: readonly TraceEvent[], records: readonly LedgerRecord[], rect: OverlayRect,
	clock: ReturnType<typeof normalizeTraceClock>, directory: string
): Promise<TraceImage[]> {
	// Already pinned by @gltf-transform/cli in the workspace lockfile.
	const { default: sharp } = await import('sharp');
	const images: TraceImage[] = [];
	for (const event of events.filter((event) => event.name === 'Screenshot' && typeof event.args?.snapshot === 'string')) {
		const modernClock = typeof event.args?.source_id === 'number' && typeof event.args?.frame_sequence === 'number';
		const bytes = Buffer.from(event.args!.snapshot as string, 'base64');
		const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
		const scale = info.width / rect.viewportWidth;
		const rgb = (x: number, y: number) => {
			const px = Math.round(x * scale), py = Math.round(y * scale);
			if (px < 0 || py < 0 || px >= info.width || py >= info.height) return [128, 128, 128];
			const at = (py * info.width + px) * info.channels;
			return [data[at]!, data[at + 1]!, data[at + 2]!];
		};
		const identity = decodeGrid(Array.from({ length: 64 }, (_, index) => {
			const color = rgb(rect.x + 8 + (index % 8) * 16 + 8, rect.y + 8 + Math.floor(index / 8) * 16 + 8);
			return color.reduce((sum, value) => sum + value, 0) / 3;
		}));
		const overlay = identity && records.find((record) => record.name === `trace:overlay:${identity.sequence}:${identity.signature}` &&
			events.some((event) => event.name === `biskiq:mark:${record.name}`));
		const css = overlay?.detail?.css as [number, number] | undefined;
		const color = css && rgb(rect.x + css[0], rect.y + css[1]);
		const previewPixelMatches = !!color && color[0]! > 160 && color[1]! < 100 && color[2]! > 140;
		const compositorEvidence = compositorEvidenceForImage(event, events);
		const presentation = resolveTracePresentation(event, events);
		const tracePresentation = { ...presentation, pageTimeMs: presentation.traceTimeUs === null ? null : clock.toPageMs(presentation.traceTimeUs) };
		const imagePath = `${directory}/frame-${images.length}.jpg`;
		writeFileSync(imagePath, new Uint8Array(bytes));
		images.push({ index: images.length, traceTimeUs: event.ts, pageTimeMs: modernClock ? clock.toPageMs(event.ts) : null,
			...(modernClock ? {} : { timingIssue: 'legacy-or-unknown-screenshot-clock: timestamp unsupported' }),
			sequence: identity?.sequence ?? null, signature: identity?.signature ?? null, previewPixelMatches,
			sourceId: event.args?.source_id ?? null, frameSequence: event.args?.frame_sequence ?? null,
			expectedDisplayTime: event.args?.expected_display_time ?? null, imagePath, compositorEvidence, tracePresentation, width: info.width, height: info.height });
	}
	return images;
}

export function correlateTraceInputs(records: readonly LedgerRecord[], images: readonly TraceImage[]) {
	const inputs = records.filter((record) => record.kind === 'input' && record.name === 'pointermove');
	const overlays = records.filter((record) => record.name.startsWith('trace:overlay:'));
	const highestOverlay = Math.max(0, ...overlays.map((record) => record.sequence));
	return inputs.map((input) => {
		const raw = input.detail?.eventTimeStamp;
		const inputTimeMs = normalizedInputTime(input);
		const install = records.find((record) => record.kind === 'install' && record.name === 'wall-preview' && record.sequence === input.sequence);
		const overlay = overlays.find((record) => record.sequence === input.sequence);
		// Exact visual identity + matching preview pixel + causal order; NEVER nearest timestamp.
		const matchingImages = install && overlay ? images.filter((candidate) => candidate.sequence === input.sequence &&
			candidate.signature === overlay.detail?.signature && candidate.previewPixelMatches) : [];
		const image = matchingImages.filter((candidate) => candidate.pageTimeMs !== null && candidate.pageTimeMs >= overlay!.time)
			.sort((a, b) => a.pageTimeMs! - b.pageTimeMs!)[0];
		// Select the earliest captured matching frame with an unambiguous ALL
		// completion. Screenshot sampling cannot prove no earlier frame existed.
		const presentedImage = matchingImages.filter((candidate) => candidate.tracePresentation?.pageTimeMs != null &&
			candidate.tracePresentation.pageTimeMs >= overlay!.time)
			.sort((a, b) => a.tracePresentation!.pageTimeMs! - b.tracePresentation!.pageTimeMs!)[0];
		const presentedTime = presentedImage?.tracePresentation?.pageTimeMs ?? null;
		const latestAtPresentation = presentedTime === null ? null : inputs.filter((candidate) => normalizedInputTime(candidate) <= presentedTime).at(-1);
		const unsupportedImage = matchingImages.find((candidate) => candidate.pageTimeMs === null);
		const refused = records.some((record) => record.name === 'wall-preview:refused' && record.sequence === input.sequence);
		const status = image ? 'trace-image-matched' : unsupportedImage ? 'trace-image-identity-only' : refused ? 'refused' : overlay ? 'overlay-not-captured' :
			input.sequence < highestOverlay ? 'superseded-before-overlay' : install ? 'installed-not-rendered' : 'unresolved';
		const newestInput = image && inputs.filter((candidate) => normalizedInputTime(candidate) <= image.pageTimeMs!).at(-1);
		return { sequence: input.sequence, inputTimeMs, handlerTimeMs: input.time,
			inputClock: typeof raw === 'number' ? 'normalized-event.timeStamp' : 'handler-fallback',
			installTimeMs: install?.time ?? null, overlayTimeMs: overlay?.time ?? null,
			status, frameIndex: image?.index ?? unsupportedImage?.index ?? null,
			imageClockReason: image ? 'modern-screenshot-trace-event-time' : unsupportedImage?.timingIssue ?? null, screenshotEventTimeMs: image?.pageTimeMs ?? null,
			inputToScreenshotEventMs: image ? image.pageTimeMs! - inputTimeMs : null,
			latestInputAgeAtScreenshotEventMs: image && newestInput ? image.pageTimeMs! - normalizedInputTime(newestInput) : null,
			traceReportedPresentationTimeMs: presentedTime,
			inputToTraceReportedPresentationMs: presentedTime === null ? null : presentedTime - inputTimeMs,
			latestInputAgeAtTraceReportedPresentationMs: presentedTime !== null && latestAtPresentation ? presentedTime - normalizedInputTime(latestAtPresentation) : null,
			tracePresentedFrameIndex: presentedImage?.index ?? null,
			tracePresentationStatus: presentedImage ? 'trace-reported-presented' : image?.tracePresentation?.status ?? 'no-supported-matching-image',
			physicalDisplayPresentationMs: null };
	});
}


/** Exact compositor frame identity only; no temporal proximity or physical-time inference. */
export function compositorEvidenceForImage(event: TraceEvent, events: readonly TraceEvent[]) {
	if (typeof event.args?.source_id !== 'number' || typeof event.args?.frame_sequence !== 'number') {
		return { states: [] as string[], layerTreeHostIds: [] as unknown[], matchingReports: [] as TraceEvent[] };
	}
	const reports = events.filter((candidate) => {
		const reporter = candidate.args?.frame_reporter as Record<string, unknown> | undefined;
		return candidate.name === 'PipelineReporter' && reporter?.frame_source === event.args?.source_id &&
		reporter?.frame_sequence === event.args?.frame_sequence;
	});
	return {
		states: [...new Set(reports.map((report) => String((report.args?.frame_reporter as Record<string, unknown>).state)))],
		layerTreeHostIds: [...new Set(reports.map((report) => (report.args?.frame_reporter as Record<string, unknown>).layer_tree_host_id))],
		matchingReports: reports
	};
}

function normalizedInputTime(input: LedgerRecord): number {
	const raw = input.detail?.eventTimeStamp;
	const origin = input.detail?.timeOrigin;
	return typeof raw === 'number' && Number.isFinite(raw)
		? (raw > 1e12 && typeof origin === 'number' ? raw - origin : raw) : input.time;
}
