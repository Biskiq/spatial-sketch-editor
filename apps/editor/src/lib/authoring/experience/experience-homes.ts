/**
 * The Experience homes' shared context (R217.S25).
 *
 * The route owns the Experience controller (created by ExperienceHomesHost once the
 * admitted source is mounted) and the two pieces of shell state the homes share: whether
 * the Guide instrument is open and which kind of subject the Card shows. The Card's
 * writers and the Guide panel are rendered inside the route's own tree, so they read
 * those through this context rather than through a prop the Card's writer contract does
 * not carry. Every getter reads live state; nothing here is a copy.
 *
 * It holds no source, selection or Camera state. Commands stay on the controller.
 */
import { getContext, setContext } from 'svelte';
import type { ExperienceController } from './experience-controller.svelte';

/** The subject kind the Card shows for an Experience: a Presentation, or a Stop of the Guide. */
export type ExperienceCardKind = 'presentation' | 'stop';

export type ExperienceHomes = {
	/** The live controller, or null while the Experience lens is not mounted. */
	readonly controller: () => ExperienceController | null;
	/** Whether the Guide instrument is open in the lower edge. */
	readonly guideOpen: () => boolean;
	readonly setGuideOpen: (open: boolean) => void;
	/** Records which Experience subject the user last focused, so the Card shows it. */
	readonly focusCardSubject: (kind: ExperienceCardKind) => void;
};

const HOMES = Symbol('experience-homes');

/** Called once during the route's initialisation, before any home mounts beneath it. */
export function provideExperienceHomes(homes: ExperienceHomes): void {
	setContext(HOMES, homes);
}

/** The homes a component mounted beneath the route reads. Throws outside the route, which is a wiring error. */
export function experienceHomes(): ExperienceHomes {
	const homes = getContext<ExperienceHomes | undefined>(HOMES);
	if (homes === undefined) throw new Error('Experience homes are read outside the spatial route.');
	return homes;
}
