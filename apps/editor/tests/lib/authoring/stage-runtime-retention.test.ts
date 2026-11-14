/**
 * E2 (G2 + I4) — retained runtime units.
 *
 * Hard rule 2 says Camera and Scene are distinct authorities. This suite pins
 * both halves of E2 at the boundaries that can see them:
 *
 * 1. **I4** — the prepared runtime is a Camera-free `RuntimeScene` plus a
 *    Camera-owned navigation value. The guard for that lives in the
 *    `project-model` boundary suite; here the split is exercised through
 *    `admitSource`, the one admission door.
 * 2. **G2** — an accepted edit that does not touch a unit reuses that unit's
 *    prepared value. A Wall-only, Camera-only or Experience-only edit performs
 *    zero Scene resolution; a Camera-only edit performs one navigation
 *    resolution and a Scene-only edit none.
 * 3. The retained value is never a stale one: every retained result equals a
 *    fresh preparation of the same envelope, and a history restore reinstalls
 *    the exact runtime the host still holds.
 *
 * The counts are E0's production counters read through their real call sites
 * (`scene:resolve` in unit runtime preparation, `navigation:resolve` beside it),
 * never asserted from a test-only counter call.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLayoutCompileSession } from '@portfolio/layout-core';
import type { DomainPlanner } from '@portfolio/project-model';
import {
	computeUnitContentRevision,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	prepareUnitRuntime,
	type ExperienceUnitPayload,
	type ProjectEnvelope,
	type RetainedUnitRuntime
} from '@portfolio/project-model/units';

import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { DEFAULT_STARTER_TEMPLATE } from '$lib/authoring/stage/starter-gallery';
import { admitSource, type StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';

import { startStageCounting } from '../../helpers/stage-counts';
import {
	buildCountingSceneFixture,
	COUNTING_PROJECT_ID,
	type CountingSceneFixture
} from './__fixtures__/counting-scene';

const SESSION_EPOCH = 'session-e2-retention';
const WALL_EDIT_KIND = 'e2-layout-wall-height';

type AdmissionCapture = {
	readonly snapshot: StageReadSnapshot;
	readonly counts: Record<string, number>;
};

function context(revisionId: string) {
	return {
		sessionEpoch: SESSION_EPOCH,
		acceptedRevision: { projectId: COUNTING_PROJECT_ID, revisionId }
	};
}

/** Admit one envelope with its own counter window. */
async function admit(
	envelope: ProjectEnvelope,
	revisionId: string,
	previous?: RetainedUnitRuntime
): Promise<AdmissionCapture> {
	const seam = startStageCounting();
	try {
		const outcome = await admitSource(
			envelope,
			context(revisionId),
			previous === undefined ? {} : { previousRuntime: previous }
		);
		if (outcome.kind !== 'admitted') {
			throw new Error(`expected an admitted source, got ${outcome.kind}`);
		}
		return { snapshot: outcome.snapshot, counts: seam.counts() };
	} finally {
		seam.stop();
	}
}

/** One named count from an admission window; a counter that never fired is zero. */
function countOf(counts: Record<string, number>, name: string): number {
	return counts[name] ?? 0;
}

/** What the Stage host offers preparation: the mounted runtime and its units. */
function retained(snapshot: StageReadSnapshot): RetainedUnitRuntime {
	return {
		envelope: stageEnvelope(snapshot),
		runtimeScene: snapshot.domain.scene,
		graph: snapshot.domain.graph
	};
}

/** Replace one authored unit, with the header revision its data actually has. */
async function withUnit(
	base: ProjectEnvelope,
	domain: 'layout' | 'camera' | 'experience' | 'scene' | 'resources',
	data: ProjectEnvelope['units'][typeof domain]['data']
): Promise<ProjectEnvelope> {
	const contentRevision = await computeUnitContentRevision(data);
	return {
		...base,
		units: { ...base.units, [domain]: { header: { ...base.units[domain].header, contentRevision }, data } }
	} as ProjectEnvelope;
}

/**
 * One Experience with an unresolved presentation view.
 *
 * The unresolved binding is disclosure, not refusal: it keeps the fixture's
 * Experience unit small while still giving an Experience-only edit real content
 * to change.
 */
