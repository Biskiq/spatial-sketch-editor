/**
 * The Experience lens's authoring focus (T3.P02.S01, R217.S25).
 *
 * One writable owner for what the lens is working on: the open Experience, the active
 * Guide, and the one Card subject (D10). It is **surface focus**, not canonical Stage
 * selection: a Presentation or Stop is not a spatial subject, so it never enters the
 * host's selection or history. The Head's Preview entry rule reads it; the Stage keeps
 * owning selection, task focus and gestures.
 *
 * There is no second selection. `stopId` and `presentationId` are views of the subject,
 * so a remembered Stop or Presentation can never outlive the selection that replaced
 * it: a Stop or transition subject names a Stop, a Presentation or View subject names a
 * Presentation, and a Guide subject names neither.
 *
 * A project replacement resets it, because the identities it names belong to the
 * source that was replaced.
 */
import type { ExperienceSubject } from './experience-model';
import { EMPTY_EXPERIENCE_FOCUS, type ExperienceFocus } from './preview-entry';

class ExperienceFocusState {
	experienceId = $state<string | null>(null);
	/** The active Guide: context for the instrument and the Stop numbers, not a selection. */
	guideId = $state<string | null>(null);
	subject = $state<ExperienceSubject | null>(null);

	get stopId(): string | null {
		const subject = this.subject;
		return subject !== null && (subject.kind === 'stop' || subject.kind === 'transition') ? subject.stopId : null;
	}

	get presentationId(): string | null {
		const subject = this.subject;
		return subject !== null && (subject.kind === 'presentation' || subject.kind === 'view')
			? subject.presentationId
			: null;
	}

	read(): ExperienceFocus {
		return {
			experienceId: this.experienceId,
			guideId: this.guideId,
			stopId: this.stopId,
			presentationId: this.presentationId
		};
	}

	/** Open an Experience: no subject and no active Guide carry over from the last one. */
	openExperience(experienceId: string | null, guideId: string | null = null): void {
		this.experienceId = experienceId;
		this.guideId = guideId;
		this.subject = null;
	}

	/** Make a Guide the active one. It selects nothing. */
	openGuide(guideId: string | null): void {
		this.guideId = guideId;
	}

	select(subject: ExperienceSubject | null): void {
		this.subject = subject;
	}

	reset(): void {
		this.experienceId = EMPTY_EXPERIENCE_FOCUS.experienceId;
		this.guideId = null;
		this.subject = null;
	}
}

export const experienceFocus = new ExperienceFocusState();
