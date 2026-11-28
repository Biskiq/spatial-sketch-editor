/**
 * The approved creator-facing words for a refused group copy.
 *
 * The specimen (§9) is the authority. The planner's technical message stays in
 * the refusal state for diagnosis; what the creator reads is mapped here, once,
 * for both the live preview and an acceptance that refuses.
 */
import type { GroupTemplate } from '@portfolio/project-model/scene-planning';
import type { Vec3 } from '@portfolio/project-model/scene';
import type { GroupCopyOriginMode } from './group-copy-arm';

/** A refusal held at the pointer; `at` is the world point its words annotate. */
export type GroupCopyRefusal = {
	readonly code: string;
	readonly message: string;
	readonly at: Vec3 | null;
};

export type RefusalLike = {
	readonly code: string;
	readonly message: string;
	readonly diagnostics?: readonly (string | { readonly message: string })[];
};

/**
 * The approved words for one refusal. A member-named `no-support` reads as the
 * specimen's "would reach the floor here", because "nothing below to stand on"
 * is wrong for a hanging body.
 */
export function creatorWords(input: {
	readonly refusal: RefusalLike;
	readonly template: GroupTemplate;
	readonly entityIds: readonly string[];
	readonly name: string;
}): string {
	const { refusal } = input;
	if (refusal.code === 'invalid-template') return 'This group cannot be read.';
	if (refusal.code === 'no-overhead-support') return 'Nothing overhead to hang from here';
	if (refusal.code === 'not-a-wall') return 'Point at a wall';
	if (refusal.code === 'no-support') {
		for (const diagnostic of refusal.diagnostics ?? []) {
			const message = typeof diagnostic === 'string' ? diagnostic : diagnostic.message;
			const index = input.entityIds.indexOf(message);
			const member = index < 0 ? undefined : input.template.members[index];
			if (member !== undefined) return `${member.name} would reach the floor here`;
		}
		return 'Nothing below to stand on here';
	}
	if (
		refusal.code === 'unknown_asset' ||
		refusal.code === 'missing-definition' ||
		refusal.code === 'missing-contact-metadata' ||
		refusal.code === 'unsupported-surface'
	) {
		return 'This object is not available in this version.';
	}
	if (refusal.code === 'incompatible-resource') {
		return `This project holds a different copy of ${input.name}.`;
	}
	return refusal.message;
}

/** The natural refusal for a pointer that resolved no origin at all. */
export function pointerRefusal(mode: GroupCopyOriginMode): {
	readonly code: string;
	readonly message: string;
} {
	if (mode === 'overhead') {
		return { code: 'no-overhead-support', message: 'Nothing overhead to hang from here' };
	}
	if (mode === 'wall') return { code: 'not-a-wall', message: 'Point at a wall' };
	return { code: 'no-support', message: 'Nothing below to stand on here' };
}
