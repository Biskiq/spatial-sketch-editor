/**
 * Place copy in World, as one pure journey over the owners' ports.
 *
 * Resolve pending work (the controller already did) → Save the source project →
 * capture the saved root into My Objects → leave for the destination chooser. Three
 * separate steps, never one transaction, and each can fail on its own:
 *
 * - a failed Save stops with the work intact and nothing sent anywhere;
 * - a failed library write keeps the saved project and says so;
 * - once anything awaited, the creator may have moved on (another root, the World, the
 *   Experience lens). `current()` is asked after **every** await, and a transfer that is
 *   no longer current neither navigates nor speaks: the saved object is simply in My
 *   Objects, and a late failure must not appear over unrelated work.
 *
 * The journey reads the accepted root again after the Save, so the copy carries what
 * was saved, not what was selected a moment earlier.
 */
import type { SceneFormEntity } from '@portfolio/project-model/scene';

export type PlaceCopyPorts<Entity = SceneFormEntity> = {
	/** The accepted form for this root right now, or `null`. */
	entity(rootId: string): Entity | null;
	isDirty(): boolean;
	/** The Head's own Save: `saved`, a worded `refused`/`error`, or anything else (blocked/unavailable). */
	saveFirst(): Promise<{ readonly kind: string; readonly message?: string }>;
	saveToLibrary(
		entity: Entity,
	): Promise<
		| { readonly kind: 'saved'; readonly itemId: string; readonly name: string }
		| { readonly kind: 'refused'; readonly message: string }
	>;
	/** Record the way back before leaving (ids only). */
	beginTransfer(itemId: string, name: string): void;
	/** Leave for the destination chooser. */
	openChooser(itemId: string): Promise<void>;
	notice(message: string): void;
};

export type PlaceCopyResult = 'navigated' | 'failed' | 'stale';

export async function runPlaceCopy<Entity>(
	rootId: string,
	current: () => boolean,
	ports: PlaceCopyPorts<Entity>,
): Promise<PlaceCopyResult> {
	if (ports.entity(rootId) === null) {
		ports.notice('That object is no longer in the project; nothing was saved.');
		return 'failed';
	}
	if (ports.isDirty()) {
		const saved = await ports.saveFirst();
		if (!current()) return 'stale';
		if (saved.kind !== 'saved') {
			ports.notice(
				(saved.kind === 'refused' || saved.kind === 'error') && saved.message !== undefined
					? `The project could not be saved: ${saved.message} Nothing was moved; you are still in Object Studio.`
					: 'The project could not be saved, so nothing was moved. Save it from the Head and try again.',
			);
			return 'failed';
		}
	}
	const entity = ports.entity(rootId);
	if (entity === null) {
		ports.notice('That object is no longer in the project; nothing was saved.');
		return 'failed';
	}
	const result = await ports.saveToLibrary(entity);
	if (!current()) return 'stale';
	if (result.kind !== 'saved') {
		ports.notice(`${result.message} The project is saved; try Place copy in World again.`);
		return 'failed';
	}
	ports.beginTransfer(result.itemId, result.name);
	await ports.openChooser(result.itemId);
	return 'navigated';
}
