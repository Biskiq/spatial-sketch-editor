/**
 * The canonical **starter gallery** (AM-5): one rectangular enclosure, a real
 * reconciled Room and floor datum, no Scene objects and no Camera/Experience
 * content.
 *
 * The template is a static current-format document built **through the retained
 * canonical architecture** — `planWallChain` over an empty wall-first document,
 * using the same wall/opening/room reconciliation every other authoring gesture
 * uses. It is deliberately not a second topology generator: no document literal
 * encodes wall normals, junctions, room polygons or storey heights, and the
 * compiler derives all of it.
 *
 * Booting a template is a **new project/history baseline, never silent
 * architecture insertion** into an existing project: the route host validates the
 * admitted template first and commits it only through an explicit project
 * replacement (an empty boot, a create-only entry, or the creator-confirmed
 * replacement guard).
 */
import {
	createEmptyWallFirstLayoutDocument,
	compileWallFirstLayoutGeometry,
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	createEmptyWorldLocalSceneDocument,
	type ProjectDocument
} from '@portfolio/project-model';

/** The starter enclosure, in project-world XZ meters: a 7 m x 6 m rectangle. */
export const STARTER_ENCLOSURE_POINTS: readonly LayoutVec2[] = [
	[0, -4],
	[7, -4],
	[7, 2],
	[0, 2]
];

export type StarterTemplate = {
	/** Stable template identity, used by the gallery and the route. */
	readonly id: string;
	/** Creator-facing name. */
	readonly label: string;
	/** One short line describing what the template boots. */
	readonly description: string;
	/** Build the current-format document for a concrete project identity. */
	readonly build: (projectId: string, name: string) => ProjectDocument;
};

/**
 * Build the canonical enclosure Layout over a fresh empty wall-first document.
 *
 * Exported so the gallery test can prove the template compiles with no blocking
 * issue against the one canonical compiler rather than trusting a fixture.
 */
export function buildStarterEnclosureLayout(): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({
		baseline,
		points: STARTER_ENCLOSURE_POINTS.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		role: 'boundary'
	});
	if (plan.kind !== 'success') {
		throw new Error(`the canonical starter enclosure no longer plans: ${plan.rejection.code}`);
	}
	return plan.document;
}

function starterProject(projectId: string, name: string): ProjectDocument {
	return {
		id: projectId,
		name,
		layout: buildStarterEnclosureLayout(),
		scene: createEmptyWorldLocalSceneDocument()
	};
}

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
	{
		id: 'starter-enclosure',
		label: 'Enclosed room',
		description: 'One rectangular room with real reconciled walls, floor polygon and datum.',
		build: (projectId, name) => starterProject(projectId, name)
	}
];

/** The template the gallery offers first. */
export const DEFAULT_STARTER_TEMPLATE = STARTER_TEMPLATES[0]!;

/** One template by id, or `null` when it is not an offered template. */
export function starterTemplate(templateId: string): StarterTemplate | null {
	return STARTER_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

/**
 * The blocking compile issues of a starter document, if any.
 *
 * A template that cannot compile to a real floor is not a template: the gallery's
 * own test pins this to `[]`, and the route refuses to boot a template that names
 * one rather than rendering a silent partial Stage.
 */
export function starterBlockingIssueMessages(document: ProjectDocument): readonly string[] {
	const compiled = compileWallFirstLayoutGeometry(document.layout);
	return compiled.issues
		.filter((issue) => issue.severity !== 'warning')
		.map((issue) => issue.message);
}
