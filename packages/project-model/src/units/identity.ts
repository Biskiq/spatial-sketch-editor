/** Collision-free keys for opaque F.1 identities; path segments stay distinct. */
export function dependencyLockKey(
	domain: string,
	subjectKind: string,
	subjectId: string,
	instancePath: readonly string[]
): string {
	return JSON.stringify([domain, subjectKind, subjectId, instancePath]);
}
