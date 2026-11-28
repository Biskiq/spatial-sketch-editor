/**
 * Resolving one armed group copy against the accepted source.
 *
 * The template is re-read strictly, the captured name is qualified, and every
 * member's contact is captured once for this arm. A member the template codec or
 * its contact rule refuses keeps the approved creator words and leaves the
 * session with no resolved arm; the session owns the lifecycle, this module owns
 * only the read.
 */
import type { GroupTemplate } from '@portfolio/project-model/scene-planning';
import {
	GROUP_TEMPLATE_NAME_MAX_LENGTH,
	groupTemplateMemberContact,
	readGroupTemplate,
} from '@portfolio/project-model/scene-planning';
import type { ArmedGroupCopy } from './group-copy-arm';
import type { GroupCopyPlacementSource } from './group-copy-contract';
import { creatorWords, type GroupCopyRefusal } from './group-copy-refusals';

export type ResolvedArm = {
	readonly copy: ArmedGroupCopy;
	readonly template: GroupTemplate;
	readonly name: string;
	readonly contacts: readonly (number | null)[];
};

export function resolveArm(
	copy: ArmedGroupCopy,
	source: GroupCopyPlacementSource,
):
	| { readonly kind: 'resolved'; readonly arm: ResolvedArm }
	| { readonly kind: 'refused'; readonly refusal: GroupCopyRefusal } {
	const parsed = readGroupTemplate(copy.template);
	if (!parsed.success) {
		return {
			kind: 'refused',
			refusal: { code: 'invalid-template', message: 'This group cannot be read.', at: null },
		};
	}
	const template = parsed.template;
	const requested = copy.name.trim().length === 0 ? template.name : copy.name.trim();
	if (requested.length === 0 || requested.length > GROUP_TEMPLATE_NAME_MAX_LENGTH) {
		return {
			kind: 'refused',
			refusal: { code: 'invalid-template', message: 'This group cannot be read.', at: null },
		};
	}
	const definitions = new Map(
		source.definitions.map((definition) => [definition.definitionKey, definition]),
	);
	const contacts: (number | null)[] = [];
	for (const member of template.members) {
		const contact = groupTemplateMemberContact({ member, definitions });
		if (contact.kind === 'rejected') {
			return {
				kind: 'refused',
				refusal: {
					code: contact.code,
					message: creatorWords({
						refusal: contact,
						template,
						entityIds: [],
						name: requested,
					}),
					at: null,
				},
			};
		}
		contacts.push(contact.value);
	}
	return { kind: 'resolved', arm: { copy, template, name: requested, contacts } };
}
