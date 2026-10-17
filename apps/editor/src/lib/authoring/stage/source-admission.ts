/**
 * Source admission — **admission equals runtime preparation**.
 *
 * A source is shown only when it passes the project's canonical validator with
 * the host's Scene options **and** resolves through the runtime Scene path, and
 * only when its canonical compile has no blocking issue. That is exactly the
 * shape the visitor cold runtime uses, so a source the editor shows is a source a
 * visitor release could prepare, and a defect cannot hide behind an
 * editor-only decode.
 *
 * Three distinct outcomes, deliberately not collapsed:
 *
 * - `refused` — the current-format validator rejected the payload (malformed,
 *   incomplete, non-current format). The viewer is told it is not a supported
 *   source; the Stage never renders.
 * - `diagnostics` — the payload validates, but its canonical compile has blocking
 *   issues. The Stage never renders a silent empty or partial scene: the state
 *   names the issues.
 * - `admitted` — validated, compiled clean, Scene resolved, content identity
 *   computed. This is the only outcome that yields a `StageReadSnapshot`.
 *
 * The content identity is the single project-model export
 * (`computeSourceContentId`), so boot, local acceptance and the later server-side
 * conditional Save cannot disagree about what "the same content" means.
 *
 * Runtime-safe, pure and read-only: nothing here writes a project, calls
 * `saveProject`, or mutates the supplied payload.
 */
