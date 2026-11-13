/**
 * E5/G3 step 1 — **selection is a visibility decision over Paper's drawing**.
 *
 * Paper builds one drawing from the Plan (`buildPaperPlan`). A selection never
 * changes that drawing: the one subject a selection replaces is an Opening,
 * whose black symbol reads as the gold PaperMark instead. This module answers
 * the two read-only questions that let the built scene honour that:
 *
 * - **which source** the primary selection replaces (`paperHiddenSource`); and
 * - **where that source's ink lives** in a line batch (`paperSourceRuns`), as
 *   contiguous instance runs the scene can omit without rebuilding.
 *
 * It evaluates no Plan, projects nothing, batches nothing and allocates no
 * renderer resource. Plan assembly, GPU batches, fill geometry and outline union
 * stay with their existing owners.
 */
import type { PaperLineDraw } from './paper-plan';
import type { StageSelectionEntry } from './semantic-selection';

/** One contiguous run of a line batch's segment instances that one source owns. */
export type PaperSourceRun = {
	readonly sourceId: string;
	/** First segment instance in the batch. */
	readonly start: number;
	/** Segment instances the run covers; a `PaperLineDraw` owns one per segment. */
	readonly count: number;
};

/**
 * The Plan source whose own Paper ink the primary selection replaces.
 *
 * Only an Opening is re-stroked from nothing: its symbol is drawn once in
 * selection gold, so its black jambs, leaf and swing arc must not show through
 * the gold. Every other subject keeps its Paper ink under the mark (a Wall keeps
 * its poché and cut edge, a Room its floor tint, a Scene body its footprint).
 * A Scene selection is never a Layout source, so it returns null.
 */
export function paperHiddenSource(selection: StageSelectionEntry | null): string | null {
	if (
		selection?.reference.domain !== 'layout' ||
		selection.reference.subject.kind !== 'opening'
	) return null;
	return selection.reference.subject.id;
}

/**
 * The instance runs each source owns in one line batch, in batch order.
 *
 * A batch is the position buffer `createPaperScene` builds for one treatment and
 * dash state; each `PaperLineDraw` contributes one instance per segment, in
 * order. Adjacent lines of one source are one run, so hiding a source is a
 * bounded range operation rather than a rebuild. This says where the ink is, not
 * which ink to draw; the caller decides visibility.
 */
export function paperSourceRuns(lines: readonly PaperLineDraw[]): readonly PaperSourceRun[] {
	const runs: PaperSourceRun[] = [];
	let start = 0;
	for (const line of lines) {
		const count = line.segments.length;
		if (count === 0) continue;
		const last = runs[runs.length - 1];
		if (last !== undefined && last.sourceId === line.sourceId) {
			runs[runs.length - 1] = { sourceId: last.sourceId, start: last.start, count: last.count + count };
		} else {
			runs.push({ sourceId: line.sourceId, start, count });
		}
		start += count;
	}
	return runs;
}
