/**
 * E5 — irrelevance sweep, Node counters (T1.P02.S06 C). "Census, not timing."
 *
 * Hold the focus wing's fixed Wall edits constant across the museum at ×1 and
 * the sweep workloads at ×3 and ×10 (variants H, D and the connected C), and count the work
 * each edit does:
 *
 * - **per move** — the shipped per-move planner (`planWallManipulation`, what
 *   each Wall-handle pointer move runs): compiles, entity evaluations,
 *   whole-document passes, validations and pair visits;
 * - **per commit** and **per Undo/Redo** — the real Stage acceptance host and
 *   the mounted Layout adapter's F4 intent, exactly as the shipped commit and
 *   the Head's Undo/Redo submit them: additionally envelope validations,
 *   serializations, digests and their bytes, and F4 clones and frozen objects;
 *   history bytes per step are the retained canonical source bytes.
 *
 * Semantic independence is checked, not assumed: the fixed edit's changed set
 * (full-compile diff) must contain no entity the sweep added. Each counter's
 * slope against the added entities is compared with its I1 work-class bound.
 * The browser-side counters (draws, triangles, shadow draws, uploads, materials,
 * texture bytes) come from the smoke run's E5 rows, never from here.
 */
import { compileWallFirstLayoutGeometry, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { stageUnitRevision } from '$lib/authoring/stage/unit-stage-source';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { planWallManipulation, wallManipulationIntent } from '$lib/authoring/adapters/layout/precision';

import type { LoadedWorkload } from '../lib/workloads/registry';
import { changedEntities, compiledEntities } from './compiled-diff';
import { candidateDocument, EDIT_CLASSES, fixedEdit, type EditClass } from './e1-dependency';
import {
	allPairVisits,
	countWork,
	countWorkAsync,
	lookupVisits,
	entityEvaluations,
	pairVisits,
	wholeDocumentPasses,
	type WorkCounts
} from './work-counter';

const RECT = { left: 0, top: 0, width: 1920, height: 1080, devicePixelRatio: 1 };

/** The single fixed salt: every tier receives the identical edit. */
const FIXED_SALT = 0;

export type E5Phase = 'move' | 'commit' | 'undo' | 'redo';

export type E5Row = {
	readonly workload: string;
	readonly contentDigest: string;
	readonly factor: number;
	readonly variant: 'base' | 'H' | 'D' | 'C';
	readonly addedEntities: number;
	readonly editClass: EditClass;
	readonly phase: E5Phase;
	readonly outcome: string;
	readonly counts: WorkCounts;
	readonly derived: {
		readonly compiles: number;
		readonly entityEvaluations: number;
		readonly wholeDocumentPasses: number;
		readonly pairVisits: number;
		readonly allPairVisits: number;
		readonly lookupVisits: number;
		readonly cacheKeyChars: number;
		readonly envelopeValidations: number;
		readonly serializations: number;
		readonly digests: number;
		readonly digestBytes: number;
		readonly f4Clones: number;
		readonly frozenObjects: number;
		readonly historyBytesPerStep: number | null;
		readonly indexNodeVisits: number;
	};
	/** Move rows only: the fixed edit's changed set and its independence check. */
	readonly changedSet?: { readonly k: number; readonly addedInChangedSet: number };
};

function entityCount(document: LayoutDocumentWallFirst): number {
	return document.walls.length + document.junctions.length + document.openings.length + document.rooms.length;
}

function derive(counts: WorkCounts, historyBytesPerStep: number | null): E5Row['derived'] {
	return {
		compiles: counts.compile ?? 0,
		entityEvaluations: entityEvaluations(counts),
		wholeDocumentPasses: wholeDocumentPasses(counts),
		pairVisits: pairVisits(counts),
		allPairVisits: allPairVisits(counts),
		lookupVisits: lookupVisits(counts),
		cacheKeyChars: counts['cache-key:chars'] ?? 0,
		envelopeValidations: counts['envelope:validate'] ?? 0,
		serializations: counts['envelope:serialize'] ?? 0,
		digests: counts.digest ?? 0,
		digestBytes: counts['digest:bytes'] ?? 0,
		f4Clones: counts['f4:clone'] ?? 0,
		frozenObjects: counts['f4:freeze-object'] ?? 0,
		historyBytesPerStep,
		// No spatial or identity index exists on this tree: every lookup is a scan,
		// counted in the classes above. The counter exists so a landed index reports here.
		indexNodeVisits: counts['index:node-visit'] ?? 0
	};
}

async function mountHost(envelope: ProjectEnvelope, canonicalJson: string) {
	const admitted = await admitSourceJson(canonicalJson, {
		sessionEpoch: 'session:e5',
		acceptedRevision: envelope.acceptedRevision
	});
	if (admitted.kind !== 'admitted') throw new Error(`E5 workload did not admit: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host: StageAcceptanceHost = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: envelope,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	const registration = mountStageAdapter(facade, host, (port) => createAdapter(port));
	if (registration.kind !== 'registered') throw new Error('the Layout adapter did not mount for E5');
	return { facade, host };
}

export async function runE5Workload(input: {
	readonly workload: LoadedWorkload;
	readonly factor: number;
	readonly variant: 'base' | 'H' | 'D' | 'C';
	/** The ×1 museum's compiled entity keys: anything else in a changed set was added. */
	readonly baseEntityKeys: ReadonlySet<string>;
	readonly baseEntityCount: number;
}): Promise<E5Row[]> {
	const { workload } = input;
	const envelope = JSON.parse(workload.canonicalJson) as ProjectEnvelope;
	const document = envelope.units.layout.data;
	const focusWallId = workload.meta.focusWallId;
	if (focusWallId === undefined) throw new Error(`${workload.spec.id} records no focus Wall`);
	const addedEntities = entityCount(document) - input.baseEntityCount;
	const rows: E5Row[] = [];
	const row = (editClass: EditClass, phase: E5Phase, outcome: string, counts: WorkCounts, history: number | null, changedSet?: E5Row['changedSet']): E5Row => ({
		workload: workload.spec.id,
		contentDigest: workload.meta.contentDigest,
		factor: input.factor,
		variant: input.variant,
		addedEntities,
		editClass,
		phase,
		outcome,
		counts,
		derived: derive(counts, history),
		...(changedSet === undefined ? {} : { changedSet })
	});

	const before = compiledEntities(compileWallFirstLayoutGeometry(document).geometry);
	for (const editClass of EDIT_CLASSES) {
		const request = fixedEdit(document, focusWallId, editClass, FIXED_SALT);
		const { result: plan, counts } = countWork(() => planWallManipulation(document, focusWallId, request, 'start'));
		let changedSet: E5Row['changedSet'] | undefined;
		const candidate = plan.kind === 'refused' ? null : candidateDocument(document, focusWallId, request);
		if (candidate !== null) {
			const changed = changedEntities(before, compiledEntities(compileWallFirstLayoutGeometry(candidate).geometry));
			changedSet = { k: changed.length, addedInChangedSet: changed.filter((key) => !input.baseEntityKeys.has(key)).length };
		}
		rows.push(row(editClass, 'move', plan.kind, counts, null, changedSet));
	}

	// One host per edit class, so each commit starts from the loaded peak state.
	for (const editClass of EDIT_CLASSES) {
		const { facade, host } = await mountHost(envelope, workload.canonicalJson);
		const snapshot = facade.snapshot();
		const intent = wallManipulationIntent({
			request: fixedEdit(document, focusWallId, editClass, FIXED_SALT),
			wallId: focusWallId,
			fixed: 'start',
			operationId: `e5-${editClass}`,
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: host.acceptedRevision().revisionId,
			contentRevision: stageUnitRevision(snapshot, 'layout'),
			levelId: snapshot.domain.layoutLevelId
		});
		const commit = await countWorkAsync(() => host.accept(intent));
		rows.push(row(editClass, 'commit', commit.result.kind, commit.counts, Buffer.byteLength(facade.snapshot().canonicalJson)));
		const undo = await countWorkAsync(() => host.undo());
		rows.push(row(editClass, 'undo', undo.result.kind, undo.counts, null));
		const redo = await countWorkAsync(() => host.redo());
		rows.push(row(editClass, 'redo', redo.result.kind, redo.counts, null));
		host.dispose();
	}
	return rows;
}

/** I1 work class of each derived counter, and the bound its slope is held to. */
export const COUNTER_CLASSES: Readonly<Record<keyof E5Row['derived'], { readonly workClass: string; readonly bound: 'flat' | 'log' | 'changed-units' }>> = {
	compiles: { workClass: 'named global operation (whole-document compile)', bound: 'flat' },
	entityEvaluations: { workClass: 'affected-entity work', bound: 'flat' },
	wholeDocumentPasses: { workClass: 'affected-entity work (each pass evaluates every entity)', bound: 'flat' },
	pairVisits: { workClass: 'affected-entity work (pair joins, I2)', bound: 'flat' },
	allPairVisits: { workClass: 'affected-entity work (every counted pair loop, I2)', bound: 'flat' },
	lookupVisits: { workClass: 'affected-entity work (linear identity lookups)', bound: 'flat' },
	cacheKeyChars: { workClass: 'named global operation (cache-key serialization)', bound: 'changed-units' },
	envelopeValidations: { workClass: 'named global operation (envelope validation)', bound: 'flat' },
	serializations: { workClass: 'named global operation (canonical serialization)', bound: 'flat' },
	digests: { workClass: 'named global operation (content digest)', bound: 'flat' },
	digestBytes: { workClass: 'named global operation (digest bytes, I4/H7)', bound: 'changed-units' },
	f4Clones: { workClass: 'cloned objects (calls)', bound: 'flat' },
	frozenObjects: { workClass: 'cloned objects (H5)', bound: 'changed-units' },
	historyBytesPerStep: { workClass: 'history memory (H5)', bound: 'changed-units' },
	indexNodeVisits: { workClass: 'index traversal', bound: 'log' }
};

/**
 * The excess's eliminating mechanism, named per counter (plan E5: a slope above
 * its bound triggers attribution, it does not refute anything by itself).
 */
export const ATTRIBUTION: Readonly<Record<keyof E5Row['derived'], string>> = {
	compiles: 'H1 incremental evaluation; H2 one compile per accepted result',
	entityEvaluations: 'H1 incremental evaluation over the compiler’s dependency graph',
	wholeDocumentPasses: 'H1 (global checks as index queries over the swept bounds); H2 (each distinct check once)',
	pairVisits: 'H3 indexed joins',
	allPairVisits: 'H3 indexed joins; the topology gates evaluated over the swept bounds (H1)',
	lookupVisits: 'an identity index (Map) instead of linear lookups',
	cacheKeyChars: 'H1 (keys of unchanged entities reused); keys that do not serialize whole collections',
	envelopeValidations: 'H2 check inventory (each distinct check once)',
	serializations: 'H2/I4 serialization deferred to Save where no synchronous consumer needs it',
	digests: 'H2 unchanged units reuse their revisions',
	digestBytes: 'H2 hash only the changed units (still O(N_layout) for a Layout edit: H7 owner proposal)',
	f4Clones: 'H5 unit-level structural sharing',
	frozenObjects: 'H5 unit-level sharing (entity-level copy-on-write is an owner proposal)',
	historyBytesPerStep: 'H5 unit-level sharing (Layout unit still copied: owner proposal)',
	indexNodeVisits: 'n/a (no index on this tree)'
};

export type E5Slope = {
	readonly variant: 'H' | 'D' | 'C';
	readonly editClass: EditClass;
	readonly phase: E5Phase;
	readonly counter: keyof E5Row['derived'];
	readonly atBase: number;
	readonly atTop: number;
	readonly addedEntitiesAtTop: number;
	/** Counter growth per added entity, between ×1 and the largest built factor. */
	readonly slopePerAddedEntity: number;
	readonly bound: 'flat' | 'log' | 'changed-units';
	readonly withinBound: boolean;
	readonly attribution: string | null;
};

export function e5Slopes(rows: readonly E5Row[]): E5Slope[] {
	const slopes: E5Slope[] = [];
	for (const variant of ['H', 'D', 'C'] as const) {
		for (const editClass of EDIT_CLASSES) {
			for (const phase of ['move', 'commit', 'undo', 'redo'] as const) {
				const base = rows.find((row) => row.variant === 'base' && row.editClass === editClass && row.phase === phase);
				const tops = rows
					.filter((row) => row.variant === variant && row.editClass === editClass && row.phase === phase)
					.sort((a, b) => b.factor - a.factor);
				const top = tops[0];
				if (base === undefined || top === undefined) continue;
				for (const counter of Object.keys(COUNTER_CLASSES) as (keyof E5Row['derived'])[]) {
					const atBase = base.derived[counter];
					const atTop = top.derived[counter];
					if (atBase === null || atTop === null) continue;
					const slope = (atTop - atBase) / Math.max(1, top.addedEntities);
					const { bound } = COUNTER_CLASSES[counter];
					// Flat and changed-units bounds both mean "independent of added,
					// unrelated entities" here: the fixed edit's changed units hold no
					// added entity, so any growth is unrelated work.
					const withinBound = bound === 'log' ? atTop <= atBase + Math.log2(Math.max(2, top.addedEntities)) : atTop <= atBase;
					slopes.push({
						variant,
						editClass,
						phase,
						counter,
						atBase,
						atTop,
						addedEntitiesAtTop: top.addedEntities,
						slopePerAddedEntity: slope,
						bound,
						withinBound,
						attribution: withinBound ? null : ATTRIBUTION[counter]
					});
				}
			}
		}
	}
	return slopes;
}

/**
 * R at ×10 (variant H, and the connected variant C) for the per-move stages
 * that evaluate entities: today's units of work over the units the result
 * depends on (the changed set k).
 */
export function necessaryWorkRatios(rows: readonly E5Row[]): { variant: 'H' | 'C'; editClass: EditClass; stage: string; work: number; k: number; R: number }[] {
	const result: { variant: 'H' | 'C'; editClass: EditClass; stage: string; work: number; k: number; R: number }[] = [];
	for (const row of rows) {
		if ((row.variant !== 'H' && row.variant !== 'C') || row.factor !== 10 || row.phase !== 'move' || row.changedSet === undefined) continue;
		const variant = row.variant;
		const k = Math.max(1, row.changedSet.k);
		const perPass = row.derived.entityEvaluations / Math.max(1, row.derived.compiles);
		result.push({ variant, editClass: row.editClass, stage: 'compile (entity evaluations per compile)', work: perPass, k, R: perPass / k });
		result.push({
			variant,
			editClass: row.editClass,
			stage: 'whole-document passes (each evaluates every entity)',
			work: row.derived.wholeDocumentPasses * perPass,
			k,
			R: (row.derived.wholeDocumentPasses * perPass) / k
		});
	}
	return result;
}
