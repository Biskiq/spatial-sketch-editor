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
export type SubjectScope = { readonly entityId: string | null };

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