import {
	compileWallFirstLayoutGeometry,
	hasBlockingLayoutIssues,
	type CompiledLayoutGeometry,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import {
	prepareRuntime,
	type NavigationGraph,
	type ProjectDocument,
	type ProjectIssue,
	type RuntimeScene
} from '@portfolio/project-model';
import {
	computeSourceContentId,
	type AcceptedRevision,
	type CurrentDomainSource,
	type SnapshotIdentity
} from '@portfolio/project-model';
import type { LayoutRoomRegistry } from '@portfolio/project-model';

import { MUSEUM_SCENE_VALIDATION_OPTIONS } from '$lib/content/scene-validation';
import { parseProjectJson, validateProject } from '$lib/project/project-codec';

/** The domain read access a Stage snapshot publishes. Immutable by construction. */
export type StageDomainRead = {
	/** The strict current source itself, for domain adapters. */
	readonly project: ProjectDocument;
	/** The F.1 read adapters bound to this exact accepted source. */
	readonly current: CurrentDomainSource;
	/** Canonical compiled Layout through the one shared geometry core. */
	readonly geometry: CompiledLayoutGeometry;
	/** The evaluated level datum in project-world meters. */
	readonly datumMeters: number;
	/** The resolved runtime Scene. */
	readonly scene: RuntimeScene;
	/** The current-format (empty) Room registry. */
	readonly rooms: LayoutRoomRegistry;
	/** The visitor-equivalent navigation graph. */
	readonly graph: NavigationGraph;
	/** Non-blocking compiler warnings, retained for diagnostics disclosure. */
	readonly warnings: readonly LayoutGeometryIssue[];
};

/**
 * `StageReadSnapshot` — the source-independent validated read facade the Stage
 * mounts. Field names follow AM-4's `AcceptedSnapshot@1` (accepted revision,
 * source-content identity, admitted source kind/version, domain read access) so
 * the later host↔F4 wiring can swap in S03's export without renaming a consumer.
 */
export type StageReadSnapshot = {
	readonly acceptedRevision: AcceptedRevision;
	readonly sourceContentId: string;
	/** Host session lifetime guard; separate from the acceptance revision. */
	readonly sessionEpoch: string;
	readonly sourceKind: 'project-current';
	readonly sourceVersion: number;
	/** Opaque compile/representation generation every fragment carries. */
	readonly compileGeneration: string;
	readonly domain: StageDomainRead;
};

export type AdmissionRefusalReason = 'invalid-json' | 'invalid-format' | 'project-mismatch';

export type AdmissionOutcome =
	| { readonly kind: 'admitted'; readonly snapshot: StageReadSnapshot }
	| {
			readonly kind: 'refused';
			readonly reason: AdmissionRefusalReason;
			readonly issues: readonly ProjectIssue[];
	  }
	| {
			readonly kind: 'diagnostics';
			readonly issues: readonly LayoutGeometryIssue[];
	  };

export type AdmissionContext = {
	/** The host session epoch every snapshot it admits belongs to. */
	readonly sessionEpoch: string;
	/** The opaque acceptance revision; fresh for every accepted source. */
	readonly acceptedRevision: AcceptedRevision;
};

/** The current-format version of the one supported project document pair. */
const CURRENT_PROJECT_FORMAT_VERSION = 5;

/**
 * The level datum of one compiled Layout, in project-world meters.
 *
 * Current wall-first Layout carries exactly one Floor, so the datum is its
 * elevation. A compile with no Floor at all is not admitted (it has nothing to
 * measure against), which is why the fallback is the origin rather than a guess.
 */
export function layoutDatumMeters(geometry: CompiledLayoutGeometry): number {
	return geometry.floors[0]?.elevation ?? 0;
}

function compileGenerationOf(sourceContentId: string): string {
	return `compile:${sourceContentId}`;
}

function snapshotOf(
	project: ProjectDocument,
	sourceContentId: string,
	context: AdmissionContext,
	domain: StageDomainRead
): StageReadSnapshot {
	return {
		acceptedRevision: context.acceptedRevision,
		sourceContentId,
		sessionEpoch: context.sessionEpoch,
		sourceKind: 'project-current',
		sourceVersion: CURRENT_PROJECT_FORMAT_VERSION,
		compileGeneration: compileGenerationOf(sourceContentId),
		domain
	};
}

const HOST_SCENE_OPTIONS = MUSEUM_SCENE_VALIDATION_OPTIONS;

/**
 * Admit an already-parsed payload.
 *
 * The whole path is one pass of the canonical validator plus one canonical
 * compile plus one Scene resolution — never a second decode for the editor.
 */
export async function admitSource(
	input: unknown,
	context: AdmissionContext
): Promise<AdmissionOutcome> {
	const validated = validateProject(input);
	if (!validated.success) {
		return { kind: 'refused', reason: 'invalid-format', issues: validated.issues };
	}
	const project = validated.project;

	// The accepted revision names the project this host is showing. A document that
	// names a different one is not that project's content: installing it would file
	// one project's bytes under another's identity (and its own content digest would
	// silently describe the wrong project), so it is refused rather than re-identified
	// behind the creator's back.
	if (project.id !== context.acceptedRevision.projectId) {
		return {
			kind: 'refused',
			reason: 'project-mismatch',
			issues: [
				{
					path: '$.id',
					code: 'project_mismatch',
					message: `the source names project "${project.id}", not "${context.acceptedRevision.projectId}"`
				}
			]
		};
	}

	// Admission equals runtime preparation: the Scene resolves through the host's
	// own Scene options exactly as the visitor cold runtime resolves it.
	const prepared = prepareRuntime(project, HOST_SCENE_OPTIONS);
	if (prepared.kind === 'rejected') {
		return { kind: 'refused', reason: 'invalid-format', issues: prepared.issues };
	}

	const compiled = compileWallFirstLayoutGeometry(project.layout);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return {
			kind: 'diagnostics',
			issues: compiled.issues.filter((issue) => issue.severity !== 'warning')
		};
	}

	const sourceContentId = await computeSourceContentId(project);
	const snapshotIdentity: SnapshotIdentity = { acceptedRevision: context.acceptedRevision, sourceContentId };
	const current: CurrentDomainSource = { source: project, snapshot: snapshotIdentity };
	const domain: StageDomainRead = {
		project,
		current,
		geometry: compiled.geometry,
		datumMeters: layoutDatumMeters(compiled.geometry),
		scene: prepared.runtimeScene,
		rooms: prepared.rooms,
		graph: prepared.graph,
		warnings: compiled.issues.filter((issue) => issue.severity === 'warning')
	};
	return { kind: 'admitted', snapshot: snapshotOf(project, sourceContentId, context, domain) };
}

/**
 * Admit explicit source JSON (the "open a source JSON" entry).
 *
 * JSON that does not parse is `refused` with `invalid-json` and the parser's own
 * issue — never a silently empty document. Anything that parses goes through the
 * same admission as an in-memory payload, so there is one admission path.
 */
export async function admitSourceJson(
	json: string,
	context: AdmissionContext
): Promise<AdmissionOutcome> {
	const parsed = parseProjectJson(json);
	if (!parsed.success) {
		const firstIssue = parsed.issues[0];
		const jsonOnly =
			firstIssue !== undefined &&
			parsed.issues.every((issue) => issue.code === 'invalid_json');
		return {
			kind: 'refused',
			reason: jsonOnly ? 'invalid-json' : 'invalid-format',
			issues: parsed.issues
		};
	}
	return admitSource(parsed.project, context);
}
