import {
	createNavigationGraph,
	resolveSceneDocument,
	type SceneDocument,
	type NavigationGraph,
	type RuntimeScene,
	type SceneRoomResolver
} from '$lib/content/scene';
import { validateSceneDocument } from '@portfolio/project-model';
import tourMinimalRaw from './tour-minimal.json';

export type FixtureSceneName = 'tour-minimal';

export type LoadedFixtureScene = {
	document: SceneDocument;
	scene: RuntimeScene;
	graph: NavigationGraph;
};

const fixtures: Record<FixtureSceneName, unknown> = {
	'tour-minimal': tourMinimalRaw
};

/**
 * The checked-in fixture is a **legacy room-local** Scene: its entities and
 * navigation records carry `roomId` and local coordinates. PR #115 (§3.7)
 * isolated the Chopin Room frames it used to resolve against into the external
 * frozen project, so resolution can no longer be a no-argument call here — the
 * Room resolver is now an explicit input owned by the caller.
 *
 * Callers with a room-local fixture pass the frames they mean; callers whose
 * document is world-local pass `createEmptyLayoutRoomRegistry()` from
 * `@portfolio/project-model`, whose frame helpers stay identity for room-less
 * records. The fixture bytes are unchanged either way; only the frame source
 * moved out of this repository.
 */
export function loadFixtureScene(
	rooms: SceneRoomResolver,
	name: FixtureSceneName = 'tour-minimal'
): LoadedFixtureScene {
	const document = loadFixtureSceneDocument(name);
	const scene = resolveSceneDocument(document, rooms);
	const graph = createNavigationGraph(scene);
	return { document, scene, graph };
}

/** Validate a checked-in fixture through the same validator production uses. */
export function loadFixtureSceneDocument(name: FixtureSceneName = 'tour-minimal'): SceneDocument {
	const validation = validateSceneDocument(fixtures[name]);
	if (!validation.success) {
		const first = validation.issues[0];
		throw new Error(
			`Fixture "${name}" failed validation: ${first?.code ?? 'unknown'} ${first?.path ?? ''} ${first?.message ?? ''}`
		);
	}
	return validation.document;
}

/** Deep-clone a fixture document for mutation-friendly tests. */
export function cloneFixtureDocument(name: FixtureSceneName = 'tour-minimal'): SceneDocument {
	return JSON.parse(JSON.stringify(loadFixtureSceneDocument(name))) as SceneDocument;
}