const EXPERIENCE: ExperienceUnitPayload = {
	formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
	experiences: [
		{
			id: 'experience-e2',
			label: 'E2 experience',
			welcome: null,
			entryGuideId: 'guide-e2',
			presentations: [
				{
					id: 'presentation-e2',
					label: 'E2 presentation',
					views: [{ viewId: 'view-e2-absent' }],
					explorable: true,
					subject: null,
					text: null
				}
			],
			stops: [
				{
					id: 'stop-e2',
					presentationId: 'presentation-e2',
					entryViewId: null,
					staySeconds: 5,
					invitation: null,
					transition: 'cut'
				}
			],
			guides: [{ id: 'guide-e2', label: 'Guide', stopIds: ['stop-e2'], pacing: 'automatic' }],
			detours: []
		}
	]
};

let fixture: CountingSceneFixture;
let baseline: ProjectEnvelope;
let baselineAdmission: AdmissionCapture;

beforeAll(async () => {
	fixture = await buildCountingSceneFixture();
	baseline = await withUnit(fixture.project, 'experience', EXPERIENCE);
	baselineAdmission = await admit(baseline, 'revision-boot');
}, 60_000);

describe('G2 — per-unit retention by unit content identity', () => {
	it('resolves both runtime values once on a cold admission', () => {
		expect(baselineAdmission.counts['scene:resolve']).toBe(1);
		expect(baselineAdmission.counts['navigation:resolve']).toBe(1);
		expect(baselineAdmission.snapshot.domain.graph.navigationNodes).toEqual([]);
	});

	it('a Layout-only (Wall) edit reuses the Scene and navigation values', async () => {
		const layout = baseline.units.layout.data;
		const wallId = layout.walls[0]!.id;
		const edited = await withUnit(
			baseline,
			'layout',
			{
				...layout,
				walls: layout.walls.map((wall) =>
					wall.id === wallId ? { ...wall, height: wall.height + 0.05 } : wall
				)
			} as typeof layout
		);

		const next = await admit(edited, 'revision-wall', retained(baselineAdmission.snapshot));

		expect(countOf(next.counts, 'scene:resolve')).toBe(0);
		expect(countOf(next.counts, 'navigation:resolve')).toBe(0);
		expect(next.snapshot.domain.scene).toBe(baselineAdmission.snapshot.domain.scene);
		expect(next.snapshot.domain.graph).toBe(baselineAdmission.snapshot.domain.graph);
	});

	it('a Camera-only edit reuses the Scene and re-resolves navigation', async () => {
		const camera = baseline.units.camera.data;
		const edited = await withUnit(baseline, 'camera', {
			...camera,
			views: [
				...camera.views,
				{
					id: 'view-e2',
					label: 'E2 view',
					eye: [1, 2, 3] as [number, number, number],
					target: [1, 2, 4] as [number, number, number],
					fov: 60,
					connectedViewIds: []
				}
			]
		});

		const next = await admit(edited, 'revision-camera', retained(baselineAdmission.snapshot));

		expect(countOf(next.counts, 'scene:resolve')).toBe(0);
		expect(countOf(next.counts, 'navigation:resolve')).toBeGreaterThan(0);
		expect(next.snapshot.domain.scene).toBe(baselineAdmission.snapshot.domain.scene);
		expect(next.snapshot.domain.graph).not.toBe(baselineAdmission.snapshot.domain.graph);
		expect(next.snapshot.domain.graph.navigationNodes.map((node) => node.id)).toEqual(['view-e2']);
	});

	it('an Experience-only edit reuses both runtime values', async () => {
		const edited = await withUnit(baseline, 'experience', {
			...baseline.units.experience.data,
			experiences: baseline.units.experience.data.experiences.map((experience) => ({
				...experience,
				label: 'Renamed experience'
			}))
		} as ExperienceUnitPayload);

		const next = await admit(edited, 'revision-experience', retained(baselineAdmission.snapshot));

		expect(countOf(next.counts, 'scene:resolve')).toBe(0);
		expect(countOf(next.counts, 'navigation:resolve')).toBe(0);
		expect(next.snapshot.domain.scene).toBe(baselineAdmission.snapshot.domain.scene);
		expect(next.snapshot.domain.graph).toBe(baselineAdmission.snapshot.domain.graph);
	});

	it('a Scene-only edit reuses navigation and resolves the Scene', async () => {
		const scene = baseline.units.scene.data;
		const edited = await withUnit(baseline, 'scene', {
			...scene,
			entities: scene.entities.map((entity, index) =>
				index === 0 ? { ...entity, name: 'Renamed by E2' } : entity
			)
		});

		const next = await admit(edited, 'revision-scene', retained(baselineAdmission.snapshot));

		expect(countOf(next.counts, 'scene:resolve')).toBeGreaterThan(0);
		expect(countOf(next.counts, 'navigation:resolve')).toBe(0);
		expect(next.snapshot.domain.scene).not.toBe(baselineAdmission.snapshot.domain.scene);
		expect(next.snapshot.domain.graph).toBe(baselineAdmission.snapshot.domain.graph);
	});

	it('a resources-only edit re-resolves the Scene the resource feeds', async () => {
		// The resolved Scene carries the resources unit's approved model footprints,
		// so it is not enough for the Scene unit to be unchanged: a resource edit that
		// moves a footprint must resolve again. Omitting the resources input from the
		// retention decision leaves the old footprint here and fails this difference.
		const hash = `sha256-${'a'.repeat(64)}`;
		const modelResource = (width: number) => ({
			kind: 'model' as const,
			id: 'e2-creator-model',
			contentRevision: hash,
			pin: {
				hash,
				mime: MODEL_RESOURCE_MIME,
				size: 1024,
				locator: `/projects/${COUNTING_PROJECT_ID}/models/content/${hash}`
			},
			unresolved: null,
			model: {
				source: { manifestHash: `sha256-${'b'.repeat(64)}`, size: 2048, fileCount: 2 },
				recipe: { id: 'creator-import', version: 1 },
				reportDigest: `sha256-${'c'.repeat(64)}`,
				placement: {
					metresPerSourceUnit: 0.5,
					pivot: [0, 0, 0] as [number, number, number],
					footprint: { width, depth: 0.8 },
					contactMinY: 0,
					placement: 'floor' as const
				}
			}
		});
		const resourcesWith = (width: number) => ({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [modelResource(width)]
		});

		const withResource = await withUnit(baseline, 'resources', resourcesWith(1.2));
		const before = await admit(withResource, 'revision-resource-before');
		expect(before.snapshot.domain.scene.modelFootprints?.get('e2-creator-model')?.width).toBe(1.2);

		const movedFootprint = await withUnit(withResource, 'resources', resourcesWith(2.4));
		const after = await admit(
			movedFootprint,
			'revision-resource-after',
			retained(before.snapshot)
		);

		expect(countOf(after.counts, 'scene:resolve')).toBeGreaterThan(0);
		expect(after.snapshot.domain.scene.modelFootprints?.get('e2-creator-model')?.width).toBe(2.4);
		const fresh = prepareUnitRuntime(movedFootprint);
		if (fresh.kind !== 'ready') throw new Error('the resource-edited source did not prepare fresh');
		expect(after.snapshot.domain.scene).toEqual(fresh.runtimeScene);
	});

	it('never returns a retained value that differs from a fresh preparation', async () => {
		const layout = baseline.units.layout.data;
		const wallId = layout.walls[0]!.id;
		const variants: ProjectEnvelope[] = [
			await withUnit(baseline, 'layout', {
				...layout,
				walls: layout.walls.map((wall) =>
					wall.id === wallId ? { ...wall, height: wall.height + 0.05 } : wall
				)
			} as typeof layout),
			await withUnit(baseline, 'camera', {
				...baseline.units.camera.data,
				views: [
					...baseline.units.camera.data.views,
					{
						id: 'view-e2-fresh',
						label: 'Fresh',
						eye: [0, 1, 0] as [number, number, number],
						target: [0, 1, 1] as [number, number, number],
						fov: 60,
						connectedViewIds: []
					}
				]
			}),
			await withUnit(baseline, 'experience', {
				...baseline.units.experience.data,
				experiences: baseline.units.experience.data.experiences.map((experience) => ({
					...experience,
					label: 'Fresh differential'
				}))
			} as ExperienceUnitPayload)
		];

		let previous = retained(baselineAdmission.snapshot);
		for (const [index, variant] of variants.entries()) {
			const retainedAdmission = await admit(variant, `revision-differential-${index}`, previous);
			const fresh = prepareUnitRuntime(variant);
			if (fresh.kind !== 'ready') throw new Error('the fresh preparation was rejected');
			expect(retainedAdmission.snapshot.domain.scene).toEqual(fresh.runtimeScene);
			expect(retainedAdmission.snapshot.domain.graph.navigationNodes).toEqual(
				fresh.graph.navigationNodes
			);
			expect(retainedAdmission.snapshot.domain.graph.connections).toEqual(fresh.graph.connections);
			previous = retained(retainedAdmission.snapshot);
		}
	});
});

