import type { StageLens } from './stage-session';

/** The Stage session owns the writer; composed views observe its canonical read. */
export function createStageSessionLens() {
	let lens = $state<StageLens>('world');
	return {
		read: () => lens,
		write: (next: StageLens) => { lens = next; }
	};
}
