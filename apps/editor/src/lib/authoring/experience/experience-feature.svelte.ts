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
import { createExperienceHostPorts, type ExperienceHostPortsDeps } from './experience-host-ports.svelte';
import { createExperiencePreviewHost, type ExperiencePreviewHostInput } from './experience-preview-host';

export type ExperienceFeatureDeps = {
	readonly binding: StageExperienceBinding;
	readonly preview: ExperiencePreviewHostInput;
	readonly host: Omit<ExperienceHostPortsDeps, 'binding'>;
};

export function createExperienceFeature(deps: ExperienceFeatureDeps) {
	const preview = createExperiencePreviewHost(deps.preview);
	const host = createExperienceHostPorts({ binding: deps.binding, ...deps.host });
	return {
		ports: {
			binding: deps.binding,
			get previewController() {
				return preview;
			},
			get preview() {
				return preview.preview;
			},
			get previewView() {
				return preview.view;
			},
			get previewViewRead() {
				return preview.viewRead;
			},
			get previewSurface() {
				return preview.surface;
			},
			get previewRequestedMode() {
				return preview.requestedMode;
			},
			get previewGuideStats() {
				return preview.stats;
			},
			get previewViewLabels() {
				return preview.labels;
			},
			get previewAvailable() {
				return preview.available;
			},
			get previewActive() {
				return preview.openState;
			},
			openPreview: preview.open,
			closePreview: preview.close,
			get shownCard() {
				return host.shownCard;
			},
			get floorDatum() {
				return host.floorDatum;
			},
			cursor: host.cursor,
			lookThroughSession: host.lookThroughSession
		},
		lifecycle: {
			resetFocus: { 'reset-focus': () => experienceFocus.reset() },
			leaveLens: { 'change-lens': deps.binding.changeLens },
			start: { start: deps.binding.start },
			dispose: { dispose: deps.binding.dispose }
		}
	};
}

export type ExperienceFeature = ReturnType<typeof createExperienceFeature>;