/** One test-only Layout planner: change one Wall's height. */
function wallHeightPlanner(wallId: string): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'e2.layout-wall-height',
		kind: WALL_EDIT_KIND,
		admission: { domain: 'layout', compound: false, units: false, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare({ snapshot, intent }) {
			const source = snapshot.domain.source;
			const layout = source.units.layout.data;
			const walls = layout.walls.map((wall) =>
				wall.id === wallId ? { ...wall, height: wall.height + 0.05 } : wall
			);
			return {
				kind: 'prepared',
				candidate: {
					operationId: intent.operationId,
					sourceKind: UNIT_SOURCE_KIND,
					sourceVersion: UNIT_SOURCE_VERSION,
					source: {
						...source,
						units: {
							...source.units,
							layout: { header: { ...source.units.layout.header }, data: { ...layout, walls } }
						}
					} as ProjectEnvelope,
					changes: [{ kind: 'layout-wall-height', subjectIds: [wallId], fields: ['height'] }],
					correspondence: [],
					diagnostics: []
				}
			};
		}
	};
}

type Mounted = {
	readonly facade: StageFacade;
	readonly host: StageAcceptanceHost;
	readonly snapshot: StageReadSnapshot;
};

/**
 * Mount the real host over the canonical starter enclosure.
 *
 * The counting fixture carries catalogue models without staged resources, which
 * admission treats as an executable closure — correct, but F4 acceptance refuses
 * it. The starter enclosure is the smallest accepted source with real Walls, so
 * it is what a Wall accept is mounted against here.
 */
