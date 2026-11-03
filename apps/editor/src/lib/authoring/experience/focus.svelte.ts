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
 *
 * R217.S26 (E17): the subjects selected before the current one form a session-only
 * history of at most 40 entries, so Back can return to what was looked at. Back only
 * changes what is looked at; it never undoes, and history is never serialized.
 */
import type { ExperienceSubject } from './experience-model';
import { EMPTY_EXPERIENCE_FOCUS, type ExperienceFocus } from './preview-entry';

/** How many earlier subjects Back can return to. */
export const EXPERIENCE_BACK_LIMIT = 40;

function sameSubject(left: ExperienceSubject, right: ExperienceSubject): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

class ExperienceFocusState {
	experienceId = $state<string | null>(null);
	/** The active Guide: context for the instrument and the Stop numbers, not a selection. */
	guideId = $state<string | null>(null);
	/** Raw: a subject is an immutable value, so history keeps the very objects that were selected. */
	subject = $state.raw<ExperienceSubject | null>(null);
	/** Earlier subjects, the most recent last. Session state only. */
	history = $state.raw<readonly ExperienceSubject[]>([]);

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
		this.history = [];
	}

	/** Make a Guide the active one. It selects nothing. */
	openGuide(guideId: string | null): void {
		this.guideId = guideId;
	}

	select(subject: ExperienceSubject | null): void {
		const previous = this.subject;
		if (previous !== null && (subject === null || !sameSubject(previous, subject))) {
			this.history = [...this.history.filter((entry) => !sameSubject(entry, previous)), previous].slice(-EXPERIENCE_BACK_LIMIT);
		}
		this.subject = subject;
	}

	/** The subject Back returns to: the most recent earlier one that still resolves. */
	previous(resolves: (subject: ExperienceSubject) => boolean): ExperienceSubject | null {
		for (let index = this.history.length - 1; index >= 0; index -= 1) {
			const entry = this.history[index]!;
			if (resolves(entry) && (this.subject === null || !sameSubject(entry, this.subject))) return entry;
		}
		return null;
	}

	/** Return to the previous subject that still resolves; entries after it are dropped. */
	back(resolves: (subject: ExperienceSubject) => boolean): boolean {
		const target = this.previous(resolves);
		if (target === null) return false;
		const at = this.history.lastIndexOf(target);
		this.history = this.history.slice(0, at);
		this.subject = target;
		return true;
	}

	reset(): void {
		this.experienceId = EMPTY_EXPERIENCE_FOCUS.experienceId;
		this.guideId = null;
		this.subject = null;
		this.history = [];
	}
}

export const experienceFocus = new ExperienceFocusState();
