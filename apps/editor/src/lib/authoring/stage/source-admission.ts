/**
 * Source admission — **admission equals runtime preparation**.
 *
 * A source is shown only when it is one valid F.2 envelope, prepares through the
 * one unit runtime (canonical Layout compile, Scene resolve, Camera-unit graph),
 * and its canonical compile has no blocking issue. That is exactly the shape the
 * visitor runtime uses, so a source the editor shows is a source a visitor can
 * prepare.
 *
 * Three distinct outcomes, deliberately not collapsed:
 *
 * - `refused` — the envelope validator rejected the payload (malformed,
 *   pre-epoch, unknown version). The viewer is told it is not a supported
 *   source; the Stage never renders.
 * - `diagnostics` — the payload validates, but its canonical compile has blocking
 *   issues. The Stage never renders a silent empty or partial scene.
 * - `admitted` — validated, compiled clean, Scene resolved, Camera graph built,
 *   content identity computed. This is the only outcome that yields a
 *   `StageReadSnapshot`.
 *
 * The content identity is the envelope source-content digest, so boot, local
 * acceptance and the server-side conditional Save cannot disagree about what
 * "the same content" means.
 *
 * Runtime-safe, pure and read-only: nothing here writes a project, calls
 * `saveProject`, or mutates the supplied payload.
 */
import {
	hasBlockingLayoutIssues,
	measureWorkAsync,
	p2311Measure,
	type CompiledLayoutGeometry,
	type LayoutCompileSession,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import {
	freezeF4Data,
	type AcceptedRevision,
	type ProjectIssue,
	type ShapeIssue
} from '@portfolio/project-model';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';
import {
	computeEnvelopeSourceContentId,
	prepareValidatedUnitRuntime,
	serializeValidatedProjectEnvelope,
	validateProjectEnvelope,
	UNIT_ENVELOPE_SOURCE_KIND,
	UNIT_ENVELOPE_SOURCE_VERSION,
	type ProjectEnvelope,
	type UnitDomain,
	type UnitRuntimeReady
} from '@portfolio/project-model/units';

import { MUSEUM_SCENE_VALIDATION_OPTIONS } from '$lib/content/scene-validation';

import type { StageDomainRead, StageReadSnapshot } from './accepted-read';
export type { StageDomainRead, StageReadSnapshot } from './accepted-read';
import { attachUnitStageSource } from './unit-stage-source';

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

const UNIT_DOMAINS: readonly UnitDomain[] = ['layout', 'scene', 'camera', 'experience', 'resources'];

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

function domainOf(
	envelope: ProjectEnvelope,
	sourceContentId: string,
	context: AdmissionContext,
	runtime: UnitRuntimeReady
): StageDomainRead {
	const unitRevisions = Object.fromEntries(
		UNIT_DOMAINS.map((domain) => [domain, envelope.units[domain].header.contentRevision])
	) as Record<UnitDomain, string>;
	return {
		name: envelope.name,
		references: createUnitReadContext({
			envelope,
			acceptedRevision: context.acceptedRevision,
			sourceContentId,
			sessionEpoch: context.sessionEpoch,
			generationId: compileGenerationOf(sourceContentId)
		}),
		geometry: runtime.geometry,
		layoutLevelId: envelope.units.layout.data.floor.id,
		datumMeters: layoutDatumMeters(runtime.geometry),
		scene: runtime.runtimeScene,
		rooms: runtime.rooms,
		graph: runtime.graph,
		unitRevisions,
		warnings: runtime.issues.filter((issue) => issue.severity === 'warning'),
		diagnostics: runtime.diagnostics,
		closure: runtime.closure
	};
}

function snapshotOf(
	envelope: ProjectEnvelope,
	sourceContentId: string,
	canonicalJson: string,
	context: AdmissionContext,
	domain: StageDomainRead
): StageReadSnapshot {
	void canonicalJson;
	return attachUnitStageSource(
		{
			acceptedRevision: context.acceptedRevision,
			sourceContentId,
			canonicalJson,
			sessionEpoch: context.sessionEpoch,
			sourceKind: UNIT_ENVELOPE_SOURCE_KIND,
			sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
			compileGeneration: compileGenerationOf(sourceContentId),
			domain
		},
		envelope
	);
}

const HOST_SCENE_OPTIONS = MUSEUM_SCENE_VALIDATION_OPTIONS;

/**
 * The host's catalogue plus this envelope's own approved creator models.
 *
 * The policy belongs here, at the editor's admission door, not in the shared
 * unit runtime: a visitor or release host that calls `prepareUnitRuntime` keeps
 * its own catalogue predicate and therefore refuses an id it cannot deliver.
 */
function sceneOptionsFor(envelope: ProjectEnvelope): typeof HOST_SCENE_OPTIONS {
	const modelIds = new Set(
		envelope.units.resources.data.resources
			.filter((resource) => resource.kind === 'model' && resource.pin !== null)
			.map((resource) => resource.id)
	);
	if (modelIds.size === 0) return HOST_SCENE_OPTIONS;
	const catalogue = HOST_SCENE_OPTIONS.isKnownAssetId;
	return {
		...HOST_SCENE_OPTIONS,
		isKnownAssetId: (assetId: string) => catalogue(assetId) || modelIds.has(assetId)
	};
}

function projectIssues(issues: readonly ShapeIssue[]): ProjectIssue[] {
	return issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message }));
}

