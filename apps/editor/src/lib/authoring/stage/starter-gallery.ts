/**
 * The canonical **starter gallery** (AM-5): one rectangular enclosure, a real
 * reconciled Room and floor datum, no Scene objects and no Camera/Experience
 * content.
 *
 * The template's Layout is built **through the retained canonical
 * architecture** — `planWallChain` over an empty wall-first document, using the
 * same wall/opening/room reconciliation every other authoring gesture uses. It is
 * deliberately not a second topology generator: no document literal encodes wall
 * normals, junctions, room polygons or storey heights, and the compiler derives
 * all of it.
 *
 * The template emits an F.2 envelope, never a current-source document. The
 * Camera and Experience units are present and empty: a starter fabricates no
 * View, Presentation or Guide.
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
	type LayoutIdCapture,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { AcceptedRevision } from '@portfolio/project-model';
import { createEmptyUnitEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';

/**
 * The template's captured identity. A template is authored content, not an
 * interactive operation, so its nonce is fixed: every boot derives the same
 * stable template ids, and an ordinary captured edit (a fresh nonce) cannot
 * collide with them.
 */
export const STARTER_TEMPLATE_ID_CAPTURE: LayoutIdCapture = { nonce: 'starter-template' };

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
	/** Build the F.2 envelope for a concrete project identity. */
	readonly build: (
		projectId: string,
		name: string,
		acceptedRevision: AcceptedRevision
	) => Promise<ProjectEnvelope>;
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
		capture: STARTER_TEMPLATE_ID_CAPTURE,
		levelId: baseline.floor.id
	});
	if (plan.kind !== 'success') {
		throw new Error(`the canonical starter enclosure no longer plans: ${plan.rejection.code}`);
	}
	return plan.document;
}

function starterEnvelope(
	projectId: string,
	name: string,
	acceptedRevision: AcceptedRevision
): Promise<ProjectEnvelope> {
	return createEmptyUnitEnvelope({
		id: projectId,
		name,
		acceptedRevision,
		layout: buildStarterEnclosureLayout()
	});
}

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
	{
		id: 'starter-enclosure',
		label: 'Enclosed room',
		description: 'One rectangular room with real reconciled walls, floor polygon and datum.',
		build: (projectId, name, acceptedRevision) => starterEnvelope(projectId, name, acceptedRevision)
	}
];

/** The template the gallery offers first. */
export const DEFAULT_STARTER_TEMPLATE = STARTER_TEMPLATES[0]!;

/** One template by id, or `null` when it is not an offered template. */
export function starterTemplate(templateId: string): StarterTemplate | null {
	return STARTER_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

/**
 * The blocking compile issues of a starter envelope, if any.
 *
 * A template that cannot compile to a real floor is not a template: the gallery's
 * own test pins this to `[]`, and the route refuses to boot a template that names
 * one rather than rendering a silent partial Stage.
 */
export function starterBlockingIssueMessages(envelope: ProjectEnvelope): readonly string[] {
	const compiled = compileWallFirstLayoutGeometry(envelope.units.layout.data);
	return compiled.issues
		.filter((issue) => issue.severity !== 'warning')
		.map((issue) => issue.message);
}
