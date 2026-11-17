/**
 * Object Studio entry addresses — deliberately free of the project model.
 *
 * `/`, `/projects` and `/studio` mint or open a project in the **Studio posture**
 * through the existing spatial route. The posture is navigation state, never
 * source: `entry=studio` names it, an optional `object=<entity-id>` names one
 * explicit root inside the loaded project, and neither is an authorization
 * token or a durable reference format. Like `project-identity.ts` this module
 * imports nothing, so the first-load routes stay free of the project-model
 * barrel (and Three).
 */

export const STUDIO_ENTRY_PARAM = 'entry';
export const STUDIO_ENTRY_VALUE = 'studio';
export const STUDIO_OBJECT_PARAM = 'object';

export type StudioProjectFlags = {
	/** A freshly minted identity (`create=1`): the route admits an empty baseline. */
	readonly create?: boolean;
	/** An explicit cloud read of an owned project (`load=1`). */
	readonly load?: boolean;
	/** One explicit root inside the loaded project. Never guessed from names. */
	readonly object?: string | null;
};

/** The spatial route in the Studio posture. */
export function studioProjectUrl(projectId: string, flags: StudioProjectFlags = {}): string {
	const query = [
		flags.create === true ? 'create=1' : '',
		flags.load === true ? 'load=1' : '',
		`${STUDIO_ENTRY_PARAM}=${STUDIO_ENTRY_VALUE}`,
		flags.object ? `${STUDIO_OBJECT_PARAM}=${encodeURIComponent(flags.object)}` : ''
	].filter((part) => part !== '');
	return `/project/${encodeURIComponent(projectId)}/spatial?${query.join('&')}`;
}

export type StudioEntryRequest = {
	/** `entry=studio` is present: open in the Studio posture. */
	readonly studio: boolean;
	/** The explicitly requested root, or `null` when none was named. */
	readonly objectId: string | null;
};

export function studioEntryFromSearch(search: URLSearchParams): StudioEntryRequest {
	const studio = search.get(STUDIO_ENTRY_PARAM) === STUDIO_ENTRY_VALUE;
	const object = search.get(STUDIO_OBJECT_PARAM);
	return { studio, objectId: studio && object !== null && object !== '' ? object : null };
}
