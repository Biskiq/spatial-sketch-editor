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
import { createStageSession, runBoundLoad } from '$lib/authoring/stage/stage-session';
import { describe, expect, it, vi } from 'vitest';

import { MODEL_RESOURCE_MIME, SCENE_UNIT_FORMAT_VERSION, validateProjectEnvelope } from '@portfolio/project-model/units';
import {
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	createUnitAcceptanceAdapter,
	prepareUnitRuntime,
	readUnitEnvelopeForSave,
	serializeProjectEnvelope,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { compileWallFirstLayoutGeometry, LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';
import { stageEnvelope, stageLayout } from '$lib/authoring/stage/unit-stage-source';
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
	buildUnknownAssetProject,
	unknownAssetEntity
} from './__fixtures__/f4-current-source-fixtures';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';

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
function starterSource(context: AdmissionContext = CONTEXT) {
	return DEFAULT_STARTER_TEMPLATE.build(PROJECT_ID, DEFAULT_STARTER_TEMPLATE.label, context.acceptedRevision);
}

describe('source admission', () => {

	it('drops a form-heavy cold admission superseded at its real task boundary', async () => {
		const baseline = await admitSource(await starterSource(), CONTEXT);
		if (baseline.kind !== 'admitted') throw new Error('baseline refused');
		const forms = await createUnitProject({ id: PROJECT_ID, name: 'Yielding forms', scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [],
			entities: Array.from({ length: 32 }, (_, index) => ({ kind: 'form' as const, id: `yield-form-${index}`, name: 'Form',
				position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number],
				materialId: 'plaster-warm' as const, castShadow: true, receiveShadow: true,
				form: { generator: { kind: 'extrude' as const, plane: 'plan' as const, extent: 1, outline: [
					{ key: 1, u: 0, v: 0, smooth: false }, { key: 2, u: 1, v: 0, smooth: false }, { key: 3, u: 0, v: 1, smooth: false }
				] }, scale: [1, 1, 1] as [number, number, number], nextKey: 4 } }))
		} });
		const session = createStageSession({ sessionEpoch: CONTEXT.sessionEpoch });
		session.replace(baseline.snapshot);
		let resume: (() => void) | null = null;
		const realTimeout = globalThis.setTimeout;
		const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay?: number) => {
			if (delay === 0) { resume = callback; return 0; }
			return realTimeout(callback, delay);
		}) as typeof setTimeout);
		try {
			const pending = runBoundLoad(session, () => admitSource(forms, CONTEXT));
			expect(resume).not.toBeNull();
			// A newer replacement ends the production load lease while admission is
			// paused after strict validation. Its completion must remain uninstalled.
			session.replace(baseline.snapshot);
			timer.mockRestore();
			(resume as unknown as () => void)();
			expect(await pending).toBeNull();
			expect(session.current()).toBe(baseline.snapshot);
		} finally { timer.mockRestore(); session.dispose(); }
	});

	it('admits a real current source with the caller identity, the shared content identity and a usable domain read', async () => {
		const project = await starterSource();
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
		expect(snapshot.sourceKind).toBe('unit-envelope');
		expect(snapshot.sourceVersion).toBe(1);
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
		expect(stageEnvelope(snapshot).id).toBe(PROJECT_ID);
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
		const independent = compileWallFirstLayoutGeometry(stageLayout(snapshot));
		const expectedWarnings = independent.issues.filter((issue) => issue.severity === 'warning');
		expect(domain.warnings.map((issue) => issue.code).sort()).toEqual(
			expectedWarnings.map((issue) => issue.code).sort()
		);
		expect(independent.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	});

	it('takes the datum from the compiled Floor and never invents one', async () => {
		const outcome = await admitSource(await starterSource(), CONTEXT);
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
		const project = await buildUnknownAssetProject();

		// The discriminating fact: without the host catalogue the identical document
		// validates, so this refusal is the host's own Scene options deciding.
		expect(validateProjectEnvelope(project).success).toBe(true);

		const outcome = await admitSource(project, contextFor(FIXTURE_PROJECT_ID));

		expect(outcome.kind).toBe('refused');
		if (outcome.kind !== 'refused') return;
		expect(outcome.reason).toBe('invalid-format');
		// The refusal names the asset, so a refusal for an unrelated reason cannot
		// stand in for the host-catalogue decision this case exists to prove.
		expect(JSON.stringify(outcome.issues)).toContain(FIXTURE_UNKNOWN_ASSET_ID);
	});

	it('refuses a structurally valid document from an older format, naming the version', async () => {
		const current = await starterSource();
		// The Layout payload's version is what moves at a format cutover; every other
		// field keeps its shape, so only a reader that actually validates the version
		// refuses this.
		const older = {
			...current,
			units: {
				...current.units,
				layout: {
					...current.units.layout,
					data: { ...current.units.layout.data, formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION - 1 }
				}
			}
		};

		// The option-less reader refuses it too — the point is that admission does, and
		// says which version it was given.
		expect(validateProjectEnvelope(older).success).toBe(false);

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
		const project = await starterSource();
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
		const foreign = await buildFoldedPartitionProject();
		const outcome = await admitSource(foreign, CONTEXT);

		expect(outcome.kind).toBe('refused');
		if (outcome.kind !== 'refused') return;
		expect(outcome.reason).toBe('project-mismatch');
		expect(outcome.issues.map((issue) => issue.code)).toEqual(['project_mismatch']);
		expect(JSON.stringify(outcome.issues)).toContain(foreign.id);
		expect(Object.keys(outcome)).not.toContain('snapshot');
	});

	it('reports blocking compile issues as diagnostics and yields no snapshot at all', async () => {
		const outcome = await admitSource(await buildFoldedPartitionProject(), contextFor(FIXTURE_PROJECT_ID));

		expect(outcome.kind).toBe('diagnostics');
		if (outcome.kind !== 'diagnostics') return;
		// The named issue is the compiler's own, not a host-invented reason.
		expect(outcome.issues.map((issue) => issue.code)).toContain('wall_offset_fold');
		expect(outcome.issues.every((issue) => issue.severity !== 'warning')).toBe(true);
		// The structural guarantee: this outcome cannot carry a Stage snapshot, so a
		// blocking source can never render a silent empty or partial Stage.
		expect(Object.keys(outcome)).not.toContain('snapshot');
	});

	it('admits and discloses an executable-closure source without fabricating a resource', async () => {
		const PIN = { hash: 'sha256-paper', mime: 'image/png', size: 512, locator: 'objects/paper' } as const;
		const source: ProjectEnvelope = {
			...await starterSource(),
			dependencyLock: {
				formatVersion: 1,
				entries: [
					{
						domain: 'resource:texture',
						subjectKind: 'resource',
						subjectId: 'paper',
						instancePath: [],
						contentRevision: PIN.hash,
						requiredCapabilities: [],
						pin: PIN
					}
				]
			}
		};

		// Preparation is not a structural refusal: the envelope is readable, and the
		// closure it cannot satisfy travels as its own answer.
		const prepared = prepareUnitRuntime(source);
		expect(prepared.kind).toBe('ready');
		if (prepared.kind !== 'ready') return;
		expect(prepared.diagnostics).toEqual([]);
		expect(prepared.closure.map((finding) => finding.code)).toEqual(['missing-resource']);

		// The editor admits the source for reading and discloses the closure. It
		// neither invents the missing resource nor rewrites the lock it authored.
		const outcome = await admitSource(source, CONTEXT);
		expect(outcome.kind).toBe('admitted');
		if (outcome.kind !== 'admitted') return;
		expect(outcome.snapshot.domain.closure.map((finding) => finding.code)).toEqual(['missing-resource']);
		expect(outcome.snapshot.domain.diagnostics).toEqual([]);
		expect(stageEnvelope(outcome.snapshot).units.resources.data.resources).toEqual([]);
		expect(stageEnvelope(outcome.snapshot).dependencyLock).toEqual(source.dependencyLock);

		// Execution refuses it: F4 acceptance and Save are the closure boundary.
		const admitted = await createUnitAcceptanceAdapter({ compound: true }).admit(source, []);
		expect(admitted.kind).toBe('rejected');
		if (admitted.kind === 'rejected') {
			expect(admitted.code).toBe('lock-closure');
			expect(admitted.issues.map((issue) => issue.code)).toContain('missing');
		}
		const read = await readUnitEnvelopeForSave(serializeProjectEnvelope(source));
		expect(read.kind).toBe('refused');
		if (read.kind === 'refused') {
			expect(read.code).toBe('invalid-project');
			expect(read.issues.map((issue) => issue.code)).toContain('missing-resource');
		}
	});

	it('keeps a known catalogue model with missing bytes inspectable but refuses execution', async () => {
		const source = await createUnitProject({
			id: PROJECT_ID,
			name: 'Missing model resource',
			scene: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [
				{ ...unknownAssetEntity(), assetId: 'paris-grand-piano' }
			] }
		});
		const structural = validateProjectEnvelope(source);
		expect(structural.success).toBe(true);
		const admitted = await admitSource(source, CONTEXT);
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;
		expect(admitted.snapshot.domain.closure).toEqual([
			expect.objectContaining({ code: 'missing-resource', message: expect.stringContaining('paris-grand-piano') })
		]);
		expect(stageEnvelope(admitted.snapshot).units.resources.data.resources).toEqual([]);
		expect(stageEnvelope(admitted.snapshot).dependencyLock.entries).toEqual([]);
		expect((await createUnitAcceptanceAdapter({ compound: true }).admit(source, [])).kind).toBe('rejected');
		expect((await readUnitEnvelopeForSave(serializeProjectEnvelope(source))).kind).toBe('refused');
	});

	it('admits a Scene model naming this envelope’s approved model resource, not only the host catalogue', async () => {
		const hash = `sha256-${'a'.repeat(64)}`;
		const resource = {
			kind: 'model' as const,
			id: 'creator-model-piano',
			contentRevision: hash,
			pin: { hash, mime: MODEL_RESOURCE_MIME, size: 1024, locator: `/projects/${PROJECT_ID}/models/content/${hash}` },
			unresolved: null,
			model: {
				source: { manifestHash: `sha256-${'b'.repeat(64)}`, size: 2048, fileCount: 2 },
				recipe: { id: 'creator-import', version: 1 },
				reportDigest: `sha256-${'c'.repeat(64)}`,
				placement: {
					metresPerSourceUnit: 0.5,
					pivot: [0, 0, 0] as [number, number, number],
					footprint: { width: 1.2, depth: 0.8 },
					contactMinY: 0,
					placement: 'floor' as const
				}
			}
		};
		const base = await createUnitProject({
			id: PROJECT_ID,
			name: 'Creator model resource',
			scene: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: [{ ...unknownAssetEntity(), assetId: resource.id, fallback: 'generic' }]
			},
			resources: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resource] }
		});
		const source: ProjectEnvelope = {
			...base,
			dependencyLock: {
				formatVersion: 1,
				entries: [
					{
						domain: 'resource:model',
						subjectKind: 'resource',
						subjectId: resource.id,
						instancePath: [],
						contentRevision: hash,
						requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
						pin: resource.pin
					}
				]
			}
		};

		// The museum catalogue cannot know a creator model; admission resolves the id
		// against this envelope's own resource registry instead.
		const outcome = await admitSource(source, CONTEXT);
		expect(outcome.kind).toBe('admitted');
		if (outcome.kind !== 'admitted') return;
		expect(outcome.snapshot.domain.closure).toEqual([]);
		expect(outcome.snapshot.domain.scene.objects.map((object) => object.assetId)).toEqual([resource.id]);
		// The approved footprint reaches rendering as read-projection data.
		expect(outcome.snapshot.domain.scene.modelFootprints?.get(resource.id)).toEqual({
			width: resource.model.placement.footprint.width,
			depth: resource.model.placement.footprint.depth
		});

		const accepted = await createUnitAcceptanceAdapter({ compound: true, resourceStaging: true }).admit(source, []);
		expect(accepted.kind).toBe('admitted');
		expect((await readUnitEnvelopeForSave(serializeProjectEnvelope(source))).kind).toBe('read');
	});

	it('discloses repairable authored diagnostics without blocking admission, acceptance or Save', async () => {
		const experience: ExperienceUnitPayload = {
			formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
			experiences: [
				{
					id: 'experience-a',
					label: 'Experience A',
					entryGuideId: 'guide-1',
					presentations: [
						{
							id: 'presentation-1',
							label: 'Entry',
							viewIds: ['view-absent'],
							defaultViewId: 'view-absent',
							subject: null,
							text: null
						}
					],
					stops: [
						{
							id: 'stop-1',
							presentationId: 'presentation-1',
							holdSeconds: 0,
							continuation: { kind: 'end' }
						}
					],
					guides: [{ id: 'guide-1', label: 'Guide', stopIds: ['stop-1'], entryStopId: 'stop-1' }],
					gates: [],
					detours: []
				}
			]
		};
		const source = await createUnitProject({ id: PROJECT_ID, name: 'Repairable', experience });

		const prepared = prepareUnitRuntime(source);
		expect(prepared.kind).toBe('ready');
		if (prepared.kind !== 'ready') return;
		expect(prepared.diagnostics.map((finding) => finding.code)).toEqual(['unresolved-view']);
		expect(prepared.closure).toEqual([]);

		const outcome = await admitSource(source, CONTEXT);
		expect(outcome.kind).toBe('admitted');
		if (outcome.kind !== 'admitted') return;
		expect(outcome.snapshot.domain.diagnostics.map((finding) => finding.code)).toEqual(['unresolved-view']);
		expect(outcome.snapshot.domain.closure).toEqual([]);

		// The binding is preserved as authored; admission does not resolve it by
		// inventing a Camera view, and the non-blocking diagnostic does not become a
		// closure finding.
		expect(stageEnvelope(outcome.snapshot).units.camera.data.views).toEqual([]);
		expect((await createUnitAcceptanceAdapter({ compound: true }).admit(source, [])).kind).toBe('admitted');
		expect((await readUnitEnvelopeForSave(serializeProjectEnvelope(source))).kind).toBe('read');
	});
});
