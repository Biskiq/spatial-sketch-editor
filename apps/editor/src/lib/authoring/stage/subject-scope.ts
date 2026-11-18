/**
 * The Stage's pick scope: which Scene subject the pointer may reach.
 *
 * Object Studio narrows the world to one root. Narrowing is a **posture over the
 * existing pick path**, not a second one: the same ray, the same adapters, the
 * same arbitration — with everything outside the scope removed from the answer
 * (and, for the Scene ray, skipped so the ray continues to the scoped body behind
 * a muted one). It is session state; it is never serialized and is never a
 * permission (a refused target is simply not pickable, and no source is guarded
 * by it).
 *
 * `null` is "not scoped". `{ entityId: null }` reaches nothing.
 */
export type SubjectScope = {
	readonly entityId: string | null;
	/**
	 * The operations the posture offers, by owning adapter and operation id (a task, a
	 * Find entry or a host tool). Absent means every operation. The Stage facade — the
	 * owner of opening them — refuses the rest, so a shortcut, Find or a stale button
	 * cannot reach what the dock does not show.
	 */
	readonly admitsOperation?: (adapterId: string, id: string) => boolean;
	/**
	 * Which contributed Card actions a subject offers. Absent means every action. The
	 * facade that publishes actions applies it, so the Card, the Delete key and a stale
	 * record all meet the same answer; the protected root cannot be duplicated or deleted.
	 * The action id lets a scope admit one root action without admitting the rest.
	 */
	readonly admitsCardAction?: (adapterId: string, subjectId: string, actionId?: string) => boolean;
};

export type SubjectScopeCell = {
	get(): SubjectScope | null;
	set(next: SubjectScope | null): void;
};

export function createSubjectScope(): SubjectScopeCell {
	let value: SubjectScope | null = null;
	return {
		get: () => value,
		set: (next) => { value = next; }
	};
}

/** Whether a Scene entity id is inside the scope (always, when unscoped). */
export function scopeAdmitsEntity(scope: SubjectScope | null, entityId: string | null): boolean {
	return scope === null || (scope.entityId !== null && scope.entityId === entityId);
}

/** Whether an operation (task, Find entry or host tool) is inside the scope. */
export function scopeAdmitsOperation(scope: SubjectScope | null, adapterId: string, id: string): boolean {
	return scope === null || scope.admitsOperation === undefined || scope.admitsOperation(adapterId, id);
}

/**
 * The owner name host tools (Measure, Eraser, Paint) carry in `admitsOperation`. It
 * is the host adapter's id, spelled here because the facade may not import the
 * contribution module; a test pins the two together.
 */
export const SCOPE_HOST_OWNER = 'host';

/** Whether a subject's contributed Card action is inside the scope (always, when unscoped). */
export function scopeAdmitsCardAction(
	scope: SubjectScope | null,
	adapterId: string,
	subjectId: string,
	actionId?: string
): boolean {
	return scope === null || scope.admitsCardAction === undefined || scope.admitsCardAction(adapterId, subjectId, actionId);
}
