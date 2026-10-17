/**
 * T1.P01.S02 — source admission: **admission equals runtime preparation**.
 *
 * `src/lib/authoring/stage/source-admission.ts` is the one door a source passes
 * before the Stage mounts it. This suite pins the contract that door states:
 *
 * 1. a source is shown only when it passes the canonical validator **with the
 *    host's own Scene options** and resolves through the runtime Scene path —
 *    so a source the host's catalogue refuses cannot be admitted even though the
 *    option-less reader accepts it;
 * 2. the three outcomes are distinct and are never collapsed: `refused` (the
 *    payload is not a supported current-format source), `diagnostics` (it
 *    validates but its canonical compile has blocking issues) and `admitted`;
 * 3. only `admitted` yields a `StageReadSnapshot`, and that snapshot carries the
 *    caller's acceptance identity, the shared content identity and the domain
 *    read access the Stage draws;
 * 4. admission is a *read*: the supplied payload is not mutated.
 *
 * The blocking-compile source is the S03 sibling fixture
 * (`__fixtures__/f4-current-source-fixtures.ts`), the same thick partition whose
 * `wall_offset_fold` that suite already pins — reused rather than re-derived, so
 * one document describes the hazard.
 */
import { describe, expect, it } from 'vitest';

import { CURRENT_SOURCE_VERSION, validateProject as validateWithoutHostCatalogue } from '@portfolio/project-model';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { DEFAULT_STARTER_TEMPLATE } from '$lib/authoring/stage/starter-gallery';
import {
	admitSource,
	admitSourceJson,
	layoutDatumMeters,
	type AdmissionContext
} from '$lib/authoring/stage/source-admission';
import {
	FIXTURE_PROJECT_ID,
	FIXTURE_UNKNOWN_ASSET_ID,
	buildFoldedPartitionProject,
	buildUnknownAssetProject
} from './__fixtures__/f4-current-source-fixtures';

const PROJECT_ID = 'project-stage-admission';

/** One acceptance context for the project the host is showing. */
function contextFor(projectId: string = PROJECT_ID): AdmissionContext {
	return {
		sessionEpoch: 'session-stage-admission',
		acceptedRevision: { projectId, revisionId: 'revision-1' }
	};
}

const CONTEXT: AdmissionContext = contextFor();

/** The canonical starter enclosure: a real current-format source, built through the retained planner. */
function starterSource() {
	return DEFAULT_STARTER_TEMPLATE.build(PROJECT_ID, DEFAULT_STARTER_TEMPLATE.label);
}

