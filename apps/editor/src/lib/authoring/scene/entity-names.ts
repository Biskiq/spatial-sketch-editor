/**
 * Scene entity naming, shared by every domain that mints an entity.
 *
 * A new subject never collides with an existing name: the base name, then its
 * numbered variants. It reads the accepted Scene document only, so the Scene
 * adapter's Card can name a Showcase rig without reaching into another adapter
 * or into the Stage.
 */
import type { SceneDocument } from '@portfolio/project-model/scene';

export function nextEntityName(scene: Pick<SceneDocument, 'entities'>, base: string): string {
	const names = new Set(scene.entities.map((entity) => entity.name));
	if (!names.has(base)) return base;
	for (let index = 2; index < 10_000; index += 1) {
		const candidate = `${base} ${index}`;
		if (!names.has(candidate)) return candidate;
	}
	return `${base} ${Date.now()}`;
}