/**
 * Admit an already-parsed payload.
 *
 * The whole path is one envelope validation plus one unit runtime preparation —
 * never a second decode for the editor.
 */
export async function admitSource(
	input: unknown,
	context: AdmissionContext,
	/**
	 * The caller's incremental compile store, if it owns one.
	 *
	 * A Stage lifetime keeps one store and passes it on every admission, so the
	 * compile after an accepted edit rebuilds only the Layout entities that edit
	 * moved (T1.P02.S06 D.3 / H1). The result is the canonical compiler's own
	 * output; nothing about admission's verdict changes. Boot, Preview and the
	 * visitor runtime pass nothing and keep the cold compile.
	 */
	options: { readonly compileSession?: LayoutCompileSession } = {}
): Promise<AdmissionOutcome> {
	// Harness-gated stage span (inert without the work observer).
	return measureWorkAsync('admission', () => admitSourceOnce(input, context, options.compileSession));
}

async function admitSourceOnce(
	input: unknown,
	context: AdmissionContext,
	compileSession?: LayoutCompileSession
): Promise<AdmissionOutcome> {
	// Read the envelope once so the host policy can see its model registry before
	// Scene resolution, then prepare **that validated value**: preparation splits
	// into a validating entry point and this validated half, so admission's own
	// validation is not immediately repeated over the same bytes (D.1/H2).
	const read = validateProjectEnvelope(input);
	if (!read.success) return { kind: 'refused', reason: 'invalid-format', issues: projectIssues(read.issues) };
	const prepared = p2311Measure('admission:runtime', () =>
		prepareValidatedUnitRuntime(read, sceneOptionsFor(read.envelope), compileSession)
	);
	if (prepared.kind === 'rejected') {
		return { kind: 'refused', reason: 'invalid-format', issues: projectIssues(prepared.issues) };
	}
	const envelope = prepared.envelope;
	if (envelope.id !== context.acceptedRevision.projectId) {
		return {
			kind: 'refused',
			reason: 'project-mismatch',
			issues: [
				{
					path: '$.id',
					code: 'project_mismatch',
					message: `the source names project "${envelope.id}", not "${context.acceptedRevision.projectId}"`
				}
			]
		};
	}
	if (hasBlockingLayoutIssues(prepared.issues)) {
		return {
			kind: 'diagnostics',
			issues: prepared.issues.filter((issue) => issue.severity !== 'warning')
		};
	}

	// The canonical form is computed once here: its bytes are both what the content
	// identity describes and what the host records as the accepted baseline. The
	// value being serialized is the one `validateProjectEnvelope` returned, so the
	// serializer does not validate it a third time to trust it.
	const sourceContentId = await measureWorkAsync('admission:digest', () => computeEnvelopeSourceContentId(envelope));
	const canonicalJson = p2311Measure('admission:serialize', () => serializeValidatedProjectEnvelope(envelope));
	const domain = domainOf(envelope, sourceContentId, context, prepared);
	p2311Measure('admission:freeze', () => freezeF4Data(domain));
	return { kind: 'admitted', snapshot: snapshotOf(envelope, sourceContentId, canonicalJson, context, domain) };
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
	let parsed: unknown;
	try {
		parsed = p2311Measure('admission:parse', () => JSON.parse(json) as unknown);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
		return {
			kind: 'refused',
			reason: 'invalid-json',
			issues: [{ path: '$', code: 'invalid_json', message }]
		};
	}
	return admitSource(parsed, context);
}
