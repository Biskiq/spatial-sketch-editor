/**
 * The Experience lens's authoring focus (T3.P02.S01).
 *
 * One writable owner for what the lens is working on: the open Experience, the
 * open Guide, the selected Stop and the selected Presentation. It is **surface
 * focus**, not canonical Stage selection — a Presentation or Stop is not a
 * spatial subject, so it never enters the host's selection or history. The Head's
 * Preview entry rule reads it; the Stage keeps owning selection, task focus and
 * gestures.
 *
 * A project replacement resets it, because the identities it names belong to the
 * source that was replaced.
 */
import { EMPTY_EXPERIENCE_FOCUS, type ExperienceFocus } from './preview-entry';

class ExperienceFocusState {
	experienceId = $state<string | null>(null);
	guideId = $state<string | null>(null);
	stopId = $state<string | null>(null);
	presentationId = $state<string | null>(null);

	read(): ExperienceFocus {
		return {
			experienceId: this.experienceId,
			guideId: this.guideId,
			stopId: this.stopId,
			presentationId: this.presentationId
		};
	}

	openExperience(experienceId: string | null, guideId: string | null = null): void {
		this.experienceId = experienceId;
		this.guideId = guideId;
		this.stopId = null;
		this.presentationId = null;
	}

	openGuide(guideId: string | null, entryStopId: string | null = null): void {
		this.guideId = guideId;
		this.stopId = guideId === null ? null : entryStopId;
	}

	selectStop(stopId: string | null): void {
		this.stopId = stopId;
	}

	selectPresentation(presentationId: string | null): void {
		this.presentationId = presentationId;
	}

	reset(): void {
		this.experienceId = EMPTY_EXPERIENCE_FOCUS.experienceId;
		this.guideId = null;
		this.stopId = null;
		this.presentationId = null;
	}
}

export const experienceFocus = new ExperienceFocusState();
