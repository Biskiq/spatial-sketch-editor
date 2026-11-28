/**
 * G1's one group-name collision rule.
 *
 * A new cluster keeps the name it was given unless the accepted Scene already
 * holds it, in which case it takes the first free `<base> <n>` from 2 upward.
 * The Group Card and the group-copy placement session both mint a cluster, so
 * both read this rule here rather than keeping a private copy.
 */
export function nextGroupName(
	scene: { readonly clusters?: readonly { readonly name: string }[] },
	base: string,
): string {
	const names = new Set((scene.clusters ?? []).map((cluster) => cluster.name));
	if (!names.has(base)) return base;
	for (let index = 2; index < 1000; index += 1) {
		const candidate = `${base} ${index}`;
		if (!names.has(candidate)) return candidate;
	}
	return base;
}
