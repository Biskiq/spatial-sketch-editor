/**
 * The one deterministic contact a template member carries into a placement.
 *
 * A light has none. A model is its host definition's admitted contact, never a
 * live bound; a form and a primitive are their own analytic base. The planner
 * re-reads every returned value against the composed entity, so this is the
 * captured contact the intent carries, not a second authority that could
 * disagree with revalidation.
 */
import { sceneFormContactMinY } from '../form';
import type { SceneOperationRefusal } from './operations/types';
import { refusal } from './operations/refusals';
import { analyticalContactMinY } from './operations/support';
import { admittedModelContact, type GroupTemplateMember } from './group-template';
import type { NormalizedPlacementDefinition } from './types';

export function groupTemplateMemberContact(input: {
	readonly member: GroupTemplateMember;
	readonly definitions: ReadonlyMap<string, NormalizedPlacementDefinition>;
}): { readonly kind: 'contact'; readonly value: number | null } | SceneOperationRefusal {
	const { member } = input;
	if (member.kind === 'light') return { kind: 'contact', value: null };
	if (member.kind === 'model') {
		const admitted = admittedModelContact({
			assetId: member.assetId,
			name: member.name,
			definitions: input.definitions,
		});
		return admitted.kind === 'rejected' ? admitted : { kind: 'contact', value: admitted.value };
	}
	const analytical =
		member.kind === 'form' ? sceneFormContactMinY(member.form) : analyticalContactMinY(member);
	if (analytical === null) {
		return refusal(
			'missing-contact-metadata',
			`"${member.name}" has no honest floor contact, so it cannot be placed in a group.`,
			[member.name, 'contactMinY'],
		);
	}
	return { kind: 'contact', value: analytical };
}
