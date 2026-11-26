/**
 * The contributed Ink reading selected by one adapter binding.
 *
 * The contributing binding owns its session; this sub-owner only resolves the
 * selected record and opens or cancels the session against the current binding.
 */
import type { StageInkReadingRecord, StageInkReadingSession } from '$lib/authoring/stage/stage-adapter-host';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

export type ContributedInkReader = {
	readonly reading: () => StageInkReadingRecord | null;
	readonly ensure: () => StageInkReadingSession | null;
	readonly current: () => StageInkReadingSession | null;
	readonly end: () => void;
};

export function createContributedInkReader(input: {
	readonly services: StageAdapterServices;
	readonly readingId: () => string;
}): ContributedInkReader {
	let session: { readonly readingId: string; readonly session: StageInkReadingSession } | null = null;
	const reading = (): StageInkReadingRecord | null => {
		const id = input.readingId();
		if (id === 'wall' || id === 'opening' || id === 'room' || id === 'terrace' || id === 'roof') {
			return null;
		}
		return input.services.stage.inkReadings().find((candidate) => candidate.id === id) ?? null;
	};
	const end = (): void => {
		const current = session;
		session = null;
		current?.session.cancel();
	};
	const ensure = (): StageInkReadingSession | null => {
		const selected = reading();
		if (selected === null) return null;
		if (session?.readingId === selected.id) return session.session;
		end();
		const opened = input.services.stage.openInkReading(selected.id, selected.adapterId);
		if (opened === null) return null;
		session = { readingId: opened.reading.id, session: opened.session };
		return opened.session;
	};
	return { reading, ensure, current: () => session?.session ?? null, end };
}