async function mountHost(): Promise<Mounted> {
	const revision = { projectId: COUNTING_PROJECT_ID, revisionId: 'revision-host-boot' };
	const source = await DEFAULT_STARTER_TEMPLATE.build(COUNTING_PROJECT_ID, 'E2 host', revision);
	const boot = await admit(source, revision.revisionId);
	const session = createStageSession({ sessionEpoch: SESSION_EPOCH });
	session.replace(boot.snapshot);
	const facade = createStageFacade({ snapshot: boot.snapshot, session });
	facade.acquireInspection('exclusive');
	const wallId = source.units.layout.data.walls[0]!.id;
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: SESSION_EPOCH,
		baseline: {
			revision: boot.snapshot.acceptedRevision,
			source: stageEnvelope(boot.snapshot),
			canonicalJson: boot.snapshot.canonicalJson,
			sourceContentId: boot.snapshot.sourceContentId
		},
		planners: [wallHeightPlanner(wallId)]
	});
	return { facade, host, snapshot: boot.snapshot };
}

function wallIntent(host: StageAcceptanceHost, operationId: string) {
	const revision = host.acceptedRevision();
	return {
		version: 1 as const,
		kind: WALL_EDIT_KIND,
		operationId,
		expectedRevision: revision,
		targets: [],
		payload: {},
		capturedInputs: [],
		allocatedIds: []
	};
}

describe('G2 — the acceptance host hands the previous runtime back', () => {
	it('a mounted Wall edit performs zero Scene work, and history restores the exact runtime', async () => {
		const { facade, host, snapshot } = await mountHost();
		const seam = startStageCounting();
		try {
			const outcome = await host.accept(wallIntent(host, 'e2-op-wall'));
			expect(outcome.kind, JSON.stringify(outcome)).toBe('installed');
			expect(seam.count('scene:resolve')).toBe(0);
			expect(seam.count('navigation:resolve')).toBe(0);

			const after = facade.snapshot();
			expect(after.domain.scene).toBe(snapshot.domain.scene);
			expect(after.domain.graph).toBe(snapshot.domain.graph);
			// The accepted source really did move the Layout unit, so the reuse above
			// is retention, not a no-op install.
			expect(stageEnvelope(after).units.layout.header.contentRevision).not.toBe(
				snapshot.domain.unitRevisions.layout
			);

			const fresh = prepareUnitRuntime(stageEnvelope(after));
			if (fresh.kind !== 'ready') throw new Error('the accepted source did not prepare fresh');
			expect(after.domain.scene).toEqual(fresh.runtimeScene);

			const undone = await host.undo();
			expect(undone.kind).toBe('installed');
			expect(facade.snapshot().domain.scene).toBe(snapshot.domain.scene);

			const redone = await host.redo();
			expect(redone.kind).toBe('installed');
			expect(facade.snapshot().domain.scene).toBe(after.domain.scene);
		} finally {
			seam.stop();
			host.dispose();
		}
	});

	it('keeps the compile session working beside retention', async () => {
		// The retained Scene must not stand in for the compile store: the Layout
		// unit still compiles through the host's one incremental session.
		const session = createLayoutCompileSession();
		const outcome = await admitSource(
			baseline,
			context('revision-compile-session'),
			{ compileSession: session, previousRuntime: retained(baselineAdmission.snapshot) }
		);
		expect(outcome.kind).toBe('admitted');
		expect(session.stats().wallsEvaluated).toBeGreaterThan(0);
	});
});
