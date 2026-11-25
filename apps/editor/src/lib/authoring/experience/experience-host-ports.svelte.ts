/**
 * Experience's host reads: what the rest of the host may know about Experience
 * without reaching into the binding. The shown Card is the Card's Experience
 * projection, the floor datum is the one admitted datum, the cursor port is the
 * two precedence reads `stageCursor` consumes, and the Look-through session is
 * the frame effect's input.
 */
import type { StageExperienceBinding } from '../stage/route/stage-experience-binding.svelte';
import type { StageSelectionEntry } from '../stage/semantic-selection';
import type { ExperienceShownCard } from './experience-card-wiring';

export type ExperienceHostPortsDeps = {
	readonly binding: StageExperienceBinding;
	readonly services: () => unknown;
	readonly selection: () => StageSelectionEntry | null;
	readonly cardIdentity: () => { readonly sourceId: string; readonly label: string; readonly kind: string; readonly status: string } | null;
	readonly bring: () => void;
	readonly selectStageReference: (reference: StageSelectionEntry['reference']) => void;
	readonly referenceLabel: (reference: StageSelectionEntry['reference']) => string | null;
	readonly datumMeters: () => number;
};

export function createExperienceHostPorts(deps: ExperienceHostPortsDeps) {
	const shownCard = $derived.by((): ExperienceShownCard => deps.binding.cardView({
		services: deps.services(),
		selection: deps.selection(),
		sceneSubject: deps.binding.sceneSubject,
		cardIdentity: deps.cardIdentity(),
		bring: deps.bring,
		selectStageReference: deps.selectStageReference,
		referenceLabel: deps.referenceLabel
	}));
	const floorDatum = $derived(deps.datumMeters());
	return {
		get shownCard() {
			return shownCard;
		},
		get floorDatum() {
			return floorDatum;
		},
		/** The two precedence reads `readStageCursor` takes from Experience. */
		cursor: {
			viewEditKind: () => deps.binding.viewEdit?.kind ?? null,
			placingView: () => deps.binding.experienceTool === 'place'
		},
		lookThroughSession: () => deps.binding.lookThroughSession()
	};
}

export type ExperienceHostPorts = ReturnType<typeof createExperienceHostPorts>;
