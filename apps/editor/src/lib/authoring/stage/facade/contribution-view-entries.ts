import type { BoundAdapter } from './adapter-bindings';
import type {
	StageFindEntryRecord,
	StageInkReadingRecord,
	StageTaskEntry,
} from './adapter-contract';

type EntrySource = ReadonlyMap<string, BoundAdapter>;

/** Deterministic order: explicit `order`, then owning adapter ID, then entry ID. */
export function compareEntries(
	a: { readonly adapterId: string; readonly order: number; readonly id: string },
	b: { readonly adapterId: string; readonly order: number; readonly id: string },
): number {
	if (a.order !== b.order) return a.order - b.order;
	if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
	return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

export function tasksOf(adapters: EntrySource): readonly StageTaskEntry[] {
	return [...adapters.entries()]
		.flatMap(([adapterId, entry]) =>
			(entry.contributions.tasks ?? []).map((task) => ({
				...task,
				adapterId,
				order: task.order ?? 0,
			})),
		)
		.sort(compareEntries);
}

export function inkReadingsOf(adapters: EntrySource): readonly StageInkReadingRecord[] {
	return [...adapters.entries()]
		.flatMap(([adapterId, entry]) =>
			(entry.contributions.readings ?? []).map((reading) => ({
				id: reading.id,
				label: reading.label,
				summary: reading.summary,
				order: reading.order ?? 0,
				adapterId,
				...(reading.view === undefined ? {} : { view: reading.view }),
			})),
		)
		.sort(compareEntries);
}

export function findEntriesOf(adapters: EntrySource): readonly StageFindEntryRecord[] {
	return [...adapters.entries()]
		.flatMap(([adapterId, entry]) =>
			(entry.contributions.findEntries ?? []).map((findEntry) => ({
				...findEntry,
				adapterId,
				order: findEntry.order ?? 0,
			})),
		)
		.sort(compareEntries);
}
