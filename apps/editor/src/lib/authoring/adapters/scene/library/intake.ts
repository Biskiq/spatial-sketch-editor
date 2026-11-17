/**
 * One pending My Objects insertion, handed to the Place instrument.
 *
 * Two journeys arrive at a project with a saved copy to insert: *Open editable
 * copy* (a new project, placed at the datum) and *Place copy in World* (an existing
 * project, armed for the creator to click a position). Both go through the same
 * Place session and the same `place-form-copy` planner as the My Objects section;
 * this module only carries the request from the route (which reads the address) to
 * the instrument (which owns the session). It is session state, never serialized,
 * and is taken exactly once, so a reload or a second visit never inserts twice.
 */
export type FormCopyIntake = {
	readonly itemId: string;
	/** `arm` waits for the creator's click; `datum` places at X/Z 0 with yaw 0. */
	readonly mode: 'arm' | 'datum';
};

const pending = new Map<string, FormCopyIntake>();

export function requestFormCopyIntake(projectId: string, intake: FormCopyIntake): void {
	pending.set(projectId, intake);
}

export function peekFormCopyIntake(projectId: string): FormCopyIntake | null {
	return pending.get(projectId) ?? null;
}

/** Take the pending request; a second take answers `null`. */
export function takeFormCopyIntake(projectId: string): FormCopyIntake | null {
	const intake = pending.get(projectId) ?? null;
	pending.delete(projectId);
	return intake;
}
