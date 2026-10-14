import {
	createNavigationGraph,
	resolveSceneDocument,
	type SceneDocument,
	type NavigationGraph,
	type RuntimeScene
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
 * The checked-in fixture is a **current-format** (world-local) Scene: its
 * entities and navigation records carry no `roomId` and their coordinates are
 * project/world space, which is what the reader accepts (PR #115 WP3 — the
 * legacy room-local fixture was migrated by dropping Room ownership and
 * declaring `formatVersion: 1`; the Room frames it used to resolve against stay
 * isolated in the external frozen project, §3.7).
 *
 * There is therefore no frame source to pass: resolution is identity.
 */
export function loadFixtureScene(name: FixtureSceneName = 'tour-minimal'): LoadedFixtureScene {
	const document = loadFixtureSceneDocument(name);
	const scene = resolveSceneDocument(document);
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