describe('source admission', () => {
	it('admits a real current source with the caller identity, the shared content identity and a usable domain read', async () => {
		const project = starterSource();
		const before = JSON.stringify(project);

		const outcome = await admitSource(project, CONTEXT);

		expect(outcome.kind).toBe('admitted');
		if (outcome.kind !== 'admitted') return;
		const snapshot = outcome.snapshot;

		// The caller's acceptance identity is carried verbatim, and the host session
		// epoch stays separate from it.
		expect(snapshot.acceptedRevision).toEqual(CONTEXT.acceptedRevision);
		expect(snapshot.sessionEpoch).toBe(CONTEXT.sessionEpoch);
		// The admitted source kind/version are declared, and the version is the
		// landed current Layout format the project model names — never a literal
		// that could drift from a format cutover.
		expect(snapshot.sourceKind).toBe('project-current');
		expect(snapshot.sourceVersion).toBe(CURRENT_SOURCE_VERSION);
		// One content identity, digesting the canonical authored content, and the
		// compile/representation generation derived from it: every fragment this
		// host emits carries that generation.
		expect(snapshot.sourceContentId).toMatch(/^sha256-[0-9a-f]{64}$/);
		expect(snapshot.compileGeneration).toBe(`compile:${snapshot.sourceContentId}`);

		// Admission is a read: the payload the caller handed in is untouched.
		expect(JSON.stringify(project)).toBe(before);

		// The domain read access is real compiled/resolved data, not a promise: the
		// enclosure compiles to a Floor (the level the datum is taken from) and to
		// physical Walls. The exact Wall count is the compiler's topology, which the
		// Layout suites own; admission only has to have compiled something to draw.
		const domain = snapshot.domain;
		expect(domain.project.id).toBe(PROJECT_ID);
		expect(domain.geometry.floors).toHaveLength(1);
		expect(domain.geometry.walls.length).toBeGreaterThan(0);
		expect(domain.datumMeters).toBe(domain.geometry.floors[0]!.elevation);
		// The runtime Scene path ran: an empty world-local Scene and the graph it
		// yields, not a placeholder.
		expect(domain.scene.entities).toEqual([]);
		expect(domain.graph.connections).toEqual([]);
		// Warnings are disclosure, never admission. The snapshot's warning list must be
		// exactly the compiler's own warnings for the admitted Layout: a module that
		// dropped one, invented one or re-labelled a blocking issue as a warning fails
		// here. That equality is the claim — today the clean starter compile reports no
		// warnings, so asserting only "they are warnings" would hold on an empty list,
		// and the blocking half of the partition is pinned non-vacuously by the
		// `diagnostics` case below.
		const independent = compileWallFirstLayoutGeometry(domain.project.layout);
		const expectedWarnings = independent.issues.filter((issue) => issue.severity === 'warning');
		expect(domain.warnings.map((issue) => issue.code).sort()).toEqual(
			expectedWarnings.map((issue) => issue.code).sort()
		);
		expect(independent.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	});

	it('takes the datum from the compiled Floor and never invents one', async () => {
		const outcome = await admitSource(starterSource(), CONTEXT);
		expect(outcome.kind).toBe('admitted');
		if (outcome.kind !== 'admitted') return;
		const geometry = outcome.snapshot.domain.geometry;

		expect(layoutDatumMeters(geometry)).toBe(geometry.floors[0]!.elevation);
		// A compile with no Floor has nothing to measure against: the origin is the
		// declared fallback rather than a guessed elevation.
		expect(layoutDatumMeters({ ...geometry, floors: [] })).toBe(0);
	});

	it('refuses a structurally invalid payload with the validator\'s own issues', async () => {
		for (const payload of [{ id: PROJECT_ID, name: 'Broken', layout: { units: 'meters' } }, null]) {
			const outcome = await admitSource(payload, CONTEXT);
			expect(outcome.kind).toBe('refused');
			if (outcome.kind !== 'refused') continue;
			expect(outcome.reason).toBe('invalid-format');
			expect(outcome.issues.length).toBeGreaterThan(0);
		}
	});

	it('refuses a source the host\'s own Scene options refuse, though the option-less reader accepts it', async () => {
		const project = buildUnknownAssetProject();

		// The discriminating fact: without the host catalogue the identical document
		// validates, so this refusal is the host's own Scene options deciding.
		expect(validateWithoutHostCatalogue(project).success).toBe(true);

		const outcome = await admitSource(project, contextFor(FIXTURE_PROJECT_ID));

		expect(outcome.kind).toBe('refused');
		if (outcome.kind !== 'refused') return;
		expect(outcome.reason).toBe('invalid-format');
		// The refusal names the asset, so a refusal for an unrelated reason cannot
		// stand in for the host-catalogue decision this case exists to prove.
		expect(JSON.stringify(outcome.issues)).toContain(FIXTURE_UNKNOWN_ASSET_ID);
	});

	it('refuses a structurally valid document from an older format, naming the version', async () => {
		const current = starterSource();
		// The pair's version is what moves at a format cutover; every other field keeps
		// its shape, so only a reader that actually validates the version refuses this.
		const older = {
			...current,
			layout: { ...current.layout, formatVersion: CURRENT_SOURCE_VERSION - 1 }
		};

		// The option-less reader refuses it too — the point is that admission does, and
		// says which version it was given.
		expect(validateWithoutHostCatalogue(older).success).toBe(false);

		const outcome = await admitSource(older, CONTEXT);
		expect(outcome.kind).toBe('refused');
		if (outcome.kind !== 'refused') return;
		expect(outcome.reason).toBe('invalid-format');
		expect(outcome.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
		expect(Object.keys(outcome)).not.toContain('snapshot');
	});

	it('classifies text that does not parse as invalid-json and a parseable non-source as invalid-format', async () => {
		const unparseable = await admitSourceJson('{ not json', CONTEXT);
		expect(unparseable.kind).toBe('refused');
		if (unparseable.kind !== 'refused') return;
		expect(unparseable.reason).toBe('invalid-json');
		expect(unparseable.issues.length).toBeGreaterThan(0);

		const parseable = await admitSourceJson('{"id":"p","name":"empty","layout":{"units":"meters"}}', CONTEXT);
		expect(parseable.kind).toBe('refused');
		if (parseable.kind !== 'refused') return;
		expect(parseable.reason).toBe('invalid-format');
	});

	it('admits an explicit source-JSON open as the same source the in-memory entry admits', async () => {
		const project = starterSource();
		const direct = await admitSource(project, CONTEXT);
		expect(direct.kind).toBe('admitted');
		if (direct.kind !== 'admitted') return;

		// The "open a source JSON" entry goes through the same admission, so the two
		// entries cannot disagree about what the source *is*.
		const opened = await admitSourceJson(JSON.stringify(project), CONTEXT);
		expect(opened.kind).toBe('admitted');
		if (opened.kind !== 'admitted') return;
		expect(opened.snapshot.sourceContentId).toBe(direct.snapshot.sourceContentId);
		expect(opened.snapshot.compileGeneration).toBe(direct.snapshot.compileGeneration);
	});

	it('refuses a source that names another project than the one being shown', async () => {
		// The route is showing PROJECT_ID; this document is a valid current source for
		// a different project. Filing its bytes under this project's accepted revision
		// would mislabel both the source and its content identity.
		const foreign = buildFoldedPartitionProject();
		const outcome = await admitSource(foreign, CONTEXT);

		expect(outcome.kind).toBe('refused');
		if (outcome.kind !== 'refused') return;
		expect(outcome.reason).toBe('project-mismatch');
		expect(outcome.issues.map((issue) => issue.code)).toEqual(['project_mismatch']);
		expect(JSON.stringify(outcome.issues)).toContain(foreign.id);
		expect(Object.keys(outcome)).not.toContain('snapshot');
	});

	it('reports blocking compile issues as diagnostics and yields no snapshot at all', async () => {
		const outcome = await admitSource(buildFoldedPartitionProject(), contextFor(FIXTURE_PROJECT_ID));

		expect(outcome.kind).toBe('diagnostics');
		if (outcome.kind !== 'diagnostics') return;
		// The named issue is the compiler's own, not a host-invented reason.
		expect(outcome.issues.map((issue) => issue.code)).toContain('wall_offset_fold');
		expect(outcome.issues.every((issue) => issue.severity !== 'warning')).toBe(true);
		// The structural guarantee: this outcome cannot carry a Stage snapshot, so a
		// blocking source can never render a silent empty or partial Stage.
		expect(Object.keys(outcome)).not.toContain('snapshot');
	});
});
