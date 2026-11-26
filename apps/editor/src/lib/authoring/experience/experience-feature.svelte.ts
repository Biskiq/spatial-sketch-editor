/**
 * The Experience feature.
 *
 * The entry composes the Experience binding's owners: the host reads other
 * owners need (shown Card, floor datum, cursor precedence and Look-through
 * session), the Preview host with its one Artwork closure, and the lifecycle
 * stage. Contextual navigation stays on the binding's own path; the Head's
 * workspace request still goes through `leaveLens`, which reaches `changeLens`.
 */
import type { StageExperienceBinding } from '../stage/route/stage-experience-binding.svelte';
import { experienceFocus } from './focus.svelte';
import {
	createExperienceHostPorts,
	type ExperienceHostPortsDeps,
} from './experience-host-ports.svelte';
import type { ExperiencePreviewHost } from './experience-preview-host';
import {
	createExperienceRegionViews,
	type ExperienceRegionViewDeps,
} from './experience-region-views.svelte';

export type ExperienceFeatureDeps = {
	readonly binding: StageExperienceBinding;
	readonly preview: ExperiencePreviewHost;
	readonly host: Omit<ExperienceHostPortsDeps, 'binding'>;
	readonly regions: Omit<ExperienceRegionViewDeps, 'binding' | 'previewActive'>;
};

export function createExperienceFeature(deps: ExperienceFeatureDeps) {
	const { preview } = deps;
	const host = createExperienceHostPorts({ binding: deps.binding, ...deps.host });
	const views = createExperienceRegionViews({
		binding: deps.binding,
		previewActive: () => preview.openState,
		...deps.regions,
	});
	return {
		ports: {
			binding: deps.binding,
			get shownCard() {
				return host.shownCard;
			},
			get floorDatum() {
				return host.floorDatum;
			},
			cursor: host.cursor,
			lookThroughSession: host.lookThroughSession,
			regions: {
				get viewport() {
					return views.viewport;
				},
				get toolbars() {
					return views.toolbars;
				},
			},
		},
		lifecycle: {
			resetFocus: { 'reset-focus': () => experienceFocus.reset() },
			leaveLens: { 'change-lens': deps.binding.changeLens },
			start: { start: deps.binding.start },
			dispose: { dispose: deps.binding.dispose },
		},
	};
}

export type ExperienceFeature = ReturnType<typeof createExperienceFeature>;
