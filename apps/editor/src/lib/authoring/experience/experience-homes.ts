/**
 * The Experience homes' shared context (R217.S25).
 *
 * The route owns the Experience controller (created by ExperienceHomesHost once the
 * admitted source is mounted) and the shell state the homes share: whether the Guide
 * instrument is open, the one Card selection, and the Scene entity the Card shows in
 * the Experience lens. The Card's writers and the Guide panel are rendered inside the
 * route's own tree, so they read those through this context rather than through a prop
 * the Card's writer contract does not carry. Every getter reads live state; nothing here
 * is a copy.
 *
 * It holds no source, selection or Camera state. Commands stay on the controller; the
 * homes select only through `select`.
 */
import { getContext, setContext } from 'svelte';
import type { ExperienceController } from './experience-controller.svelte';
import type { ExperiencePlayback } from './playback.svelte';
import type { ExperienceSubject } from './experience-model';
import type { AdvancedViewFraming, AuthoredViewPose } from './experience-view-edit';
import type { ExperiencePathOccurrence } from './experience-paths';

export type ExperienceGuideTransport =
	| { readonly kind: 'start' }
	| { readonly kind: 'stop'; readonly stopId: string }
	| { readonly kind: 'move'; readonly occurrence: ExperiencePathOccurrence };

export type ExperienceHomes = {
	/** The live controller, or null while the Experience lens is not mounted. */
	readonly controller: () => ExperienceController | null;
	/** Whether the Guide instrument is open in the lower edge. */
	readonly guideOpen: () => boolean;
	readonly setGuideOpen: (open: boolean) => void;
	/** One Card selection: clears the Stage selection, sets the Experience subject, shows the Card. */
	readonly select: (subject: ExperienceSubject | null) => void;
	/** The Scene entity the Card shows in the Experience lens (subject Card), or null. Reactive. */
	readonly sceneSubject: () => { readonly entityId: string; readonly label: string } | null;
	/** Switch to the World lens keeping the Scene selection ("Open in World"). */
	readonly openInWorld: () => void;
	/** Editor-only disclosure and the selected View's live gesture. */
	readonly advancedCamera?: {
		readonly on: () => boolean;
		readonly set: (on: boolean) => void;
		readonly eligible: (viewId: string) => boolean;
		readonly busy: () => boolean;
		readonly pose: (viewId: string) => AuthoredViewPose | null;
		readonly write: (viewId: string, edit: AdvancedViewFraming) => Promise<void>;
	};
	/** R217.S28 — the View the Stage's provisional through-camera shows, or null. */
	readonly lookThroughViewId: () => string | null;
	readonly lookThroughMoved: () => boolean;
	/** The live provisional framing while looking through: authored lens and floor-relative eye height. */
	readonly lookThroughFraming: () => { readonly fovYDegrees: number; readonly eyeHeightMetres: number } | null;
	readonly lookThroughLens: (fovYDegrees: number) => boolean;
	readonly lookThroughEyeHeight: (metres: number) => boolean;
	readonly lookThrough: (viewId: string) => void;
	readonly exitLookThrough: () => void;
	readonly updateLookThrough: () => Promise<void>;
	readonly captureProvisional: () => Promise<void>;
	/** Present this through Camera's visible framing (E9), or arm placement in Plan. */
	readonly presentThis: (entityId: string, label: string) => Promise<void>;
	/** R217.S30 — the Stage-owned playback session, or null before the lens mounts. */
	readonly playback: () => ExperiencePlayback | null;
	/** Open Preview deliberately in guided or free exploration, for this Guide. */
	readonly previewMode: (mode: 'guided' | 'free', guideId: string | null) => void;
	/** The Guide's full authored run time, even while the rail is closed. */
	readonly guideSeconds: (guideId: string) => number | null;
	/** The Guide that lists a Stop, preferring the active Guide. */
	readonly guideForStop: (stopId: string) => string | null;
	/** Card transport: open/target the Guide, then start the requested action. */
	readonly playGuide: (guideId: string, action: ExperienceGuideTransport) => void;
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
