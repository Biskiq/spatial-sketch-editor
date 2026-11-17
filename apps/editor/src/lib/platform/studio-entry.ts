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
/** A My Objects item to place at the datum of a new Studio project (Open editable copy). */
export const STUDIO_COPY_PARAM = 'copy';
/** A My Objects item to arm in an existing project's World (Place copy in World). */
export const PLACE_COPY_PARAM = 'place-copy';

export type StudioProjectFlags = {
	/** A freshly minted identity (`create=1`): the route admits an empty baseline. */
	readonly create?: boolean;
	/** An explicit cloud read of an owned project (`load=1`). */
	readonly load?: boolean;
	/** One explicit root inside the loaded project. Never guessed from names. */
	readonly object?: string | null;
	/** One My Objects item inserted at the datum of a new project (Open editable copy). */
	readonly copy?: string | null;
};

/** The spatial route in the Studio posture. */
export function studioProjectUrl(projectId: string, flags: StudioProjectFlags = {}): string {
	const query = [
		flags.create === true ? 'create=1' : '',
		flags.load === true ? 'load=1' : '',
		`${STUDIO_ENTRY_PARAM}=${STUDIO_ENTRY_VALUE}`,
		flags.object ? `${STUDIO_OBJECT_PARAM}=${encodeURIComponent(flags.object)}` : '',
		flags.copy ? `${STUDIO_COPY_PARAM}=${encodeURIComponent(flags.copy)}` : ''
	].filter((part) => part !== '');
	return `/project/${encodeURIComponent(projectId)}/spatial?${query.join('&')}`;
}

/** The spatial route in the World with one saved copy armed for the creator to place. */
export function placeCopyProjectUrl(projectId: string, itemId: string): string {
	return `/project/${encodeURIComponent(projectId)}/spatial?load=1&${PLACE_COPY_PARAM}=${encodeURIComponent(itemId)}`;
}

/** A brand-new project's World with one saved copy armed (Place copy in World → New project). */
export function placeCopyNewProjectUrl(projectId: string, itemId: string): string {
	return `/project/${encodeURIComponent(projectId)}/spatial?create=1&${PLACE_COPY_PARAM}=${encodeURIComponent(itemId)}`;
}

export type StudioEntryRequest = {
	/** `entry=studio` is present: open in the Studio posture. */
	readonly studio: boolean;
	/** The explicitly requested root, or `null` when none was named. */
	readonly objectId: string | null;
	/** The My Objects item to place at the datum on arrival, when named. */
	readonly copyId: string | null;
};

export function studioEntryFromSearch(search: URLSearchParams): StudioEntryRequest {
	const studio = search.get(STUDIO_ENTRY_PARAM) === STUDIO_ENTRY_VALUE;
	const object = search.get(STUDIO_OBJECT_PARAM);
	const copy = search.get(STUDIO_COPY_PARAM);
	return {
		studio,
		objectId: studio && object !== null && object !== '' ? object : null,
		copyId: studio && copy !== null && copy !== '' ? copy : null
	};
}

/** The My Objects item an existing project's World should arm on arrival, or `null`. */
export function placeCopyFromSearch(search: URLSearchParams): string | null {
	const item = search.get(PLACE_COPY_PARAM);
	return item !== null && item !== '' ? item : null;
}
