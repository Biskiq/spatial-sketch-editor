/**
 * T5.P01.S04 — Save to My Objects.
 *
 * Save is outside authoring history: it takes one **accepted** form entity,
 * writes the shared codec's canonical payload to the owner's library and adds no
 * history entry, no project revision and no dirty flag. The adapter passes the
 * entity from its accepted binding, so a pending preview can never be saved.
 *
 * The chunk is only downloaded by the Card action, keeping the library client and
 * codec out of Stage first load.
 */
import { env } from '$env/dynamic/public';
import { formLibraryPayloadFromEntity } from '@portfolio/project-model/library';
import type { SceneFormEntity } from '@portfolio/project-model';

import type { StageCardActionOutcome } from '$lib/authoring/stage/stage-facade';
import { FormLibraryClientError, createFormLibraryClient, type FormLibraryClient } from './client';

export async function saveFormToMyObjects(
	entity: SceneFormEntity,
	options: { readonly client?: FormLibraryClient } = {}
): Promise<StageCardActionOutcome> {
	const client =
		options.client ?? createFormLibraryClient({ apiOrigin: env.PUBLIC_API_ORIGIN ?? '' });
	try {
		const summary = await client.save(formLibraryPayloadFromEntity(entity));
		return {
			kind: 'accepted',
			message: `Saved “${summary.name}” to My Objects. It is available in every project.`
		};
	} catch (cause) {
		if (cause instanceof FormLibraryClientError) {
			// The server's refusal already names Remove for a full library; do not
			// repeat the instruction in a second sentence.
			return { kind: 'refused', message: cause.message };
		}
		// A lost response cannot tell whether the server stored the item before the
		// failure, so never claim nothing was saved.
		return {
			kind: 'refused',
			message: 'The save could not be confirmed; refresh My Objects before retrying.'
		};
	}
}
